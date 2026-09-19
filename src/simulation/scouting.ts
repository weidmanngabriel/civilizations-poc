import type { Hex, Person, World } from "./model";
import { currentProfession } from "./experience";
import { findPath, same } from "./hex";
import { interruptEating } from "./needs";
import { CONFIG } from "./scenario";
import { interruptSleep } from "./sleep";
import {
  canPlaceWaypost,
  clearNavigationBlocked,
  placeWaypost,
} from "./wayposts";

export const SCOUT_WAYPOST_BUILD_DURATION_TICKS = 1 * CONFIG.simulationHz;

const cancelScoutWaypostTask = (person: Person): void => {
  person.scoutWaypostTask = undefined;
  person.path = [];
  person.movement = 0;
  person.active = false;
};

const scoutPath = (world: World, person: Person, target: Hex): Hex[] | null =>
  findPath(world.tiles, person.position, target, CONFIG.roadSpeedMultiplier);

export function orderScoutWaypost(world: World, personId: number, target: Hex): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  if (
    !person ||
    currentProfession(world, person) !== "scout" ||
    person.trip?.picked ||
    person.outdoorCarry ||
    !canPlaceWaypost(world, target)
  ) return false;

  interruptEating(world, person);
  if (person.sleepState) interruptSleep(world, person);

  const path = same(person.position, target) ? [] : scoutPath(world, person, target);
  if (!path) return false;

  clearNavigationBlocked(person);
  person.manualMoveTarget = undefined;
  person.idleTarget = undefined;
  person.scoutWaypostTask = {
    target: { ...target },
    buildProgress: 0,
  };
  person.path = path;
  person.movement = 0;
  person.active = same(person.position, target);
  return true;
}

export function syncScoutWaypostTasks(world: World): void {
  for (const person of world.people) {
    const task = person.scoutWaypostTask;
    if (!task) continue;

    if (currentProfession(world, person) !== "scout") {
      cancelScoutWaypostTask(person);
      continue;
    }

    // Needs may temporarily take control. The scout order remains queued and resumes afterwards.
    if (person.hungerState || person.sleepState) continue;

    if (!canPlaceWaypost(world, task.target)) {
      cancelScoutWaypostTask(person);
      continue;
    }

    if (!same(person.position, task.target)) {
      person.active = false;
      if (!person.path.length) {
        const path = scoutPath(world, person, task.target);
        if (!path) {
          cancelScoutWaypostTask(person);
          continue;
        }
        person.path = path;
        person.movement = 0;
      }
      continue;
    }

    person.idleTarget = undefined;
    person.path = [];
    person.movement = 0;
    person.active = true;
    task.buildProgress += 1;

    if (task.buildProgress < SCOUT_WAYPOST_BUILD_DURATION_TICKS) continue;

    const created = placeWaypost(world, task.target);
    person.scoutWaypostTask = undefined;
    person.active = false;
    if (!created) cancelScoutWaypostTask(person);
  }
}
