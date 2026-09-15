import type { NaturalResource, Person, World } from "./model";
import { CONFIG } from "./scenario";
import { extractionSpeedMultiplier } from "./experience";
import { key, same, tileIndex } from "./hex";

type DeferredResourceDepletion = {
  resource: NaturalResource;
  workers: Person[];
};

const resourceIndexCache = new WeakMap<World, Map<string, NaturalResource>>();

const resourceProfession = (
  resource: NaturalResource,
): "woodcutter" | "clayDigger" | "stonecutter" =>
  resource.kind === "forest"
    ? "woodcutter"
    : resource.kind === "clay"
      ? "clayDigger"
      : "stonecutter";

function resourceIndex(world: World): Map<string, NaturalResource> {
  let index = resourceIndexCache.get(world);
  if (!index || index.size !== world.naturalResources.length) {
    index = new Map(world.naturalResources.map((resource) => [resource.id, resource]));
    resourceIndexCache.set(world, index);
  }
  return index;
}

/**
 * The historical core still performs global replanning inside resource retirement.
 * Local work areas own that decision now. A final local extraction temporarily keeps
 * one sentinel unit so the expensive legacy cleanup path is skipped.
 */
export function deferLocalResourceDepletion(
  world: World,
): DeferredResourceDepletion[] {
  let resourcesById: Map<string, NaturalResource> | undefined;
  let deferredById: Map<string, DeferredResourceDepletion> | undefined;

  for (const person of world.people) {
    if (
      !person.workArea ||
      (!person.woodcutter && !person.extractor) ||
      !person.resourceTarget ||
      !person.active ||
      person.path.length ||
      person.trip ||
      person.farmTask ||
      person.hungerState ||
      person.sleepState ||
      person.progress <= 0
    ) continue;

    resourcesById ??= resourceIndex(world);
    const resource = resourcesById.get(person.resourceTarget);
    if (
      !resource ||
      resource.depleted ||
      resource.remaining !== 1 ||
      !same(person.position, resource.position) ||
      person.progress + extractionSpeedMultiplier(person, resourceProfession(resource)) <
        CONFIG.duration
    ) continue;

    deferredById ??= new Map();
    const existing = deferredById.get(resource.id);
    if (existing) existing.workers.push(person);
    else deferredById.set(resource.id, { resource, workers: [person] });
  }

  if (!deferredById) return [];
  const deferred = [...deferredById.values()];
  for (const { resource } of deferred) resource.remaining = 2;
  return deferred;
}

/** Retires only the resources already known to have completed their final extraction. */
export function finishDeferredResourceDepletion(
  world: World,
  deferred: readonly DeferredResourceDepletion[],
): void {
  if (!deferred.length) return;
  const tiles = tileIndex(world.tiles);

  for (const { resource, workers } of deferred) {
    if (resource.depleted || resource.remaining !== 1) continue;
    resource.remaining = 0;
    resource.depleted = true;

    const tile = tiles.get(key(resource.position));
    if (tile) {
      if (resource.kind === "forest") tile.terrain = "grass";
      tile.trafficTicks = undefined;
    }

    for (const person of workers) {
      if (person.resourceTarget !== resource.id) continue;
      person.resourceTarget = undefined;
      person.active = false;
      person.progress = 0;
      person.movement = 0;
      person.path = [];
      if (person.workArea) person.workArea.retryAfterTick = undefined;
    }
  }
}
