export type Good = "wood" | "plank" | "woodenTool" | "wheat" | "flour" | "water" | "bread" | "fish" | "clay" | "rubble" | "brick" | "stoneBlock";
export type BuildingId = string;
export type WaypostId = string;
export type BuildingKind = "hq" | "field" | "farm" | "sawmill" | "carpenter" | "mill" | "bakery" | "well" | "pottery" | "stonemason" | "warehouse" | "house";
export type BuildableBuildingKind = Exclude<BuildingKind, "hq" | "field" | "house">;
export type NaturalResourceId = string;
export type NaturalResourceKind = "forest" | "clay" | "stone";
export type LooseGoodStackId = string;
export type PlaceableBuildingKind = BuildableBuildingKind | "house";
export type Role = "worker" | "carrier" | "merchant" | "builder";
export type Profession =
  | "woodcutter"
  | "fisher"
  | "hunter"
  | "scout"
  | "builder"
  | "carrier"
  | "merchant"
  | "farmer"
  | "sawmillWorker"
  | "carpenter"
  | "miller"
  | "baker"
  | "clayDigger"
  | "stonecutter"
  | "potter"
  | "stonemason";
export interface Hex {
  q: number;
  r: number;
}
export interface WorkArea {
  center: Hex;
  radius: number;
  /** Event-driven fallback when no valid local work target currently exists. */
  retryAfterTick?: number;
}
export interface Tile extends Hex {
  terrain: "grass" | "road" | "forest" | "field" | "mountain" | "river" | "building";
  /** Derived collision overlay. Natural resources never change the underlying terrain type. */
  resourceBlocking?: boolean;
  /** Derived collision overlay for editor-authored building cells. */
  buildingBlocking?: boolean;
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
  /** Runtime binding to a validated editor-authored visual/spatial definition. */
  visualDefinitionId?: string;
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
  farmId?: BuildingId;
  fieldStage?: FieldStage;
  fieldGrowthProgress?: number;
  retired?: boolean;
}
export interface Waypost {
  id: WaypostId;
  position: Hex;
  connections?: WaypostId[];
}
export interface NaturalResource {
  id: NaturalResourceId;
  kind: NaturalResourceKind;
  position: Hex;
  remaining: number;
  /** Short-lived extraction output is migrated to physical loose-good stacks after each tick. */
  output: number;
  depleted?: boolean;
}
export interface LooseGoodStack {
  id: LooseGoodStackId;
  position: Hex;
  good: Good;
  /** Physical whole units on this ground cell. Valid range is 1..3. */
  amount: number;
  /** Units already promised to future pickups. Reserved units remain physically present. */
  reserved: number;
}
export interface Trip {
  source: BuildingId | NaturalResourceId | LooseGoodStackId;
  /** Building is the default source kind for compatibility with existing trips. */
  sourceKind?: "resource" | "looseGood";
  /** Stable physical pickup position, especially important after a ground stack is exhausted. */
  sourcePosition?: Hex;
  target: BuildingId;
  good: Good;
  picked: boolean;
  /** Exact simulation tick when the current pickup/dropoff interaction completes. */
  transferUntilTick?: number;
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
  /** Position where this autonomous need search started. */
  needOrigin?: Hex;
  /** True while the current food target was selected through local need navigation. */
  localNeedSearch?: boolean;
  /** Return to needOrigin after eating because the local route left waypost coverage. */
  returnToNeedOrigin?: boolean;
  /** Eating is complete and the person is walking back to needOrigin. */
  returningToNeedOrigin?: boolean;
  foodSource?: BuildingId;
  /** Food kind reserved at a building source. */
  foodGood?: "bread" | "fish";
  /** Reserved loose fish stack used as a direct food source. */
  foodLooseGood?: LooseGoodStackId;
  foodBush?: Hex;
  retryAfterTick?: number;
  /** Exact simulation tick when the five-second eating phase completes. */
  eatingUntilTick?: number;
  resumeActive: boolean;
}
export type SleepLocationKind = "house" | "nature" | "ground";
export interface SleepState {
  /** Position where this autonomous need search started. */
  needOrigin?: Hex;
  /** True while the current sleep target was selected through local need navigation. */
  localNeedSearch?: boolean;
  /** Return to needOrigin after sleeping because the local route left waypost coverage. */
  returnToNeedOrigin?: boolean;
  /** Sleeping is complete and the person is walking back to needOrigin. */
  returningToNeedOrigin?: boolean;
  kind: SleepLocationKind;
  target: Hex;
  progress: number;
  completedPhases: 0 | 1;
  recoveryPerPhase: number;
  resumeActive: boolean;
  resumeAssignment?: { building: BuildingId; role: Role };
  resumeBuilder: boolean;
  resumeWoodcutter: boolean;
  resumeFisher?: boolean;
  resumeExtractor?: "clay" | "stone";
  resumeResourceTarget?: NaturalResourceId;
}
export interface Person {
  id: number;
  position: Hex;
  /** Explicit profession chosen by the player. Legacy worlds may still derive it from assignment flags. */
  profession?: Profession;
  assignment?: { building: BuildingId; role: Role };
  /** Personally assigned home. */
  home?: BuildingId;
  /** Temporary direct movement order; normal autonomous work resumes after arrival. */
  manualMoveTarget?: Hex;
  /** Explicit scout order to walk to a target and erect a waypost there. */
  scoutWaypostTask?: { target: Hex; buildProgress: number };
  merchantRoute?: MerchantRoute;
  farmTask?: FarmTask;
  woodcutter?: boolean;
  fisher?: boolean;
  hunter?: boolean;
  /** Current wild-animal target for autonomous hunting. */
  huntTarget?: AnimalId;
  /** Earliest simulation tick at which another ranged attack may start. */
  nextRangedAttackTick?: number;
  /** Current shoreline cell used for the active or next fishing cycle. */
  fishingSpot?: Hex;
  /** Adjacent water cell used by the visible fishing line/hook. */
  fishingWaterTarget?: Hex;
  /** Simulation tick at which the current five-second fishing cycle started. */
  fishingStartedAtTick?: number;
  /** Simulation tick at which the current fishing cycle finishes and the line is reeled in. */
  fishingWaitUntilTick?: number;
  /** Exactly one outdoor-produced unit currently carried back to this person's work flag. */
  outdoorCarry?: Good;
  extractor?: "clay" | "stone";
  resourceTarget?: NaturalResourceId;
  /** Local resource-collection area for extractors and carriers. */
  workArea?: WorkArea;
  /** Reserved stand position while this person has nothing useful to do. */
  idleTarget?: Hex;
  builder?: boolean;
  experience?: Partial<Record<Profession, number>>;
  experienceActionProgress?: Partial<Record<Profession, number>>;
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
  /** True while a required destination cannot be reached through the waypost network. */
  navigationBlocked?: boolean;
  /** Waypost-network revision for which navigationFailedTargets was computed. */
  navigationFailureRevision?: number;
  /** Required destinations already proven unreachable in the current waypost-network revision. */
  navigationFailedTargets?: string[];
  trip?: Trip;
}
export type AnimalId = string;
export type AnimalGroupId = string;
export type AnimalKind = "hare";
export interface AnimalGroup {
  id: AnimalGroupId;
  kind: AnimalKind;
  home: Hex;
  /** Soft migration target shared by the group. Individuals only bias slightly toward it. */
  target?: Hex;
  /** Tick when a new group target should be chosen. */
  nextTargetTick?: number;
  /** Last preferred migration direction, used to avoid random 180° turns at every target update. */
  migrationDirection?: Hex;
}
export interface Animal {
  id: AnimalId;
  kind: AnimalKind;
  groupId: AnimalGroupId;
  position: Hex;
  path: Hex[];
  movement: number;
  nextMoveTick: number;
  fleeingUntilTick?: number;
  fleeFrom?: Hex;
}
export type ProjectileKind = "arrow";
export type RangedEntityRef =
  | { kind: "person"; id: number }
  | { kind: "animal"; id: AnimalId };
export interface Projectile {
  id: string;
  kind: ProjectileKind;
  source: RangedEntityRef;
  target: RangedEntityRef;
  start: Hex;
  targetPosition: Hex;
  startedAtTick: number;
  impactAtTick: number;
  hit: boolean;
  rewardProfession?: Profession;
}

export interface World {
  round: number;
  nextId: number;
  nextBuildingId: number;
  nextFieldId: number;
  nextWaypostId?: number;
  nextAnimalId?: number;
  nextAnimalGroupId?: number;
  nextProjectileId?: number;
  /** Incremented whenever the waypost network changes, invalidating failed-route caches. */
  waypostRevision?: number;
  /** Loose-good ids are initialized lazily for compatibility with older fixtures. */
  nextLooseGoodId?: number;
  rngState: number;
  nextBushRegrowTick?: number;
  /** Missing in neutral/sandbox worlds; explicit in the player-facing progression world. */
  unlockedTechnologies?: string[];
  people: Person[];
  buildings: Building[];
  naturalResources: NaturalResource[];
  /** Extensible wildlife entities and their social groups. */
  animals?: Animal[];
  animalGroups?: AnimalGroup[];
  /** In-flight ranged attacks; presentation interpolates these without owning combat state. */
  projectiles?: Projectile[];
  wayposts?: Waypost[];
  /** Physical goods lying on map cells. Stacks are always walkable and never affect routing. */
  looseGoods?: LooseGoodStack[];
  tiles: Tile[];
}
