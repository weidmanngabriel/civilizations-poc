import type { Good, GoodAmounts, PlaceableBuildingKind } from "./model";

export const BUILDING_CONSTRUCTION_REQUIREMENTS: Record<PlaceableBuildingKind, GoodAmounts> = {
  warehouse: { wood: 4 },
  house: { wood: 4 },
  farm: { wood: 4 },
  sawmill: { wood: 6 },
  carpenter: { plank: 4 },
  mill: { wood: 4 },
  bakery: { plank: 2, brick: 2 },
  well: { wood: 2, stoneBlock: 2 },
  pottery: { wood: 4 },
  pottery2: { wood: 6, rubble: 2, brick: 2 },
  stonemason: { wood: 4 },
  stonemason2: { wood: 6, rubble: 2, stoneBlock: 2 },
  tailor: { wood: 4 },
  livestockBreeder: { wood: 4 },
};

/** Construction goods that come directly from extraction and need no processing building. */
export const RAW_CONSTRUCTION_GOODS = new Set<Good>(["wood", "clay", "rubble"]);

/** Processing building that makes each processed construction good. */
export const CONSTRUCTION_GOOD_PRODUCERS: Partial<Record<Good, PlaceableBuildingKind>> = {
  plank: "sawmill",
  brick: "pottery",
  stoneBlock: "stonemason",
};

export function requiredProductionBuildings(kind: PlaceableBuildingKind): PlaceableBuildingKind[] {
  const requirements = BUILDING_CONSTRUCTION_REQUIREMENTS[kind];
  const producers = new Set<PlaceableBuildingKind>();

  for (const [good, amount] of Object.entries(requirements) as [Good, number | undefined][]) {
    if (!amount || amount <= 0 || RAW_CONSTRUCTION_GOODS.has(good)) continue;
    const producer = CONSTRUCTION_GOOD_PRODUCERS[good];
    if (!producer)
      throw new Error(`Keine Produktionsstätte für verarbeitete Bauware ${good} definiert.`);
    producers.add(producer);
  }

  return [...producers];
}
