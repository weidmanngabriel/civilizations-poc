import type { Person, World } from "./model";

const immediateWorkDecisionPeople = new WeakSet<Person>();

/**
 * Re-enter the normal autonomous work planner for this person on the next core tick.
 * Subsystems call this after completing an authoritative task instead of duplicating
 * profession-specific retry or routing logic.
 */
export const requestImmediateWorkDecision = (_world: World, person: Person): void => {
  immediateWorkDecisionPeople.add(person);
};

export const consumeImmediateWorkDecision = (person: Person): boolean =>
  immediateWorkDecisionPeople.delete(person);

export const cancelImmediateWorkDecision = (person: Person): void => {
  immediateWorkDecisionPeople.delete(person);
};
