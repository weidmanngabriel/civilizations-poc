import type { NaturalResource, Person, World } from "./model";
import { CONFIG } from "./scenario";
import { extractionSpeedMultiplier } from "./experience";
import { key, tileIndex } from "./hex";

type DeferredResourceDepletion = {
  resource: NaturalResource;
  workers: Person[];
};

const samePosition = (
  a: { q: number; r: number },
  b: { q: number; r: number },
): boolean => a.q === b.q && a.r === b.r;

const resourceProfession = (
  resource: NaturalResource,
): "woodcutter" | "clayDigger" | "stonecutter" =>
  resource.kind === "forest"
    ? "woodcutter"
    : resource.kind === "clay"
      ? "clayDigger"
      : "stonecutter";

/**
 * The historical core still performs global replanning inside resource retirement.
 * Local work areas own that decision now. A final local extraction temporarily keeps
 * one sentinel unit so the expensive legacy cleanup path is skipped.
 */
export function deferLocalResourceDepletion(
  world: World,
): DeferredResourceDepletion[] {
  const localWorkers = world.people.filter(
    (person) => person.workArea && (person.woodcutter || person.extractor),
  );
  if (!localWorkers.length) return [];

  const resourcesById = new Map(
    world.naturalResources.map((resource) => [resource.id, resource]),
  );
  const deferredById = new Map<string, DeferredResourceDepletion>();

  for (const person of localWorkers) {
    if (
      !person.resourceTarget ||
      !person.active ||
      person.path.length ||
      person.trip ||
      person.farmTask ||
      person.hungerState ||
      person.sleepState ||
      person.progress <= 0
    ) continue;

    const resource = resourcesById.get(person.resourceTarget);
    if (
      !resource ||
      resource.depleted ||
      resource.remaining !== 1 ||
      !samePosition(person.position, resource.position) ||
      person.progress + extractionSpeedMultiplier(person, resourceProfession(resource)) <
        CONFIG.duration
    ) continue;

    const existing = deferredById.get(resource.id);
    if (existing) existing.workers.push(person);
    else deferredById.set(resource.id, { resource, workers: [person] });
  }

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
