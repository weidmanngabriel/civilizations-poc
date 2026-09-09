export type Good = "wood" | "plank" | "woodenTool";
export type BuildingId = string;
export type BuildingKind = "hq" | "forest" | "sawmill" | "carpenter" | "warehouse";
export type BuildableBuildingKind = Exclude<BuildingKind, "hq" | "forest">;
export type Role = "worker" | "carrier" | "merchant";
export interface Hex {
  q: number;
  r: number;
}
export interface Tile extends Hex {
  terrain: "grass" | "road" | "forest" | "mountain" | "river" | "building";
  trafficTicks?: number[];
}
export interface Recipe {
  input?: Good;
  amount: number;
  output: Good;
  duration: number;
}
export type Inventory = Record<Good, number>;
export interface Building {
  id: BuildingId;
  kind: BuildingKind;
  name: string;
  position: Hex;
  footprint?: Hex[];
  workers: number;
  carriers: number;
  merchants?: number;
  recipe?: Recipe;
  input: number;
  output: number;
  inventory?: Inventory;
  baseTerrain?: "grass" | "road";
  baseTerrains?: Record<string, "grass" | "road">;
  forestRemaining?: number;
  retired?: boolean;
}
export interface Trip {
  source: BuildingId;
  target: BuildingId;
  good: Good;
  picked: boolean;
}
export interface MerchantRoute {
  target?: BuildingId;
  good: Good;
}
export interface Person {
  id: number;
  position: Hex;
  assignment?: { building: BuildingId; role: Role };
  merchantRoute?: MerchantRoute;
  woodcutter?: boolean;
  active: boolean;
  progress: number;
  movement: number;
  path: Hex[];
  trip?: Trip;
}
export interface World {
  round: number;
  nextId: number;
  nextForestId: number;
  nextBuildingId: number;
  rngState: number;
  people: Person[];
  buildings: Building[];
  tiles: Tile[];
}
