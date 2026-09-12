import type { BuildableBuildingKind, Good, World } from "../simulation/model";
import { CONSTRUCTION_PLANS } from "../simulation/buildingPlacement";
import { GOODS } from "../simulation/simulation";
import { GOOD_ICONS, buildingIcon } from "../icons";

const TILE_SELECTED_EVENT = "poc-tile-selected";
const BUILD_MODE_EVENT = "poc-build-mode";
const BUILDING_SELECTED_EVENT = "poc-building-selected";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";

const BUILDING_NAMES: Record<BuildableBuildingKind, string> = {
  warehouse: "Lager",
  house: "Wohnhaus",
  farm: "Farm",
  sawmill: "Sägewerk",
  carpenter: "Schreinerei",
  mill: "Mühle",
  bakery: "Bäckerei",
  well: "Brunnen",
};

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

const constructionCost = (kind: BuildableBuildingKind): string =>
  (Object.entries(CONSTRUCTION_PLANS[kind].required) as [Good, number | undefined][])
    .filter((entry): entry is [Good, number] => entry[1] !== undefined)
    .map(([good, amount]) => `<span class="build-menu-cost-item"><span aria-hidden="true">${GOOD_ICONS[good]}</span>${amount} ${GOODS[good]}</span>`)
    .join("");

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
        <div><small>BAUMENÜ</small><strong>Gebäude bauen</strong></div>
        <button id="build-menu-close" type="button" aria-label="Baumenü schließen">×</button>
      </div>
      <div class="build-menu-list">
        ${(Object.keys(BUILDING_NAMES) as BuildableBuildingKind[])
          .map(
            (kind) => `
              <button class="build-menu-item" type="button" data-build-kind="${kind}">
                <span class="build-menu-building-icon" aria-hidden="true">${buildingIcon(kind)}</span>
                <span class="build-menu-building-copy">
                  <strong>${BUILDING_NAMES[kind]}</strong>
                  <span class="build-menu-cost">${constructionCost(kind)}</span>
                </span>
              </button>`,
          )
          .join("")}
      </div>
    </section>`;

  main.append(menu);

  const toggle = menu.querySelector<HTMLButtonElement>("#build-menu-toggle")!;
  const panel = menu.querySelector<HTMLElement>("#build-menu-panel")!;
  const close = menu.querySelector<HTMLButtonElement>("#build-menu-close")!;

  const setOpen = (open: boolean): void => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.classList.toggle("active", open);
  };

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));

  menu.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-build-kind]");
    if (!button) return;
    const kind = button.dataset.buildKind as BuildableBuildingKind;
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
        selectionPanel.append(temporaryButton);
        legacyBuildButton = temporaryButton;
      }
    }
    legacyBuildButton?.click();
    temporaryButton?.remove();
    const placementTitle = document.querySelector<HTMLElement>("#build-placement-title");
    if (placementTitle) placementTitle.textContent = `${BUILDING_NAMES[kind]} platzieren`;
    setOpen(false);
  });

  window.addEventListener(BUILD_MODE_EVENT, () => setOpen(false));
  window.addEventListener(BUILDING_SELECTED_EVENT, () => setOpen(false));
  window.addEventListener(MERCHANT_TARGET_MODE_EVENT, () => setOpen(false));
}
