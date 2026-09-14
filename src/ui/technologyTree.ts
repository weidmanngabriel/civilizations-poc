type TechNodeKind = "base" | "profession" | "building" | "resource" | "special";

type TechNode = {
  id: string;
  label: string;
  subtitle?: string;
  x: number;
  y: number;
  kind: TechNodeKind;
};

type TechEdge = { from: string; to: string; dashed?: boolean };

const BUILD_MODE_EVENT = "poc-build-mode";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";

const NODES: TechNode[] = [
  { id: "civil", label: "👤 Ungelernter Wikinger", x: 70, y: 610, kind: "base" },
  { id: "extractor", label: "⛏ Abbauer", x: 350, y: 130, kind: "base" },
  { id: "farmer", label: "🌾 Bauer", x: 350, y: 390, kind: "base" },
  { id: "hunter", label: "🏹 Jäger", x: 350, y: 620, kind: "base" },
  { id: "carrier", label: "📦 Träger", x: 350, y: 850, kind: "base" },
  { id: "builder", label: "🔨 Bauarbeiter", x: 350, y: 1020, kind: "base" },
  { id: "fisher", label: "🐟 Fischer", x: 350, y: 1120, kind: "base" },
  { id: "scout", label: "🧭 Kundschafter", x: 350, y: 1220, kind: "base" },

  { id: "wood", label: "Holz-Erfahrung", x: 640, y: 20, kind: "resource" },
  { id: "clay", label: "Lehm-Erfahrung", x: 640, y: 110, kind: "resource" },
  { id: "stone", label: "Stein-Erfahrung", x: 640, y: 200, kind: "resource" },
  { id: "mushroom", label: "Pilz-Erfahrung", x: 640, y: 290, kind: "resource" },
  { id: "iron", label: "Eisenabbau", x: 640, y: 380, kind: "resource" },
  { id: "gold", label: "Goldabbau", x: 640, y: 470, kind: "resource" },

  { id: "carpenter", label: "🪚 Schreiner", x: 930, y: 20, kind: "profession" },
  { id: "potter", label: "🏺 Töpfer", x: 930, y: 110, kind: "profession" },
  { id: "mason", label: "🧱 Steinmetz", x: 930, y: 200, kind: "profession" },
  { id: "herb", label: "🌿 Kräutersammler", x: 930, y: 290, kind: "profession" },
  { id: "smith", label: "⚒ Schmied", x: 930, y: 380, kind: "profession" },
  { id: "druid", label: "🧪 Druide", x: 1210, y: 290, kind: "profession" },
  { id: "mintworker", label: "🪙 Münzpräger", x: 1210, y: 430, kind: "profession" },

  { id: "carp1", label: "Schreinerei I", subtitle: "Holzwerkzeuge", x: 1210, y: 20, kind: "building" },
  { id: "carp2", label: "Schreinerei II", subtitle: "Möbel", x: 1490, y: 20, kind: "building" },
  { id: "carp3", label: "Schreinerei III", subtitle: "Transport", x: 1770, y: 20, kind: "building" },
  { id: "carp4", label: "Schreinerei IV", subtitle: "große Transportmittel / Schiffe", x: 2050, y: 20, kind: "building" },
  { id: "pot1", label: "Töpferei I", subtitle: "Ziegel", x: 1210, y: 100, kind: "building" },
  { id: "pot2", label: "Töpferei II", subtitle: "Dachziegel", x: 1490, y: 100, kind: "building" },
  { id: "pot3", label: "Töpferei III", subtitle: "Geschirr", x: 1770, y: 100, kind: "building" },
  { id: "mason1", label: "Steinmetzwerkstatt I", subtitle: "Steinblöcke", x: 1210, y: 180, kind: "building" },
  { id: "mason2", label: "Steinmetzwerkstatt II", subtitle: "Marmor", x: 1490, y: 180, kind: "building" },
  { id: "smith1", label: "Schmiede I", subtitle: "Werkzeuge / Ausrüstung", x: 1210, y: 510, kind: "building" },
  { id: "smith2", label: "Schmiede II", subtitle: "fortgeschrittene Ausrüstung", x: 1490, y: 510, kind: "building" },
  { id: "mint", label: "Münzprägestätte", x: 1490, y: 430, kind: "building" },
  { id: "alch1", label: "Alchemistenhütte I", subtitle: "Öl", x: 1490, y: 270, kind: "building" },
  { id: "alch2", label: "Alchemistenhütte II", subtitle: "Tränke", x: 1770, y: 270, kind: "building" },
  { id: "temple", label: "⛩ Tempel", x: 1490, y: 350, kind: "special" },

  { id: "miller", label: "🌾 Müller", x: 640, y: 580, kind: "profession" },
  { id: "mill", label: "Mühle", x: 930, y: 580, kind: "building" },
  { id: "baker", label: "🥖 Bäcker", x: 1210, y: 620, kind: "profession" },
  { id: "bakery1", label: "Bäckerei I", x: 1490, y: 620, kind: "building" },
  { id: "bakery2", label: "Bäckerei II", x: 1770, y: 620, kind: "building" },
  { id: "brewer", label: "🍯 Brauer", x: 1490, y: 700, kind: "profession" },
  { id: "brewery", label: "Brauerei", x: 1770, y: 700, kind: "building" },

  { id: "tailor", label: "🧵 Schneider", x: 640, y: 760, kind: "profession" },
  { id: "stockfarmer", label: "🐄 Viehzüchter", x: 640, y: 680, kind: "profession" },
  { id: "tailor1", label: "Schneiderei I", subtitle: "Schuhe", x: 930, y: 760, kind: "building" },
  { id: "tailor2", label: "Schneiderei II", subtitle: "Kleidung / Schutz", x: 1210, y: 760, kind: "building" },
  { id: "cattle", label: "Viehhof", x: 930, y: 680, kind: "building" },
  { id: "merchant", label: "🛒 Händler", x: 640, y: 850, kind: "profession" },
  { id: "school", label: "🏫 Schule", subtitle: "gemeisterte Berufe lehrbar", x: 1210, y: 920, kind: "special" },
];

const EDGES: TechEdge[] = [
  { from: "civil", to: "extractor" }, { from: "civil", to: "farmer" },
  { from: "civil", to: "hunter" }, { from: "civil", to: "carrier" },
  { from: "civil", to: "builder" }, { from: "civil", to: "fisher" }, { from: "civil", to: "scout" },
  { from: "extractor", to: "wood" }, { from: "extractor", to: "clay" },
  { from: "extractor", to: "stone" }, { from: "extractor", to: "mushroom" },
  { from: "extractor", to: "iron" }, { from: "extractor", to: "gold" },
  { from: "wood", to: "carpenter" }, { from: "clay", to: "potter" }, { from: "stone", to: "mason" },
  { from: "mushroom", to: "herb" }, { from: "herb", to: "druid" }, { from: "iron", to: "smith" },
  { from: "smith", to: "mintworker" }, { from: "gold", to: "mintworker", dashed: true },
  { from: "carpenter", to: "carp1" }, { from: "carp1", to: "carp2" }, { from: "carp2", to: "carp3" }, { from: "carp3", to: "carp4" },
  { from: "potter", to: "pot1" }, { from: "pot1", to: "pot2" }, { from: "pot2", to: "pot3" },
  { from: "mason", to: "mason1" }, { from: "mason1", to: "mason2" },
  { from: "smith", to: "smith1" }, { from: "smith1", to: "smith2" }, { from: "mintworker", to: "mint" },
  { from: "druid", to: "alch1" }, { from: "alch1", to: "alch2" }, { from: "druid", to: "temple" },
  { from: "farmer", to: "miller" }, { from: "miller", to: "mill" }, { from: "miller", to: "baker" },
  { from: "baker", to: "bakery1" }, { from: "bakery1", to: "bakery2" }, { from: "baker", to: "brewer" }, { from: "brewer", to: "brewery" },
  { from: "hunter", to: "tailor" }, { from: "hunter", to: "stockfarmer" },
  { from: "tailor", to: "tailor1" }, { from: "tailor1", to: "tailor2" }, { from: "stockfarmer", to: "cattle" },
  { from: "carrier", to: "merchant" }, { from: "pot1", to: "school" },
  { from: "school", to: "carpenter", dashed: true }, { from: "school", to: "mason", dashed: true },
  { from: "school", to: "potter", dashed: true }, { from: "school", to: "smith", dashed: true },
  { from: "school", to: "druid", dashed: true }, { from: "school", to: "miller", dashed: true },
  { from: "school", to: "baker", dashed: true }, { from: "school", to: "brewer", dashed: true },
  { from: "school", to: "tailor", dashed: true }, { from: "school", to: "stockfarmer", dashed: true },
  { from: "school", to: "merchant", dashed: true },
];

const NODE_WIDTH = 210;
const NODE_HEIGHT = 58;
const CANVAS_WIDTH = 2320;
const CANVAS_HEIGHT = 1360;

const edgeMarkup = (): string => EDGES.map((edge) => {
  const from = NODES.find((node) => node.id === edge.from)!;
  const to = NODES.find((node) => node.id === edge.to)!;
  const x1 = from.x + NODE_WIDTH;
  const y1 = from.y + NODE_HEIGHT / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_HEIGHT / 2;
  const mid = x1 + Math.max(40, (x2 - x1) / 2);
  return `<path d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}" ${edge.dashed ? 'class="tech-tree-edge dashed"' : 'class="tech-tree-edge"'} />`;
}).join("");

const nodeMarkup = (): string => NODES.map((node) => `
  <div class="tech-tree-node ${node.kind}" style="left:${node.x}px;top:${node.y}px" data-node="${node.id}">
    <strong>${node.label}</strong>${node.subtitle ? `<span>${node.subtitle}</span>` : ""}
  </div>`).join("");

export function mountTechnologyTree(): void {
  const main = document.querySelector<HTMLElement>("main");
  const leftMenu = document.querySelector<HTMLElement>(".left-menu");
  if (!main || !leftMenu) return;

  const toggle = document.createElement("button");
  toggle.id = "technology-tree-toggle";
  toggle.className = "left-menu-button";
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-controls", "technology-tree-overlay");
  toggle.innerHTML = `<span class="technology-tree-menu-icon" aria-hidden="true">⌘</span><span class="left-menu-button-label">Technologie</span>`;
  leftMenu.append(toggle);

  const overlay = document.createElement("section");
  overlay.id = "technology-tree-overlay";
  overlay.className = "technology-tree-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "technology-tree-title");
  overlay.innerHTML = `
    <header class="technology-tree-header">
      <div><small>ÜBERSICHT</small><strong id="technology-tree-title">Technologiebaum</strong></div>
      <div class="technology-tree-actions">
        <button type="button" data-tech-zoom="out" aria-label="Verkleinern">−</button>
        <button type="button" data-tech-zoom="reset">100 %</button>
        <button type="button" data-tech-zoom="in" aria-label="Vergrößern">+</button>
        <button id="technology-tree-close" type="button" aria-label="Technologiebaum schließen">×</button>
      </div>
    </header>
    <div class="technology-tree-viewport" tabindex="0" aria-label="Zoombarer Technologiebaum">
      <div class="technology-tree-canvas" style="width:${CANVAS_WIDTH}px;height:${CANVAS_HEIGHT}px">
        <svg class="technology-tree-lines" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" aria-hidden="true">
          <defs><marker id="tech-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" /></marker></defs>
          ${edgeMarkup()}
        </svg>
        ${nodeMarkup()}
      </div>
    </div>`;
  main.append(overlay);

  const viewport = overlay.querySelector<HTMLElement>(".technology-tree-viewport")!;
  const canvas = overlay.querySelector<HTMLElement>(".technology-tree-canvas")!;
  const close = overlay.querySelector<HTMLButtonElement>("#technology-tree-close")!;
  const resetButton = overlay.querySelector<HTMLButtonElement>('[data-tech-zoom="reset"]')!;

  let scale = 1;
  let translateX = 24;
  let translateY = 24;
  const pointers = new Map<number, { x: number; y: number }>();
  let lastPanPoint: { x: number; y: number } | undefined;
  let lastPinchDistance: number | undefined;

  const clampScale = (value: number) => Math.min(2.5, Math.max(0.35, value));
  const renderTransform = () => {
    canvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    resetButton.textContent = `${Math.round(scale * 100)} %`;
  };

  const zoomAt = (nextScale: number, clientX: number, clientY: number) => {
    const clamped = clampScale(nextScale);
    if (clamped === scale) return;
    const rect = viewport.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const worldX = (localX - translateX) / scale;
    const worldY = (localY - translateY) / scale;
    translateX = localX - worldX * clamped;
    translateY = localY - worldY * clamped;
    scale = clamped;
    renderTransform();
  };

  const fitTree = () => {
    const rect = viewport.getBoundingClientRect();
    const fitScale = clampScale(Math.min((rect.width - 48) / CANVAS_WIDTH, (rect.height - 48) / CANVAS_HEIGHT));
    scale = fitScale;
    translateX = Math.max(24, (rect.width - CANVAS_WIDTH * scale) / 2);
    translateY = Math.max(24, (rect.height - CANVAS_HEIGHT * scale) / 2);
    renderTransform();
  };

  const setOpen = (open: boolean) => {
    overlay.hidden = !open;
    toggle.classList.toggle("active", open);
    toggle.setAttribute("aria-expanded", String(open));
    if (!open) return;
    document.querySelector<HTMLButtonElement>("#build-menu-close")?.click();
    document.querySelector<HTMLButtonElement>("#handbook-close")?.click();
    requestAnimationFrame(() => {
      fitTree();
      viewport.focus({ preventScroll: true });
    });
  };

  toggle.addEventListener("click", () => setOpen(overlay.hidden));
  close.addEventListener("click", () => setOpen(false));
  overlay.querySelector('[data-tech-zoom="in"]')?.addEventListener("click", () => {
    const rect = viewport.getBoundingClientRect();
    zoomAt(scale * 1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  overlay.querySelector('[data-tech-zoom="out"]')?.addEventListener("click", () => {
    const rect = viewport.getBoundingClientRect();
    zoomAt(scale / 1.2, rect.left + rect.width / 2, rect.top + rect.height / 2);
  });
  resetButton.addEventListener("click", fitTree);

  viewport.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomAt(scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event.clientX, event.clientY);
  }, { passive: false });

  viewport.addEventListener("pointerdown", (event) => {
    viewport.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) lastPanPoint = { x: event.clientX, y: event.clientY };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      lastPinchDistance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      lastPanPoint = undefined;
    }
  });

  viewport.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1 && lastPanPoint) {
      translateX += event.clientX - lastPanPoint.x;
      translateY += event.clientY - lastPanPoint.y;
      lastPanPoint = { x: event.clientX, y: event.clientY };
      renderTransform();
      return;
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const centerX = (a!.x + b!.x) / 2;
      const centerY = (a!.y + b!.y) / 2;
      if (lastPinchDistance) zoomAt(scale * (distance / lastPinchDistance), centerX, centerY);
      lastPinchDistance = distance;
    }
  });

  const releasePointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    lastPinchDistance = undefined;
    const remaining = [...pointers.values()][0];
    lastPanPoint = remaining ? { ...remaining } : undefined;
  };
  viewport.addEventListener("pointerup", releasePointer);
  viewport.addEventListener("pointercancel", releasePointer);

  window.addEventListener(BUILD_MODE_EVENT, () => setOpen(false));
  window.addEventListener(MERCHANT_TARGET_MODE_EVENT, () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) setOpen(false);
  });

  renderTransform();
}
