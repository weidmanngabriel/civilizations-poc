import type { Good, World } from "../simulation/model";
import { CONFIG } from "../simulation/scenario";
import { storageGoodStock } from "../simulation/equipment";
import { GOOD_ICONS } from "../icons";
import { GOODS } from "../simulation/simulation";

const BUILDING_SELECTED_EVENT = "poc-building-selected";
const TILE_SELECTED_EVENT = "poc-tile-selected";
const SELECTION_CLEARED_EVENT = "poc-building-selection-cleared";
const ALL_GOODS = Object.keys(GOODS) as Good[];

export function installHqStoragePanel(world: World): void {
  const panel = document.querySelector<HTMLElement>("#selection-panel");
  if (!panel) return;

  let hqSelected = false;
  let renderQueued = false;

  const update = () => {
    if (!hqSelected || panel.hidden) return;
    const hq = world.buildings.find((building) => building.id === "hq");
    const addon = panel.querySelector<HTMLElement>("[data-hq-storage-addon]");
    if (!hq || !addon) return;

    for (const good of ALL_GOODS) {
      const target = addon.querySelector<HTMLElement>(`[data-hq-good="${good}"]`);
      if (target)
        target.textContent = `${Math.round(storageGoodStock(hq, good))}/${CONFIG.warehouseCapacityPerGood}`;
    }

    const cows = (world.animals ?? []).filter(
      (animal) => animal.kind === "cow" && animal.owner === "player",
    ).length;
    const sheep = (world.animals ?? []).filter(
      (animal) => animal.kind === "sheep" && animal.owner === "player",
    ).length;
    const cowCount = addon.querySelector<HTMLElement>("[data-hq-cows]");
    const sheepCount = addon.querySelector<HTMLElement>("[data-hq-sheep]");
    if (cowCount) cowCount.textContent = String(cows);
    if (sheepCount) sheepCount.textContent = String(sheep);

    const carriers = world.people.filter(
      (person) => person.assignment?.building === hq.id && person.assignment.role === "carrier",
    );
    const active = carriers.filter((person) => person.active || person.path.length > 0 || person.trip).length;
    const free = world.people.filter(
      (person) => !person.assignment && !person.woodcutter && !person.fisher && !person.extractor && !person.builder,
    ).length;
    const count = addon.querySelector<HTMLElement>("[data-hq-carrier-count]");
    const activeCount = addon.querySelector<HTMLElement>("[data-hq-carrier-active]");
    const minus = addon.querySelector<HTMLButtonElement>('button[data-delta="-1"]');
    const plus = addon.querySelector<HTMLButtonElement>('button[data-delta="1"]');
    if (count) count.textContent = `${carriers.length}/${hq.carriers}`;
    if (activeCount) activeCount.textContent = String(active);
    if (minus) minus.disabled = carriers.length === 0;
    if (plus) plus.disabled = carriers.length >= hq.carriers || free === 0;
  };

  const render = () => {
    renderQueued = false;
    if (!hqSelected || panel.hidden) return;
    if (!panel.querySelector("[data-hq-storage-addon]")) {
      const inventory = ALL_GOODS.map(
        (good) => `<div><span><button type="button" class="good-label wiki-link" data-wiki-good="${good}"><span aria-hidden="true">${GOOD_ICONS[good]}</span><span>${GOODS[good]}</span></button></span><strong data-hq-good="${good}"></strong></div>`,
      ).join("");
      panel.insertAdjacentHTML(
        "beforeend",
        `<div data-hq-storage-addon><div class="assignment"><div>Träger<small><span data-hq-carrier-active></span> aktiv</small></div><div class="stepper"><button data-action="assignment" data-building="hq" data-role="carrier" data-delta="-1" aria-label="Hauptquartier: Träger verringern">−</button><output data-hq-carrier-count></output><button data-action="assignment" data-building="hq" data-role="carrier" data-delta="1" aria-label="Hauptquartier: Träger erhöhen">+</button></div></div><p class="recipe">Viehbestand · 🐄 <strong data-hq-cows>0</strong> Kühe · 🐑 <strong data-hq-sheep>0</strong> Schafe</p><p class="recipe">HQ-Lager · bis zu ${CONFIG.warehouseCapacityPerGood} Einheiten je Warentyp</p><div class="inventory">${inventory}</div></div>`,
      );
    }
    update();
  };

  const queueRender = () => {
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(render);
  };

  window.addEventListener(BUILDING_SELECTED_EVENT, (event) => {
    hqSelected = (event as CustomEvent<{ id: string }>).detail.id === "hq";
    queueRender();
  });
  window.addEventListener(TILE_SELECTED_EVENT, () => {
    hqSelected = false;
  });
  window.addEventListener(SELECTION_CLEARED_EVENT, () => {
    hqSelected = false;
  });

  new MutationObserver(() => {
    if (hqSelected && !panel.querySelector("[data-hq-storage-addon]")) queueRender();
  }).observe(panel, { childList: true });

  window.setInterval(update, 250);
}
