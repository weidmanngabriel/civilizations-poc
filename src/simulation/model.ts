export type Good = "wood" | "plank" | "woodenTool" | "wheat" | "flour" | "water" | "bread" | "fish" | "meat" | "leather" | "wool" | "shoes" | "clay" | "rubble" | "brick" | "stoneBlock" | "roofTile" | "marble";
export type EquipmentGood = "woodenTool" | "shoes";
export type EquipmentSlot = "tool" | "shoes";
export interface EquippedItem {
  good: EquipmentGood;
  durability: number;
  /** Accumulated effective work progress toward the next tool-use wear point. */
  workProgress?: number;
}
export type BuildingId = string;
export type HouseholdId = string;
export type HouseLevel = 1 | 2 | 3 | 4 | 5;
export type Sex = "male" | "female";
export type AgeStage = "child" | "adult";
export type BirthPolicy = "low" | "medium" | "high";
export type ChildVisualStage = "baby" | "child";
export type WaypostId = string;
export type ManagedBuildingKind =
  | "hq"
  | "farm"
  | "sawmill"
  | "carpenter"
  | "mill"
  | "bakery"
  | "well"
  | "pottery"
  | "pottery2"
  | "stonemason"
  | "stonemason2"
  | "tailor"
  | "livestockBreeder"
  | "school"
  | "warehouse"
  | "house";
export type InfrastructureKind = "palisade";
export type BuildingKind = ManagedBuildingKind | InfrastructureKind | "field";
export type BuildableBuildingKind = Exclude<ManagedBuildingKind, "hq" | "house">;
export type NaturalResourceId = string;
export type NaturalResourceKind = "forest" | "clay" | "stone";
export type LooseGoodStackId = string;
export type PlaceableBuildingKind = BuildableBuildingKind | "house";
export type Role = "worker" | "carrier" | "merchant" | "builder";
export type NavigationBlockReason =
  | "workplace"
  | "resource"
  | "food"
  | "sleep"
  | "storage"
  | "construction"
  | "school"
  | "equipment"
  | "work-area"
  | "manual"
  | "destination";
export type EducationRole = "teacher" | "student";
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
  | "stonemason"
  | "tailor"
  | "stockfarmer";
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
  output?: Good;
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
  /** Recipes offered by upgraded production buildings. recipe is the currently active choice. */
  availableRecipes?: Recipe[];
  input: number;
  inputInventory?: Inventory;
  output: number;
  inventory?: Inventory;
  /** Individually tracked used equipment stored alongside fresh counted inventory. */
  storedEquipment?: EquippedItem[];
  construction?: ConstructionState;
  baseTerrain?: "grass" | "road";
  baseTerrains?: Record<string, "grass" | "road">;
  farmId?: BuildingId;
  fieldStage?: FieldStage;
  fieldGrowthProgress?: number;
  /** Livestock type preferred for the next successful breeding cycle. */
  breederNextKind?: "cow" | "sheep";
  /** Animals reserved while the stockfarmer physically gathers both parents. */
  breedingGathering?: {
    kind: "cow" | "sheep";
    parentIds: AnimalId[];
    collectedIds: AnimalId[];
    currentParentId?: AnimalId;
    /** Stable walkable footprint-edge cell used for the current physical handoff. */
    currentEntry?: Hex;
  };
  /** Active breeding cycle owned by this building after both parents arrived. */
  breeding?: {
    kind: "cow" | "sheep";
    parentIds: AnimalId[];
    untilTick: number;
  };
  /** Housing level for residential buildings. Missing means level 1 for compatibility with fixtures. */
  houseLevel?: HouseLevel;
  /** Target level while an in-place residential upgrade is under construction. */
  houseUpgradeTarget?: HouseLevel;
  retired?: boolean;
}
export interface Household {
  id: HouseholdId;
  homeId: BuildingId;
  apartmentIndex: number;
  memberIds: number[];
  /** Last successful birth in this household, used for the family cooldown. */
  lastBirthTick?: number;
  /** Next tick on which this household may run a birth-policy check. */
  nextBirthCheckTick?: number;
}

export interface FamilyTask {
  kind: "partner-search" | "birth";
  partnerId: number;
  /** Birth journeys require both parents to reach their shared home. */
  homeId?: BuildingId;
  /** Short celebration phase after both parents reached home. */
  completeAtTick?: number;
}

export interface FamilyEffect {
  id: string;
  kind: "birth";
  homeId: BuildingId;
  startedAtTick: number;
  /** Children appear at this tick; presentation shows hearts/stork before it. */
  birthAtTick: number;
  expiresAtTick: number;
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
  /** Stateful used equipment among the physical units in this stack. */
  equipmentItems?: EquippedItem[];
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
  /** Stateful equipment currently carried by this transport trip. */
  equipmentItems?: EquippedItem[];
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
  /** Person is locally returning to a covered work anchor before global food search. */
  returningToNeedAnchor?: boolean;
  needAnchor?: Hex;
  /** Hunter is returning from unrestricted pursuit to the personal flag before global food search. */
  returningToWorkAreaForFood?: boolean;
  foodSource?: BuildingId;
  /** Food kind reserved at a building source. */
  foodGood?: "bread" | "fish" | "meat";
  /** Reserved loose food stack used as a direct food source. */
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
  /** Person is locally returning to a covered work anchor before global sleep search. */
  returningToNeedAnchor?: boolean;
  needAnchor?: Hex;
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
export interface EducationTask {
  role: EducationRole;
  schoolId: BuildingId;
  profession: Profession;
  partnerId: number;
  progressTicks: number;
  active: boolean;
  returnProfession?: Profession;
  returnAssignment?: { building: BuildingId; role: Role };
}

export interface Person {
  id: number;
  position: Hex;
  /** Sex has no gameplay effect except biological partner compatibility for children. */
  sex?: Sex;
  /** Missing is treated as adult for neutral legacy fixtures. */
  ageStage?: AgeStage;
  /** Simulation tick of birth for children. */
  bornAtTick?: number;
  /** Children pick another nearby wander step no earlier than this tick. */
  nextChildWanderTick?: number;
  spouseId?: number;
  parentIds?: number[];
  childIds?: number[];
  /** Another resident temporarily reserves this unmarried resident as a partner candidate. */
  partnerReservedBy?: number;
  /** Family-owned movement suspends normal work without changing profession; hunger and sleep may interrupt it. */
  familyTask?: FamilyTask;
  /** Explicit profession chosen by the player. Legacy worlds may still derive it from assignment flags. */
  profession?: Profession;
  assignment?: { building: BuildingId; role: Role };
  /** Household owning this person's apartment. Missing means currently unhoused. */
  householdId?: HouseholdId;
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
  /** Target locked for the current stationary aiming cycle. */
  huntAimTarget?: AnimalId;
  /** Simulation tick when the current stationary aiming cycle completes. */
  huntAimUntilTick?: number;
  /** Reserved loot stack that this hunter must collect before hunting again. */
  huntLootTarget?: LooseGoodStackId;
  /** Additional reserved loot stacks collected in order after the current one. */
  huntLootQueue?: LooseGoodStackId[];
  /** Simulation tick when the one-second ground pickup completes. */
  huntLootPickupUntilTick?: number;
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
  /** Exactly one outdoor-produced unit currently carried back toward this person's work flag area. */
  outdoorCarry?: Good;
  /** Stable ground cell selected for the current outdoor carried unit. */
  outdoorDropTarget?: Hex;
  /** Simulation tick when the one-second outdoor ground drop completes. */
  outdoorDropUntilTick?: number;
  extractor?: "clay" | "stone";
  resourceTarget?: NaturalResourceId;
  /** Local resource-collection area for extractors and carriers. */
  workArea?: WorkArea;
  /** Reserved stand position while this person has nothing useful to do. */
  idleTarget?: Hex;
  builder?: boolean;
  experience?: Partial<Record<Profession, number>>;
  /** Professions permanently learned through school training. */
  learnedProfessions?: Profession[];
  experienceActionProgress?: Partial<Record<Profession, number>>;
  /** Temporary school lesson. Teacher and student remain physically present while active. */
  educationTask?: EducationTask;
  /** Manually equipped items. */
  equipment?: Partial<Record<EquipmentSlot, EquippedItem>>;
  /** Manual slot preferences survive wear and drive automatic replacement. */
  equipmentPreferences?: Partial<Record<EquipmentSlot, EquipmentGood>>;
  /** Reserved equipment that this person is currently walking to a storage building to collect. */
  equipmentTask?: {
    good: EquipmentGood;
    slot: EquipmentSlot;
    source: BuildingId | LooseGoodStackId;
    sourceKind?: "looseGood";
    sourcePosition: Hex;
    /** Reserved storage item. Ground items remain in their stack until physical pickup. */
    item?: EquippedItem;
  };
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
  /** Player-facing category of the currently blocked destination. */
  navigationBlockedReason?: NavigationBlockReason;
  /** Waypost-network revision for which navigationFailedTargets was computed. */
  navigationFailureRevision?: number;
  /** Required destinations already proven unreachable in the current waypost-network revision. */
  navigationFailedTargets?: string[];
  trip?: Trip;
}
export type AnimalId = string;
export type AnimalGroupId = string;
export type AnimalKind = "hare" | "boar" | "cow" | "sheep";
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
  /** First tick on which the current next step was blocked by another animal. */
  movementBlockedSinceTick?: number;
  fleeingUntilTick?: number;
  fleeFrom?: Hex;
  /** Player ownership is persistent and makes livestock invalid hunting targets. */
  owner?: "player";
  /** Owned livestock is currently walking to its active pasture (HQ or livestock breeder). */
  returningToHq?: boolean;
  /** Simulation tick at which this juvenile reaches full size. Missing means fully grown. */
  matureAtTick?: number;
  /** Simulation tick before which this animal cannot be used for another breeding cycle. */
  breedingCooldownUntilTick?: number;
  /** Building that has reserved this animal for an upcoming breeding cycle. */
  breedingReservedAt?: BuildingId;
  /** Stockfarmer this animal is currently following back to the breeder. */
  followingBreederId?: number;
  /** Building that currently keeps this animal inside during breeding. */
  breedingAt?: BuildingId;
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
  /** Presentation lifetime after impact, persisted with the authoritative projectile. */
  impactLifetimeTicks?: number;
  /** First tick on which impact effects were resolved. */
  resolvedAtTick?: number;
  /** Tick after which the impacted projectile is removed from the world. */
  expiresAtTick?: number;
  hit: boolean;
  rewardProfession?: Profession;
}

export interface FishSchool {
  id: string;
  /** Connected water cells that define where this school can be fished and rendered. */
  region: Hex[];
  fish: number;
  capacity: number;
  /** Next simulated tick that adds one fish while below capacity. */
  nextRegrowTick?: number;
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
  /** Runtime-only invalidation counter for terrain changes rendered by the map cache. */
  terrainRevision?: number;
  /** Runtime-only invalidation counter for bush visibility/state changes. */
  bushRevision?: number;
  /** Loose-good ids are initialized lazily for compatibility with older fixtures. */
  nextLooseGoodId?: number;
  rngState: number;
  /** Last selected simulation speed multiplier. Player worlds persist this in saves. */
  simulationSpeed?: number;
  nextBushRegrowTick?: number;
  /** Missing in neutral/sandbox worlds; explicit in the player-facing progression world. */
  unlockedTechnologies?: string[];
  /** Permanently unlocked residential construction/upgrade levels in progression worlds. */
  unlockedHouseLevels?: HouseLevel[];
  people: Person[];
  /** Residential households. One household occupies exactly one apartment. */
  households?: Household[];
  nextHouseholdId?: number;
  /** Settlement-wide preference controlling autonomous birth checks. */
  birthPolicy?: BirthPolicy;
  /** Short-lived deterministic presentation cues for home birth celebrations. */
  familyEffects?: FamilyEffect[];
  nextFamilyEffectId?: number;
  buildings: Building[];
  naturalResources: NaturalResource[];
  /** Extensible wildlife entities and their social groups. */
  animals?: Animal[];
  animalGroups?: AnimalGroup[];
  /** Finite fish populations attached to connected water regions. */
  fishSchools?: FishSchool[];
  /** In-flight ranged attacks; presentation interpolates these without owning combat state. */
  projectiles?: Projectile[];
  wayposts?: Waypost[];
  /** Physical goods lying on map cells. Stacks are always walkable and never affect routing. */
  looseGoods?: LooseGoodStack[];
  tiles: Tile[];
}
