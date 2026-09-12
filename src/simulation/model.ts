export type Good = "wood" | "plank" | "woodenTool" | "wheat" | "flour" | "water" | "bread";
export type BuildingId = string;
export type BuildingKind = "hq" | "forest" | "field" | "farm" | "sawmill" | "carpenter" | "mill" | "bakery" | "well" | "warehouse" | "house";
export type BuildableBuildingKind = Exclude<BuildingKind, "hq" | "forest" | "field" | "house">;
export type PlaceableBuildingKind = BuildableBuildingKind | "house";
export type Role = "worker" | "carrier" | "merchant" | "builder";
export type Profession =
  | "woodcutter"
  | "builder"
  | "carrier"
  | "merchant"
  | "farmer"
  | "sawmillWorker"
  | "carpenter"
  | "miller"
  | "baker";
export interface Hex {
  q: number;
  r: number;
}
export interface Tile extends Hex {
  terrain: "grass" | "road" | "forest" | "field" | "mountain" | "river" | "building";
  trafficTicks?: number[];
  bush?: boolean;
  bushAvailable?: boolean;
  bushRegrowTick?: number;
}
export interface Recipe {
  input?: Good;
  inputs?: GoodAmounts;
  amount: number;
  output: Good;
  outputAmount?: number;
  duration: number;
}
export type Inventory = Partial<Record<Good, number>>;
export type GoodAmounts = Partial<Record<Good, number>>;
export interface ConstructionState {
  required: GoodAmounts;
  delivered: GoodAmounts;
  duration: number;
  progress: number;
  complete: boolean;
}
export type FieldStage = 1 | 2 | 3 | 4;
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
  inputInventory?: Inventory;
  output: number;
  inventory?: Inventory;
  construction?: ConstructionState;
  baseTerrain?: "grass" | "road";
  baseTerrains?: Record<string, "grass" | "road">;
  forestRemaining?: number;
  farmId?: BuildingId;
  fieldStage?: FieldStage;
  fieldGrowthProgress?: number;
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
export interface FarmTask {
  kind: "sow" | "fertilize" | "harvest";
  target: Hex;
  fieldId?: BuildingId;
  progress: number;
  outputMultiplier?: number;
}
export interface HungerState {
  foodSource?: BuildingId;
  foodBush?: Hex;
  retryAfterTick?: number;
  resumeActive: boolean;
}
export type SleepLocationKind = "house" | "nature" | "ground";
export interface SleepState {
  kind: SleepLocationKind;
  target: Hex;
  progress: number;
  completedPhases: 0 | 1;
  recoveryPerPhase: number;
  resumeActive: boolean;
  resumeAssignment?: { building: BuildingId; role: Role };
  resumeBuilder: boolean;
  resumeWoodcutter: boolean;
}
export interface Person {
  id: number;
  position: Hex;
  assignment?: { building: BuildingId; role: Role };
  merchantRoute?: MerchantRoute;
  farmTask?: FarmTask;
  woodcutter?: boolean;
  builder?: boolean;
  experience?: Partial<Record<Profession, number>>;
  pendingFarmBonus?: number;
  hunger?: number;
  hungerAccumulator?: number;
  hungerState?: HungerState;
  sleep?: number;
  sleepAccumulator?: number;
  sleepState?: SleepState;
  sleepGraceTicks?: number;
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
  nextFieldId: number;
  rngState: number;
  people: Person[];
  buildings: Building[];
  tiles: Tile[];
}
