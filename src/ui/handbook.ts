import welcomeMarkdown from "../handbook/willkommen.md?raw";
import residentsMarkdown from "../handbook/bewohner.md?raw";
import buildingMarkdown from "../handbook/bauen.md?raw";
import logisticsMarkdown from "../handbook/logistik.md?raw";
import worldMarkdown from "../handbook/welt.md?raw";
import troubleshootingMarkdown from "../handbook/probleme.md?raw";

const BUILD_MODE_EVENT = "poc-build-mode";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";

type HandbookPage = {
  id: string;
  title: string;
  content: string;
};

const PAGES: HandbookPage[] = [
  { id: "welcome", title: "Willkommen", content: welcomeMarkdown },
  { id: "residents", title: "Bewohner", content: residentsMarkdown },
  { id: "building", title: "Bauen", content: buildingMarkdown },
  { id: "logistics", title: "Waren & Logistik", content: logisticsMarkdown },
  { id: "world", title: "Welt & Wege", content: worldMarkdown },
  { id: "troubleshooting", title: "Probleme lösen", content: troubleshootingMarkdown },
];

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const renderInlineMarkdown = (value: string): string =>
  escapeHtml(value).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

export const renderHandbookMarkdown = (source: string): string => {
  const lines = source.trim().split(/\r?\n/);
  const html: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    html.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    listItems = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith("# ")) {
      flushList();
      html.push(`<h1>${renderInlineMarkdown(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith("## ")) {
      flushList();
      html.push(`<h2>${renderInlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith("- ")) {
      listItems.push(renderInlineMarkdown(line.slice(2)));
      continue;
    }
    flushList();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  flushList();
  return html.join("");
};

export function mountHandbook(): void {
  const main = document.querySelector<HTMLElement>("main");
  const leftMenu = document.querySelector<HTMLElement>(".left-menu");
  if (!main || !leftMenu) return;

  const toggle = document.createElement("button");
  toggle.id = "handbook-toggle";
  toggle.className = "left-menu-button";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "handbook-overlay");
  toggle.innerHTML = `
    <span class="handbook-menu-icon" aria-hidden="true">?</span>
    <span class="left-menu-button-label">Handbuch</span>`;
  leftMenu.prepend(toggle);

  const overlay = document.createElement("section");
  overlay.id = "handbook-overlay";
  overlay.className = "handbook-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "handbook-title");
  overlay.innerHTML = `
    <div class="handbook-dialog">
      <header class="handbook-header">
        <div>
          <small>SPIELHILFE</small>
          <strong id="handbook-title">Handbuch</strong>
        </div>
        <button id="handbook-close" type="button" aria-label="Handbuch schließen">×</button>
      </header>
      <div class="handbook-layout">
        <nav class="handbook-nav" aria-label="Handbuchseiten">
          ${PAGES.map(
            (page, index) => `
              <button type="button" data-handbook-page="${page.id}" aria-pressed="${index === 0}">
                ${page.title}
              </button>`,
          ).join("")}
        </nav>
        <article class="handbook-content" tabindex="-1"></article>
      </div>
    </div>`;
  main.append(overlay);

  const content = overlay.querySelector<HTMLElement>(".handbook-content")!;
  const close = overlay.querySelector<HTMLButtonElement>("#handbook-close")!;
  const pageButtons = Array.from(
    overlay.querySelectorAll<HTMLButtonElement>("[data-handbook-page]"),
  );
  let activePageId = PAGES[0]!.id;

  const renderPage = (pageId: string) => {
    const page = PAGES.find((candidate) => candidate.id === pageId) ?? PAGES[0]!;
    activePageId = page.id;
    content.innerHTML = renderHandbookMarkdown(page.content);
    for (const button of pageButtons)
      button.setAttribute("aria-pressed", String(button.dataset.handbookPage === page.id));
    content.scrollTop = 0;
  };

  const setOpen = (open: boolean) => {
    overlay.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.classList.toggle("active", open);
    if (open) {
      const buildPanel = document.querySelector<HTMLElement>("#build-menu-panel");
      if (buildPanel && !buildPanel.hidden)
        document.querySelector<HTMLButtonElement>("#build-menu-close")?.click();
      renderPage(activePageId);
      requestAnimationFrame(() => content.focus({ preventScroll: true }));
    }
  };

  toggle.addEventListener("click", () => setOpen(overlay.hidden));
  close.addEventListener("click", () => setOpen(false));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) setOpen(false);
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-handbook-page]");
    if (button?.dataset.handbookPage) renderPage(button.dataset.handbookPage);
  });
  document.querySelector<HTMLButtonElement>("#build-menu-toggle")?.addEventListener("click", () => {
    if (!overlay.hidden) setOpen(false);
  });
  window.addEventListener(BUILD_MODE_EVENT, () => setOpen(false));
  window.addEventListener(MERCHANT_TARGET_MODE_EVENT, () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) setOpen(false);
  });

  renderPage(activePageId);
}
