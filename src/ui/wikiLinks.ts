import type { Good, ManagedBuildingKind } from "../simulation/model";

export const HANDBOOK_OPEN_EVENT = "poc-handbook-open";

export type WikiBuildingKind = ManagedBuildingKind | "palisade";

export const BUILDING_WIKI_LABELS: Record<WikiBuildingKind, string> = {
  hq: "Hauptquartier",
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
  warehouse: "Lager",
  house: "Wohnhaus",
  palisade: "Palisade",
};

export type HandbookTarget =
  | { kind: "good"; id: Good }
  | { kind: "building"; id: WikiBuildingKind }
  | { kind: "page"; id: "goods" | "buildings" };

export const goodWikiButton = (good: Good, label: string): string =>
  `<button type="button" class="wiki-link" data-wiki-good="${good}">${label}</button>`;

export const buildingWikiButton = (kind: WikiBuildingKind, label: string): string =>
  `<button type="button" class="wiki-link" data-wiki-building="${kind}">${label}</button>`;

export const requestHandbookTarget = (target: HandbookTarget): void => {
  window.dispatchEvent(new CustomEvent<HandbookTarget>(HANDBOOK_OPEN_EVENT, { detail: target }));
};
