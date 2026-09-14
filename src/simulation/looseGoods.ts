import { key, neighbors, tileIndex } from "./hex";
import { hexDistance } from "./spatial";
import type { Good, Hex, LooseGoodStack, LooseGoodStackId, World } from "./model";

export const LOOSE_GOOD_STACK_CAPACITY = 3;

const ensureState = (world: World): LooseGoodStack[] => {
  world.looseGoods ??= [];
  world.nextLooseGoodId ??= 1;
  return world.looseGoods;
};

export const looseGoodStacks = (world: World): LooseGoodStack[] => ensureState(world);

export const looseGoodStack = (
  world: World,
  id: LooseGoodStackId,
): LooseGoodStack | undefined => looseGoodStacks(world).find((stack) => stack.id === id);

export const looseGoodStackAt = (world: World, position: Hex): LooseGoodStack | undefined =>
  looseGoodStacks(world).find((stack) => stack.position.q === position.q && stack.position.r === position.r);

export const availableLooseGoodAmount = (stack: LooseGoodStack): number =>
  Math.max(0, stack.amount - stack.reserved);

/**
 * Loose goods never block movement. This predicate only decides whether a new
 * stack may be physically placed on a cell.
 */
export const canPlaceLooseGoodAt = (world: World, position: Hex, good: Good): boolean => {
  const tile = tileIndex(world.tiles).get(key(position));
  if (!tile) return false;
  if (tile.terrain === "river" || tile.terrain === "mountain" || tile.terrain === "building")
    return false;
  if (world.naturalResources.some((resource) => !resource.depleted && key(resource.position) === key(position)))
    return false;
  const existing = looseGoodStackAt(world, position);
  return !existing || (existing.good === good && existing.amount < LOOSE_GOOD_STACK_CAPACITY);
};

export const placeLooseGood = (
  world: World,
  position: Hex,
  good: Good,
  amount = 1,
): LooseGoodStack | undefined => {
  if (!Number.isInteger(amount) || amount <= 0) return undefined;
  const existing = looseGoodStackAt(world, position);
  if (existing) {
    if (existing.good !== good || existing.amount + amount > LOOSE_GOOD_STACK_CAPACITY) return undefined;
    existing.amount += amount;
    return existing;
  }
  if (amount > LOOSE_GOOD_STACK_CAPACITY || !canPlaceLooseGoodAt(world, position, good)) return undefined;

  ensureState(world);
  const id = world.nextLooseGoodId!;
  world.nextLooseGoodId = id + 1;
  const stack: LooseGoodStack = {
    id: `ground-${id}`,
    position: { ...position },
    good,
    amount,
    reserved: 0,
  };
  world.looseGoods!.push(stack);
  return stack;
};

export const reserveLooseGood = (
  world: World,
  id: LooseGoodStackId,
  amount = 1,
): boolean => {
  if (!Number.isInteger(amount) || amount <= 0) return false;
  const stack = looseGoodStack(world, id);
  if (!stack || availableLooseGoodAmount(stack) < amount) return false;
  stack.reserved += amount;
  return true;
};

export const releaseLooseGoodReservation = (
  world: World,
  id: LooseGoodStackId,
  amount = 1,
): boolean => {
  if (!Number.isInteger(amount) || amount <= 0) return false;
  const stack = looseGoodStack(world, id);
  if (!stack || stack.reserved < amount) return false;
  stack.reserved -= amount;
  return true;
};

export const pickupReservedLooseGood = (
  world: World,
  id: LooseGoodStackId,
  amount = 1,
): boolean => {
  if (!Number.isInteger(amount) || amount <= 0) return false;
  const stack = looseGoodStack(world, id);
  if (!stack || stack.reserved < amount || stack.amount < amount) return false;
  stack.reserved -= amount;
  stack.amount -= amount;
  if (stack.amount === 0)
    world.looseGoods = looseGoodStacks(world).filter((candidate) => candidate.id !== id);
  return true;
};

/**
 * Find where an extractor should deposit one physical unit.
 * Existing compatible non-full stacks always win over empty cells. Ties are
 * deterministic by distance, then axial coordinates / id.
 */
export const findLooseGoodDropPosition = (
  world: World,
  origin: Hex,
  good: Good,
  maxRadius: number,
): Hex | undefined => {
  if (!Number.isInteger(maxRadius) || maxRadius < 0) return undefined;

  const compatible = looseGoodStacks(world)
    .filter(
      (stack) =>
        stack.good === good &&
        stack.amount < LOOSE_GOOD_STACK_CAPACITY &&
        hexDistance(origin, stack.position) <= maxRadius,
    )
    .sort((a, b) =>
      hexDistance(origin, a.position) - hexDistance(origin, b.position) ||
      a.position.q - b.position.q ||
      a.position.r - b.position.r ||
      a.id.localeCompare(b.id),
    )[0];
  if (compatible) return { ...compatible.position };

  const tiles = tileIndex(world.tiles);
  const resourcePositions = new Set(
    world.naturalResources
      .filter((resource) => !resource.depleted)
      .map((resource) => key(resource.position)),
  );
  const stackByPosition = new Map(looseGoodStacks(world).map((stack) => [key(stack.position), stack]));
  const visited = new Set<string>([key(origin)]);
  let frontier: Hex[] = [{ ...origin }];

  for (let distance = 0; distance <= maxRadius; distance += 1) {
    const candidates = frontier
      .filter((position) => {
        const tile = tiles.get(key(position));
        if (!tile) return false;
        if (tile.terrain === "river" || tile.terrain === "mountain" || tile.terrain === "building")
          return false;
        if (resourcePositions.has(key(position))) return false;
        return !stackByPosition.has(key(position));
      })
      .sort((a, b) => a.q - b.q || a.r - b.r);
    if (candidates[0]) return { ...candidates[0] };

    const next: Hex[] = [];
    for (const position of frontier) {
      for (const neighbor of neighbors(position)) {
        const neighborKey = key(neighbor);
        if (visited.has(neighborKey)) continue;
        visited.add(neighborKey);
        if (!tiles.has(neighborKey)) continue;
        next.push(neighbor);
      }
    }
    frontier = next;
  }

  return undefined;
};
