import type { Person, World } from "./model";
import { startEatingAfterCompletedAction } from "./needs";
import { startSleepingAfterCompletedAction } from "./sleep";

const NEED_THRESHOLD = 40;

export const needDueBeforeNewTask = (person: Person): boolean =>
  person.ageStage === "child" ||
  Boolean(person.familyTask) ||
  Boolean(person.hungerState) ||
  (person.hunger ?? 100) <= NEED_THRESHOLD ||
  Boolean(person.sleepState) ||
  (person.sleep ?? 100) <= NEED_THRESHOLD;

/**
 * Called at an authoritative task boundary before starting another work action.
 * Hunger has priority over sleep, matching the normal autonomous need planner.
 * Returns true whenever work must stay paused for a due need, even when no
 * usable target is currently available.
 */
export const pauseForNeedBeforeNewTask = (world: World, person: Person): boolean => {
  if (person.ageStage === "child" || person.familyTask) return true;
  if (person.hungerState || (person.hunger ?? 100) <= NEED_THRESHOLD) {
    startEatingAfterCompletedAction(world, person);
    return true;
  }
  if (person.sleepState || (person.sleep ?? 100) <= NEED_THRESHOLD) {
    startSleepingAfterCompletedAction(world, person);
    return true;
  }
  return false;
};
