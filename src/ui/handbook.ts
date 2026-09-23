import type { AnimalKind, Good, Profession } from "../simulation/model";
import {
  HANDBOOK_OPEN_EVENT,
  HANDBOOK_VISIBILITY_EVENT,
  type HandbookTarget,
  type WikiBuildingKind,
} from "./wikiLinks";
import {
  renderAnimalArticle,
  renderAnimalsOverview,
  renderBuildingArticle,
  renderBuildingsOverview,
  renderGoodArticle,
  renderGoodsOverview,
  renderProfessionArticle,
  renderProfessionsOverview,
} from "./wikiCatalog";

const BUILD_MODE_EVENT = "poc-build-mode";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";
const UI_MENU_OPENED_EVENT = "poc-ui-menu-opened";

type HandbookPage = {
  id: string;
  title: string;
  render: () => string;
};

type HandbookSection = {
  id: string;
  title: string;
};

type HandbookRoute =
  | { kind: "page"; id: string }
  | { kind: "good"; id: Good }
  | { kind: "building"; id: WikiBuildingKind }
  | { kind: "animal"; id: AnimalKind }
  | { kind: "profession"; id: Profession };

const PAGES: HandbookPage[] = [
  { id: "professions", title: "Berufe", render: renderProfessionsOverview },
  { id: "buildings", title: "Gebäude", render: renderBuildingsOverview },
  { id: "animals", title: "Tiere", render: renderAnimalsOverview },
  { id: "goods", title: "Waren", render: renderGoodsOverview },
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

const stripInlineMarkdown = (value: string): string => value.replace(/\*\*(.+?)\*\*/g, "$1");

export const getHandbookSections = (source: string): HandbookSection[] =>
  source
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("## "))
    .map((line, index) => ({
      id: `handbook-section-${index + 1}`,
      title: stripInlineMarkdown(line.slice(3)),
    }));

export const renderHandbookMarkdown = (source: string): string => {
  const lines = source.trim().split(/\r?\n/);
  const html: string[] = [];
  let listItems: string[] = [];
  let sectionIndex = 0;

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
      sectionIndex += 1;
      html.push(`<h2 id="handbook-section-${sectionIndex}">${renderInlineMarkdown(line.slice(3))}</h2>`);
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
        <button id="handbook-back" class="handbook-back" type="button" aria-label="Zurück" hidden>←</button>
        <div>
          <small>SPIELHILFE & WIKI</small>
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
        <div class="handbook-content-shell">
          <article class="handbook-content" tabindex="-1"></article>
          <div class="handbook-quicknav">
            <button
              class="handbook-quicknav-toggle"
              type="button"
              aria-label="Abschnitte dieser Seite"
              aria-expanded="false"
              aria-controls="handbook-quicknav-menu"
            ><span aria-hidden="true">☰</span></button>
            <nav id="handbook-quicknav-menu" class="handbook-quicknav-menu" aria-label="Abschnitte dieser Seite" hidden>
              <strong>Auf dieser Seite</strong>
              <div class="handbook-quicknav-links"></div>
            </nav>
          </div>
        </div>
      </div>
    </div>`;
  main.append(overlay);

  const content = overlay.querySelector<HTMLElement>(".handbook-content")!;
  const close = overlay.querySelector<HTMLButtonElement>("#handbook-close")!;
  const back = overlay.querySelector<HTMLButtonElement>("#handbook-back")!;
  const quickNav = overlay.querySelector<HTMLElement>(".handbook-quicknav")!;
  const quickNavToggle = overlay.querySelector<HTMLButtonElement>(".handbook-quicknav-toggle")!;
  const quickNavMenu = overlay.querySelector<HTMLElement>(".handbook-quicknav-menu")!;
  const quickNavLinks = overlay.querySelector<HTMLElement>(".handbook-quicknav-links")!;
  const pageButtons = Array.from(overlay.querySelectorAll<HTMLButtonElement>("[data-handbook-page]"));
  let activeRoute: HandbookRoute = { kind: "page", id: PAGES[0]!.id };
  let history: HandbookRoute[] = [];

  const setQuickNavOpen = (open: boolean) => {
    quickNavMenu.hidden = !open;
    quickNavToggle.setAttribute("aria-expanded", String(open));
  };

  const dynamicSections = (): HandbookSection[] =>
    Array.from(content.querySelectorAll<HTMLElement>("h2[id]")).map((heading) => ({
      id: heading.id,
      title: heading.textContent?.trim() ?? "",
    }));

  const renderRoute = (route: HandbookRoute, pushHistory = true) => {
    if (pushHistory && (
      activeRoute.kind !== route.kind ||
      activeRoute.id !== route.id
    )) history.push(activeRoute);
    activeRoute = route;

    if (route.kind === "good") content.innerHTML = renderGoodArticle(route.id);
    else if (route.kind === "building") content.innerHTML = renderBuildingArticle(route.id);
    else if (route.kind === "animal") content.innerHTML = renderAnimalArticle(route.id);
    else if (route.kind === "profession") content.innerHTML = renderProfessionArticle(route.id);
    else {
      const page = PAGES.find((candidate) => candidate.id === route.id) ?? PAGES[0]!;
      content.innerHTML = page.render();
      activeRoute = { kind: "page", id: page.id };
    }

    const sections = dynamicSections();

    quickNavLinks.innerHTML = sections
      .map((section) => `<button type="button" data-handbook-section="${section.id}">${escapeHtml(section.title)}</button>`)
      .join("");
    quickNav.hidden = sections.length === 0;
    setQuickNavOpen(false);
    back.hidden = history.length === 0;

    for (const button of pageButtons)
      button.setAttribute(
        "aria-pressed",
        String(activeRoute.kind === "page" && button.dataset.handbookPage === activeRoute.id),
      );
    content.scrollTop = 0;
  };

  const setOpen = (open: boolean) => {
    if (overlay.hidden === !open) return;
    overlay.hidden = !open;
    window.dispatchEvent(new CustomEvent(HANDBOOK_VISIBILITY_EVENT, { detail: { open } }));
    toggle.setAttribute("aria-expanded", String(open));
    toggle.classList.toggle("active", open);
    if (open) {
      window.dispatchEvent(new CustomEvent(UI_MENU_OPENED_EVENT, { detail: { menu: "handbook" } }));
      const buildPanel = document.querySelector<HTMLElement>("#build-menu-panel");
      if (buildPanel && !buildPanel.hidden)
        document.querySelector<HTMLButtonElement>("#build-menu-close")?.click();
      renderRoute(activeRoute, false);
      requestAnimationFrame(() => content.focus({ preventScroll: true }));
    }
  };

  const openTarget = (target: HandbookTarget) => {
    setOpen(true);
    renderRoute(target);
  };

  toggle.addEventListener("click", () => setOpen(overlay.hidden));
  close.addEventListener("click", () => setOpen(false));
  back.addEventListener("click", () => {
    const route = history.pop();
    if (route) renderRoute(route, false);
  });
  quickNavToggle.addEventListener("click", () => setQuickNavOpen(quickNavMenu.hidden));

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      setOpen(false);
      return;
    }
    const target = event.target as HTMLElement;
    const pageButton = target.closest<HTMLButtonElement>("[data-handbook-page]");
    if (pageButton?.dataset.handbookPage) {
      renderRoute({ kind: "page", id: pageButton.dataset.handbookPage });
      return;
    }
    const sectionButton = target.closest<HTMLButtonElement>("[data-handbook-section]");
    if (sectionButton?.dataset.handbookSection) {
      const heading = content.querySelector<HTMLElement>(`#${sectionButton.dataset.handbookSection}`);
      if (heading) content.scrollTo({ top: Math.max(0, heading.offsetTop - 12), behavior: "smooth" });
      setQuickNavOpen(false);
      return;
    }
    if (!target.closest(".handbook-quicknav")) setQuickNavOpen(false);
  });

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const goodLink = target.closest<HTMLElement>("[data-wiki-good]");
    if (goodLink?.dataset.wikiGood) {
      event.preventDefault();
      event.stopPropagation();
      openTarget({ kind: "good", id: goodLink.dataset.wikiGood as Good });
      return;
    }
    const buildingLink = target.closest<HTMLElement>("[data-wiki-building]");
    if (buildingLink?.dataset.wikiBuilding) {
      event.preventDefault();
      event.stopPropagation();
      openTarget({ kind: "building", id: buildingLink.dataset.wikiBuilding as WikiBuildingKind });
      return;
    }
    const animalLink = target.closest<HTMLElement>("[data-wiki-animal]");
    if (animalLink?.dataset.wikiAnimal) {
      event.preventDefault();
      event.stopPropagation();
      openTarget({ kind: "animal", id: animalLink.dataset.wikiAnimal as AnimalKind });
      return;
    }
    const professionLink = target.closest<HTMLElement>("[data-wiki-profession]");
    if (professionLink?.dataset.wikiProfession) {
      event.preventDefault();
      event.stopPropagation();
      openTarget({ kind: "profession", id: professionLink.dataset.wikiProfession as Profession });
    }
  });

  window.addEventListener(HANDBOOK_OPEN_EVENT, (event) => {
    openTarget((event as CustomEvent<HandbookTarget>).detail);
  });
  document.querySelector<HTMLButtonElement>("#build-menu-toggle")?.addEventListener("click", () => {
    if (!overlay.hidden) setOpen(false);
  });
  window.addEventListener(BUILD_MODE_EVENT, () => setOpen(false));
  window.addEventListener(MERCHANT_TARGET_MODE_EVENT, () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || overlay.hidden) return;
    if (!quickNavMenu.hidden) {
      setQuickNavOpen(false);
      return;
    }
    setOpen(false);
  });

  renderRoute(activeRoute, false);
}
