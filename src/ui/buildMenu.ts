import type { Good, HouseLevel, PlaceableBuildingKind, World } from "../simulation/model";
import { CONSTRUCTION_PLANS } from "../simulation/buildingPlacement";
import { GOODS } from "../simulation/simulation";
import { isBuildingUnlocked, isHouseLevelUnlocked } from "../simulation/technology";
import { GOOD_ICONS, buildingIcon } from "../icons";
import { HOUSE_LEVELS, houseDirectCost } from "../simulation/housing";

const TILE_SELECTED_EVENT = "poc-tile-selected";
const BUILD_MODE_EVENT = "poc-build-mode";
const BUILDING_SELECTED_EVENT = "poc-building-selected";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";
const UI_MENU_OPENED_EVENT = "poc-ui-menu-opened";

type BuildMenuKind = PlaceableBuildingKind | "palisade";

const BUILDING_NAMES: Record<BuildMenuKind, string> = {
  warehouse: "Lager",
  house: "Wohnhaus",
  farm: "Farm",
  sawmill: "Sägewerk",
  carpenter: "Schreinerei",
  mill: "Mühle",
  bakery: "Bäckerei",
  well: "Brunnen",
  pottery: "Töpferei",
  pottery2: "Töpferei 2",
  stonemason: "Steinmetzhütte",
  stonemason2: "Steinmetzhütte 2",
  tailor: "Näherei",
  livestockBreeder: "Viehzüchterei",
  school: "Schule",
  palisade: "Palisade",
};

const SORTED_BUILDING_KINDS = (Object.keys(BUILDING_NAMES) as BuildMenuKind[])
  .sort((a, b) => BUILDING_NAMES[a].localeCompare(BUILDING_NAMES[b], "de"));

let allowNextTileSelection = false;

export function installTileSelectionGuard(): void {
  window.addEventListener(TILE_SELECTED_EVENT, (event) => {
    if (allowNextTileSelection) {
      allowNextTileSelection = false;
      return;
    }
    event.stopImmediatePropagation();
  });
}

const constructionCost = (kind: BuildMenuKind, houseLevel?: HouseLevel): string =>
  (Object.entries(
    kind === "palisade"
      ? { wood: 1 }
      : kind === "house"
        ? houseDirectCost(houseLevel ?? 1)
        : CONSTRUCTION_PLANS[kind].required,
  ) as [Good, number | undefined][])
    .filter((entry): entry is [Good, number] => entry[1] !== undefined)
    .map(([good, amount]) => `<button type="button" class="build-menu-cost-item wiki-link" data-wiki-good="${good}"><span aria-hidden="true">${GOOD_ICONS[good]}</span>${amount} ${GOODS[good]}</button>`)
    .join("");

const buildMenuEntry = (kind: BuildMenuKind, houseLevel?: HouseLevel): string => {
  const level = kind === "house" ? houseLevel ?? 1 : undefined;
  const label = level ? `Wohnhaus ${level}` : BUILDING_NAMES[kind];
  const levelData = level ? ` data-house-level="${level}"` : "";
  return `
    <div class="build-menu-item" data-build-entry="${kind}"${levelData}>
      <button class="build-menu-place" type="button" data-build-kind="${kind}"${levelData} aria-label="${label} bauen">
        <span class="build-menu-building-icon" aria-hidden="true">${buildingIcon(kind)}</span>
        <span class="build-menu-building-copy">
          <strong>${label}</strong>
          <span class="build-menu-place-hint">Platzieren</span>
        </span>
      </button>
      <button class="build-menu-info wiki-link" type="button" data-wiki-building="${kind}" aria-label="Wiki: ${BUILDING_NAMES[kind]}">?</button>
      <span class="build-menu-cost">${constructionCost(kind, level)}</span>
    </div>`;
};

export function mountBuildMenu(world: World): void {
  const main = document.querySelector<HTMLElement>("main");
  if (!main) return;

  const menu = document.createElement("aside");
  menu.className = "build-menu-shell";
  menu.innerHTML = `
    <nav class="left-menu" aria-label="Spielmenü">
      <button id="build-menu-toggle" class="left-menu-button" type="button" aria-expanded="false" aria-controls="build-menu-panel">
        <span class="left-menu-button-icon" aria-hidden="true">${buildingIcon("warehouse")}</span>
        <span class="left-menu-button-label">Bauen</span>
      </button>
    </nav>
    <section id="build-menu-panel" class="build-menu-panel" hidden>
      <div class="build-menu-header">
        <div><small>BAUMENÜ</small><strong>Bauen & platzieren</strong></div>
        <button id="build-menu-close" type="button" aria-label="Baumenü schließen">×</button>
      </div>
      <div class="build-menu-list">
        ${SORTED_BUILDING_KINDS
          .flatMap((kind) =>
            kind === "house"
              ? HOUSE_LEVELS.map((level) => buildMenuEntry(kind, level))
              : [buildMenuEntry(kind)],
          )
          .join("")}
      </div>
    </section>`;

  main.append(menu);

  const toggle = menu.querySelector<HTMLButtonElement>("#build-menu-toggle")!;
  const panel = menu.querySelector<HTMLElement>("#build-menu-panel")!;
  const close = menu.querySelector<HTMLButtonElement>("#build-menu-close")!;

  const refreshAvailability = (): void => {
    menu.querySelectorAll<HTMLElement>("[data-build-entry]").forEach((entry) => {
      const kind = entry.dataset.buildEntry as BuildMenuKind;
      const houseLevel = kind === "house" && entry.dataset.houseLevel
        ? Number(entry.dataset.houseLevel) as HouseLevel
        : undefined;
      entry.hidden =
        kind !== "palisade" &&
        (kind === "house" && houseLevel
          ? !isHouseLevelUnlocked(world, houseLevel)
          : !isBuildingUnlocked(world, kind));
    });
  };

  const setOpen = (open: boolean): void => {
    if (open) {
      window.dispatchEvent(new CustomEvent(UI_MENU_OPENED_EVENT, { detail: { menu: "build" } }));
      refreshAvailability();
    }
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.classList.toggle("active", open);
  };

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));

  menu.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>("button[data-build-kind]");
    if (!button || button.hidden) return;
    const kind = button.dataset.buildKind as BuildMenuKind;
    const houseLevel = kind === "house" && button.dataset.houseLevel
      ? Number(button.dataset.houseLevel) as HouseLevel
      : undefined;
    if (
      kind !== "palisade" &&
      (kind === "house" && houseLevel
        ? !isHouseLevelUnlocked(world, houseLevel)
        : !isBuildingUnlocked(world, kind))
    ) return;
    const launcherTile = world.tiles.find((tile) => tile.terrain === "grass" || tile.terrain === "road");
    if (!launcherTile) return;

    allowNextTileSelection = true;
    window.dispatchEvent(new CustomEvent(TILE_SELECTED_EVENT, {
      detail: { position: { q: launcherTile.q, r: launcherTile.r } },
    }));

    let legacyBuildButton = document.querySelector<HTMLButtonElement>(
      `#selection-panel button[data-action="build"][data-kind="${kind}"]`,
    );
    let temporaryButton: HTMLButtonElement | undefined;
    if (!legacyBuildButton) {
      const selectionPanel = document.querySelector<HTMLElement>("#selection-panel");
      if (selectionPanel) {
        temporaryButton = document.createElement("button");
        temporaryButton.type = "button";
        temporaryButton.hidden = true;
        temporaryButton.dataset.action = "build";
        temporaryButton.dataset.kind = kind;
        if (houseLevel) temporaryButton.dataset.houseLevel = String(houseLevel);
        selectionPanel.append(temporaryButton);
        legacyBuildButton = temporaryButton;
      }
    }
    legacyBuildButton?.click();
    temporaryButton?.remove();
    const placementTitle = document.querySelector<HTMLElement>("#build-placement-title");
    if (placementTitle)
      placementTitle.textContent = kind === "house" && houseLevel
        ? `Wohnhaus ${houseLevel} platzieren`
        : `${BUILDING_NAMES[kind]} platzieren`;
    setOpen(false);
  });

  window.setInterval(() => {
    if (!panel.hidden) refreshAvailability();
  }, 250);

  window.addEventListener(BUILD_MODE_EVENT, () => setOpen(false));
  window.addEventListener(BUILDING_SELECTED_EVENT, () => setOpen(false));
  window.addEventListener(MERCHANT_TARGET_MODE_EVENT, () => setOpen(false));
  refreshAvailability();
}
