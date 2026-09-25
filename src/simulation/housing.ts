import type {
  Building,
  BuildingId,
  Good,
  GoodAmounts,
  Household,
  HouseholdId,
  HouseLevel,
  Person,
  World,
} from "./model";

export type HouseLevelDefinition = {
  apartments: number;
  /** Materials added by this level. Level 1 is the initial construction cost. */
  upgradeCost: GoodAmounts;
  /** Reserved extension point for later comfort/prestige/family effects. */
  benefits: readonly string[];
};

export const HOUSE_LEVEL_DEFINITIONS: Record<HouseLevel, HouseLevelDefinition> = {
  1: {
    apartments: 2,
    upgradeCost: { rubble: 2, wood: 2, wheat: 1, clay: 2 },
    benefits: [],
  },
  2: {
    apartments: 3,
    upgradeCost: { wood: 2, brick: 2 },
    benefits: [],
  },
  3: {
    apartments: 4,
    upgradeCost: { wood: 2, brick: 1, stoneBlock: 3 },
    benefits: [],
  },
  4: {
    apartments: 5,
    upgradeCost: { wood: 2, brick: 1, stoneBlock: 1, roofTile: 4 },
    benefits: [],
  },
  5: {
    apartments: 6,
    upgradeCost: { wood: 2, brick: 1, stoneBlock: 1, roofTile: 1, marble: 5 },
    benefits: [],
  },
};

export const HOUSE_LEVELS: readonly HouseLevel[] = [1, 2, 3, 4, 5];

const usableHouse = (building: Building): boolean =>
  building.kind === "house" &&
  !building.retired &&
  (!building.construction ||
    building.construction.complete ||
    building.houseUpgradeTarget !== undefined);

export const houseLevel = (building: Building): HouseLevel =>
  building.kind === "house" ? (building.houseLevel ?? 1) : 1;

export const houseApartmentCount = (building: Building): number =>
  building.kind === "house" ? HOUSE_LEVEL_DEFINITIONS[houseLevel(building)].apartments : 0;

export const nextHouseLevel = (building: Building): HouseLevel | undefined => {
  if (building.kind !== "house") return;
  const level = houseLevel(building);
  return level < 5 ? ((level + 1) as HouseLevel) : undefined;
};

export const houseUpgradeCost = (building: Building): GoodAmounts | undefined => {
  const target = nextHouseLevel(building);
  return target ? { ...HOUSE_LEVEL_DEFINITIONS[target].upgradeCost } : undefined;
};

export const houseDirectCost = (level: HouseLevel): GoodAmounts => {
  const total: GoodAmounts = {};
  for (const current of HOUSE_LEVELS) {
    if (current > level) break;
    for (const [good, amount] of Object.entries(
      HOUSE_LEVEL_DEFINITIONS[current].upgradeCost,
    ) as [Good, number | undefined][]) {
      if (!amount) continue;
      total[good] = (total[good] ?? 0) + amount;
    }
  }
  return total;
};

export const households = (world: World): Household[] => (world.households ??= []);

export const householdsForHouse = (world: World, homeId: BuildingId): Household[] =>
  households(world)
    .filter((household) => household.homeId === homeId)
    .sort((a, b) => a.apartmentIndex - b.apartmentIndex);

export const householdForPerson = (
  world: World,
  person: Person,
): Household | undefined =>
  person.householdId
    ? households(world).find((household) => household.id === person.householdId)
    : undefined;

export const homeForPerson = (world: World, person: Person): Building | undefined => {
  const household = householdForPerson(world, person);
  if (!household) return;
  return world.buildings.find(
    (building) => building.id === household.homeId && usableHouse(building),
  );
};

export const freeApartmentIndex = (
  world: World,
  house: Building,
  ignoredHouseholdId?: HouseholdId,
): number | undefined => {
  if (!usableHouse(house)) return;
  const occupied = new Set(
    householdsForHouse(world, house.id)
      .filter((household) => household.id !== ignoredHouseholdId)
      .map((household) => household.apartmentIndex),
  );
  for (let index = 0; index < houseApartmentCount(house); index += 1)
    if (!occupied.has(index)) return index;
  return;
};

export const hasFreeApartment = (world: World, house: Building): boolean =>
  freeApartmentIndex(world, house) !== undefined;

export const validHomes = (world: World, personId?: number): Building[] => {
  const person = personId === undefined
    ? undefined
    : world.people.find((candidate) => candidate.id === personId);
  const household = person ? householdForPerson(world, person) : undefined;

  return world.buildings.filter((building) => {
    if (!usableHouse(building)) return false;
    if (household?.homeId === building.id) return true;
    return freeApartmentIndex(world, building) !== undefined;
  });
};

const familyMembersForNewHousehold = (world: World, person: Person): Person[] => {
  const members = [person];
  const spouse = person.spouseId
    ? world.people.find((candidate) => candidate.id === person.spouseId && !candidate.householdId)
    : undefined;
  if (spouse) members.push(spouse);
  for (const childId of person.childIds ?? []) {
    const child = world.people.find(
      (candidate) =>
        candidate.id === childId &&
        candidate.ageStage === "child" &&
        !candidate.householdId,
    );
    if (child && !members.includes(child)) members.push(child);
  }
  return members;
};

const nextHouseholdId = (world: World): HouseholdId => {
  world.nextHouseholdId ??= 1;
  return `household-${world.nextHouseholdId++}`;
};

/**
 * Assigns a person's whole existing household to a free apartment.
 * Today households are singles; this preserves the correct invariant once families are added.
 */
export function assignPersonHome(
  world: World,
  personId: number,
  buildingId: BuildingId,
): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  const house = world.buildings.find((building) => building.id === buildingId);
  if (!person || !house || !usableHouse(house)) return false;

  const existing = householdForPerson(world, person);
  if (existing?.homeId === house.id) return true;

  const apartmentIndex = freeApartmentIndex(world, house, existing?.id);
  if (apartmentIndex === undefined) return false;

  if (existing) {
    existing.homeId = house.id;
    existing.apartmentIndex = apartmentIndex;
    return true;
  }

  const members = familyMembersForNewHousehold(world, person);
  const household: Household = {
    id: nextHouseholdId(world),
    homeId: house.id,
    apartmentIndex,
    memberIds: members.map((member) => member.id),
  };
  households(world).push(household);
  for (const member of members) member.householdId = household.id;
  return true;
}

export function makePersonUnhoused(world: World, personId: number): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  if (!person?.householdId) return false;
  const household = householdForPerson(world, person);
  person.householdId = undefined;
  if (!household) return true;

  household.memberIds = household.memberIds.filter((id) => id !== person.id);
  if (!household.memberIds.length)
    world.households = households(world).filter((candidate) => candidate.id !== household.id);
  return true;
}

export function releaseHouseholdsForHouse(world: World, buildingId: BuildingId): void {
  const affected = householdsForHouse(world, buildingId);
  if (!affected.length) return;
  const ids = new Set(affected.map((household) => household.id));
  for (const person of world.people)
    if (person.householdId && ids.has(person.householdId)) person.householdId = undefined;
  world.households = households(world).filter((household) => !ids.has(household.id));
}

/**
 * Joins two married adults into one household without creating housing.
 * When both already have apartments, preferredHouseholdId selects which one remains.
 */
export function mergeHouseholdsForMarriage(
  world: World,
  first: Person,
  second: Person,
  preferredHouseholdId?: HouseholdId,
): Household | undefined {
  const firstHousehold = householdForPerson(world, first);
  const secondHousehold = householdForPerson(world, second);

  if (firstHousehold?.id === secondHousehold?.id) {
    if (!firstHousehold) return;
    for (const person of [first, second]) {
      if (!firstHousehold.memberIds.includes(person.id)) firstHousehold.memberIds.push(person.id);
      person.householdId = firstHousehold.id;
    }
    return firstHousehold;
  }

  if (!firstHousehold && !secondHousehold) return;
  const keep =
    firstHousehold && secondHousehold
      ? preferredHouseholdId === secondHousehold.id
        ? secondHousehold
        : firstHousehold
      : firstHousehold ?? secondHousehold!;
  const remove =
    firstHousehold && secondHousehold
      ? keep.id === firstHousehold.id
        ? secondHousehold
        : firstHousehold
      : undefined;

  const memberIds = new Set([
    ...keep.memberIds,
    ...(remove?.memberIds ?? []),
    first.id,
    second.id,
  ]);
  keep.memberIds = [...memberIds];

  for (const person of world.people)
    if (memberIds.has(person.id)) person.householdId = keep.id;

  if (remove)
    world.households = households(world).filter((candidate) => candidate.id !== remove.id);

  return keep;
}

