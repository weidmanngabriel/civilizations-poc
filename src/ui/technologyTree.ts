import type { PlaceableBuildingKind, Profession, World } from "../simulation/model";
import { PROFESSION_LABELS } from "../simulation/experience";
import {
  TECHNOLOGY_XP_THRESHOLD,
  isBuildingUnlocked,
  maxProfessionExperience,
  technologyProgress,
} from "../simulation/technology";

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
type NodeState = "unlocked" | "progress" | "locked" | "planned";
type NodeStatus = { state: NodeState; text: string };

const BUILD_MODE_EVENT = "poc-build-mode";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";

const NODES: TechNode[] = [
  { id: "civil", label: "👤 Ungelernter Wikinger", x: 70, y: 610, kind: "base" },
  { id: "barracks", label: "Kaserne", subtitle: "noch nicht im Prototyp", x: 70, y: 530, kind: "building" },
  { id: "house", label: "Wohnhaus", subtitle: "von Anfang an verfügbar", x: 70, y: 1040, kind: "building" },
  { id: "farmBuilding", label: "Farm", subtitle: "von Anfang an verfügbar", x: 70, y: 1130, kind: "building" },
  { id: "well", label: "Brunnen", subtitle: "von Anfang an verfügbar", x: 70, y: 1220, kind: "building" },
  { id: "school", label: "🏫 Schule", subtitle: "noch nicht im Prototyp", x: 70, y: 1410, kind: "special" },

  { id: "wood", label: "⛏ Abbauer Holz", x: 350, y: 40, kind: "base" },
  { id: "clay", label: "⛏ Abbauer Lehm", x: 350, y: 130, kind: "base" },
  { id: "stone", label: "⛏ Abbauer Stein", x: 350, y: 220, kind: "base" },
  { id: "farmer", label: "🌾 Bauer", x: 350, y: 390, kind: "base" },
  { id: "soldier", label: "🛡 Soldat", subtitle: "Ausbildung in der Kaserne", x: 350, y: 530, kind: "profession" },
  { id: "hunter", label: "🏹 Jäger", x: 350, y: 620, kind: "base" },
  { id: "carrier", label: "📦 Träger", x: 350, y: 850, kind: "base" },
  { id: "builder", label: "🔨 Bauarbeiter", x: 350, y: 1020, kind: "base" },
  { id: "fisher", label: "🐟 Fischer", x: 350, y: 1120, kind: "base" },
  { id: "scout", label: "🧭 Kundschafter", x: 350, y: 1220, kind: "base" },

  { id: "sawmill", label: "Sägewerk", subtitle: "nach Abbauer Holz", x: 640, y: 40, kind: "building" },
  { id: "pot1", label: "Töpferei", subtitle: "Ziegel", x: 640, y: 130, kind: "building" },
  { id: "mason1", label: "Steinmetzhütte", subtitle: "Steinblöcke", x: 640, y: 220, kind: "building" },
  { id: "mushroom", label: "⛏ Abbauer Pilz", x: 640, y: 310, kind: "resource" },
  { id: "iron", label: "Eisenabbau", x: 640, y: 400, kind: "resource" },
  { id: "gold", label: "⛏ Abbauer Gold", x: 640, y: 490, kind: "resource" },
  { id: "miller", label: "🌾 Müller", x: 640, y: 580, kind: "profession" },
  { id: "stockfarmer", label: "🐄 Viehzüchter", x: 640, y: 680, kind: "profession" },
  { id: "tailor", label: "🧵 Schneider", x: 640, y: 760, kind: "profession" },
  { id: "warehouse", label: "Lager", subtitle: "Träger-Erfahrung", x: 640, y: 850, kind: "building" },
  { id: "merchant", label: "🛒 Händler", x: 640, y: 940, kind: "profession" },

  { id: "sawmillWorker", label: "🪚 Sägewerker", x: 930, y: 40, kind: "profession" },
  { id: "potter", label: "🏺 Töpfer", x: 930, y: 130, kind: "profession" },
  { id: "mason", label: "🧱 Steinmetz", x: 930, y: 220, kind: "profession" },
  { id: "herb", label: "🌿 Kräutersammler", x: 930, y: 310, kind: "profession" },
  { id: "smith", label: "⚒ Schmied", x: 930, y: 400, kind: "profession" },
  { id: "mill", label: "Mühle", x: 930, y: 580, kind: "building" },
  { id: "cattle", label: "Viehhof", x: 930, y: 680, kind: "building" },
  { id: "tailor1", label: "Schneiderei I", subtitle: "Schuhe", x: 930, y: 760, kind: "building" },

  { id: "carp1", label: "Schreinerei", subtitle: "Holzwerkzeuge", x: 1210, y: 40, kind: "building" },
  { id: "pot2", label: "Töpferei II", subtitle: "Dachziegel", x: 1210, y: 130, kind: "building" },
  { id: "mason2", label: "Steinmetzwerkstatt II", subtitle: "Marmor", x: 1210, y: 220, kind: "building" },
  { id: "druid", label: "🧪 Druide", x: 1210, y: 310, kind: "profession" },
  { id: "mintworker", label: "🪙 Münzpräger", x: 1210, y: 430, kind: "profession" },
  { id: "baker", label: "🥖 Bäcker", x: 1210, y: 620, kind: "profession" },
  { id: "tailor2", label: "Schneiderei II", subtitle: "Kleidung / Schutz", x: 1210, y: 760, kind: "building" },

  { id: "carp2", label: "Schreinerei II", subtitle: "Möbel", x: 1490, y: 40, kind: "building" },
  { id: "pot3", label: "Töpferei III", subtitle: "Geschirr", x: 1490, y: 130, kind: "building" },
  { id: "alch1", label: "Alchemistenhütte I", subtitle: "Öl", x: 1490, y: 310, kind: "building" },
  { id: "temple", label: "⛩ Tempel", x: 1490, y: 390, kind: "special" },
  { id: "mint", label: "Münzprägestätte", x: 1490, y: 470, kind: "building" },
  { id: "smith1", label: "Schmiede I", subtitle: "Werkzeuge / Ausrüstung", x: 1490, y: 550, kind: "building" },
  { id: "bakery1", label: "Bäckerei", x: 1490, y: 630, kind: "building" },
  { id: "brewer", label: "🍯 Brauer", x: 1490, y: 710, kind: "profession" },

  { id: "carp3", label: "Schreinerei III", subtitle: "Transport", x: 1770, y: 40, kind: "building" },
  { id: "alch2", label: "Alchemistenhütte II", subtitle: "Tränke", x: 1770, y: 310, kind: "building" },
  { id: "smith2", label: "Schmiede II", subtitle: "fortgeschrittene Ausrüstung", x: 1770, y: 550, kind: "building" },
  { id: "bakery2", label: "Bäckerei II", x: 1770, y: 630, kind: "building" },
  { id: "brewery", label: "Brauerei", x: 1770, y: 710, kind: "building" },

  { id: "carp4", label: "Schreinerei IV", subtitle: "große Transportmittel / Schiffe", x: 2050, y: 40, kind: "building" },
  { id: "weaponHut", label: "Waffenhütte", subtitle: "Militärausrüstung", x: 2050, y: 550, kind: "building" },
];

const EDGES: TechEdge[] = [
  { from: "civil", to: "wood" }, { from: "civil", to: "clay" }, { from: "civil", to: "stone" },
  { from: "civil", to: "farmer" }, { from: "barracks", to: "soldier" },
  { from: "civil", to: "hunter" }, { from: "civil", to: "carrier" },
  { from: "civil", to: "builder" }, { from: "civil", to: "fisher" }, { from: "civil", to: "scout" },
  { from: "civil", to: "mushroom" }, { from: "civil", to: "iron" }, { from: "civil", to: "gold" },

  { from: "wood", to: "sawmill" }, { from: "sawmill", to: "sawmillWorker" },
  { from: "sawmillWorker", to: "carp1" }, { from: "carp1", to: "carp2" },
  { from: "carp2", to: "carp3" }, { from: "carp3", to: "carp4" },

  { from: "clay", to: "pot1" }, { from: "pot1", to: "potter" },
  { from: "potter", to: "pot2" }, { from: "pot2", to: "pot3" },

  { from: "stone", to: "mason1" }, { from: "mason1", to: "mason" },
  { from: "mason", to: "mason2" },

  { from: "mushroom", to: "herb" }, { from: "herb", to: "druid" },
  { from: "iron", to: "smith" }, { from: "smith", to: "mintworker" },
  { from: "gold", to: "mintworker", dashed: true },
  { from: "smith", to: "smith1" }, { from: "smith1", to: "smith2" },
  { from: "smith2", to: "weaponHut" }, { from: "mintworker", to: "mint" },
  { from: "druid", to: "alch1" }, { from: "alch1", to: "alch2" }, { from: "druid", to: "temple" },

  { from: "farmer", to: "mill" }, { from: "mill", to: "miller" },
  { from: "miller", to: "bakery1" }, { from: "bakery1", to: "baker" },
  { from: "baker", to: "bakery2" }, { from: "baker", to: "brewer" }, { from: "brewer", to: "brewery" },

  { from: "hunter", to: "tailor" }, { from: "hunter", to: "stockfarmer" },
  { from: "tailor", to: "tailor1" }, { from: "tailor1", to: "tailor2" }, { from: "stockfarmer", to: "cattle" },
  { from: "carrier", to: "warehouse" }, { from: "warehouse", to: "merchant" },
];

const BUILDING_NODES: Partial<Record<string, PlaceableBuildingKind>> = {
  house: "house",
  farmBuilding: "farm",
  well: "well",
  warehouse: "warehouse",
  sawmill: "sawmill",
  carp1: "carpenter",
  mill: "mill",
  bakery1: "bakery",
  pot1: "pottery",
  mason1: "stonemason",
};

const BUILDING_LABELS: Record<PlaceableBuildingKind, string> = {
  warehouse: "Lager",
  house: "Wohnhaus",
  farm: "Farm",
  sawmill: "Sägewerk",
  carpenter: "Schreinerei",
  mill: "Mühle",
  bakery: "Bäckerei",
  well: "Brunnen",
  pottery: "Töpferei",
  stonemason: "Steinmetzhütte",
};

const NODE_WIDTH = 210;
const NODE_HEIGHT = 58;
const CANVAS_WIDTH = 2320;
const CANVAS_HEIGHT = 1540;

const edgeMarkup = (): string => EDGES.map((edge) => {
  const from = NODES.find((node) => node.id === edge.from)!;
  const to = NODES.find((node) => node.id === edge.to)!;
  const x1 = from.x + NODE_WIDTH;
  const y1 = from.y + NODE_HEIGHT / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_HEIGHT / 2;
  const mid = x1 + Math.max(40, (x2 - x1) / 2);
  return `<path d="M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}" data-tech-to="${edge.to}" ${edge.dashed ? 'class="tech-tree-edge dashed"' : 'class="tech-tree-edge"'} />`;
}).join("");

const nodeMarkup = (): string => NODES.map((node) => `
  <div class="tech-tree-node ${node.kind}" style="left:${node.x}px;top:${node.y}px" data-node="${node.id}">
    <strong>${node.label}</strong>
    ${node.subtitle ? `<span class="tech-tree-subtitle">${node.subtitle}</span>` : ""}
    <span class="tech-tree-status"></span>
  </div>`).join("");

const legendMarkup = (): string => `
  <aside class="technology-tree-legend" aria-label="Legende">
    <strong>Legende</strong>
    <div class="technology-tree-legend-items">
      <span><i class="base" aria-hidden="true"></i>Grundberuf</span>
      <span><i class="profession" aria-hidden="true"></i>Beruf</span>
      <span><i class="building" aria-hidden="true"></i>Gebäude</span>
      <span><i class="resource" aria-hidden="true"></i>Ressource / Erfahrung</span>
      <span><i class="state-unlocked" aria-hidden="true"></i>freigeschaltet</span>
      <span><i class="state-locked" aria-hidden="true"></i>gesperrt</span>
      <span><i class="state-planned" aria-hidden="true"></i>noch nicht implementiert</span>
    </div>
  </aside>`;

const progressionStatus = (
  world: World,
  profession: Profession,
  target: PlaceableBuildingKind,
): NodeStatus => {
  if (isBuildingUnlocked(world, target))
    return { state: "unlocked", text: `✓ ${BUILDING_LABELS[target]} freigeschaltet` };
  const xp = Math.min(TECHNOLOGY_XP_THRESHOLD, maxProfessionExperience(world, profession));
  return {
    state: "progress",
    text: `${PROFESSION_LABELS[profession]} ${xp}/${TECHNOLOGY_XP_THRESHOLD} XP → ${BUILDING_LABELS[target]}`,
  };
};

const professionAvailabilityStatus = (
  world: World,
  requiredBuilding: PlaceableBuildingKind,
): NodeStatus => isBuildingUnlocked(world, requiredBuilding)
  ? { state: "unlocked", text: "✓ Beruf verfügbar" }
  : { state: "locked", text: `🔒 ${BUILDING_LABELS[requiredBuilding]} erforderlich` };

const nodeStatus = (world: World, nodeId: string): NodeStatus => {
  const building = BUILDING_NODES[nodeId];
  if (building) {
    const progress = technologyProgress(world, building);
    if (progress.unlocked) return { state: "unlocked", text: "✓ Freigeschaltet" };
    if (progress.profession) {
      return {
        state: "locked",
        text: `🔒 ${PROFESSION_LABELS[progress.profession]} ${progress.current}/${progress.required} XP`,
      };
    }
    return { state: "locked", text: "🔒 Gesperrt" };
  }

  if (nodeId === "civil" || nodeId === "builder")
    return { state: "unlocked", text: "✓ Verfügbar" };
  if (nodeId === "carrier") return progressionStatus(world, "carrier", "warehouse");
  if (nodeId === "wood") return progressionStatus(world, "woodcutter", "sawmill");
  if (nodeId === "clay") return progressionStatus(world, "clayDigger", "pottery");
  if (nodeId === "stone") return progressionStatus(world, "stonecutter", "stonemason");
  if (nodeId === "farmer") return progressionStatus(world, "farmer", "mill");
  if (nodeId === "sawmillWorker") {
    if (!isBuildingUnlocked(world, "sawmill"))
      return { state: "locked", text: "🔒 Sägewerk erforderlich" };
    return progressionStatus(world, "sawmillWorker", "carpenter");
  }
  if (nodeId === "miller") {
    if (!isBuildingUnlocked(world, "mill"))
      return { state: "locked", text: "🔒 Mühle erforderlich" };
    return progressionStatus(world, "miller", "bakery");
  }
  if (nodeId === "merchant") return professionAvailabilityStatus(world, "warehouse");
  if (nodeId === "potter") return professionAvailabilityStatus(world, "pottery");
  if (nodeId === "mason") return professionAvailabilityStatus(world, "stonemason");
  if (nodeId === "baker") return professionAvailabilityStatus(world, "bakery");

  return { state: "planned", text: "◌ Noch nicht im Prototyp" };
};

export function mountTechnologyTree(world: World): void {
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
      <div><small>FORTSCHRITT</small><strong id="technology-tree-title">Technologiebaum</strong></div>
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
      ${legendMarkup()}
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

  const refreshStatuses = (): void => {
    const states = new Map<string, NodeState>();
    for (const node of NODES) {
      const status = nodeStatus(world, node.id);
      states.set(node.id, status.state);
      const element = canvas.querySelector<HTMLElement>(`[data-node="${node.id}"]`);
      if (!element) continue;
      element.classList.remove("unlocked", "progress", "locked", "planned");
      element.classList.add(status.state);
      element.querySelector<HTMLElement>(".tech-tree-status")!.textContent = status.text;
    }
    canvas.querySelectorAll<SVGPathElement>("[data-tech-to]").forEach((edge) => {
      const state = states.get(edge.dataset.techTo ?? "") ?? "planned";
      edge.classList.toggle("locked", state === "locked" || state === "progress");
      edge.classList.toggle("planned", state === "planned");
    });
  };

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
    refreshStatuses();
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

  window.setInterval(() => {
    if (!overlay.hidden) refreshStatuses();
  }, 250);

  window.addEventListener(BUILD_MODE_EVENT, () => setOpen(false));
  window.addEventListener(MERCHANT_TARGET_MODE_EVENT, () => setOpen(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.hidden) setOpen(false);
  });

  refreshStatuses();
  renderTransform();
}
