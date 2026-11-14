import type { Hex, Person, World } from "./model";
import { hexDistance as distance, key, neighbors, same, tileIndex, walkable } from "./hex";
import { CONFIG } from "./scenario";
import { SIMULATION_HZ } from "./timing";
import { findNavigationPath } from "./wayposts";
import { findPath } from "./hex";
import { hexDistance, GRID_REFINEMENT } from "./spatial";
import { isIdleForSocial } from "./idleBehavior";
import { requestImmediateWorkDecision } from "./workScheduling";

/**
 * Social interactions are authoritative, paired, and interruptible.
 * Both residents have a matching socialTask; only the lower-id resident
 * advances the conversation so that rewards are awarded exactly once.
 */
export const SOCIAL_RULES = {
  max: 100,
  idleSecondsPerPoint: 20,
  workingSecondsPerPoint: 10,
  conversationTicks: 15 * SIMULATION_HZ,
  minimumConversationTicks: Math.round(7.5 * SIMULATION_HZ),
  conversationRecovery: 12,
  needThreshold: 40,
  criticalThreshold: 20,
  resumeWorkThreshold: 40,
  interruptionPenalty: 5,
  searchRadius: 5 * GRID_REFINEMENT,
} as const;

export const socialValue = (person: Person): number => person.social ?? SOCIAL_RULES.max;

const hasEmergency = (person: Person): boolean =>
  Boolean(
    person.hungerState ||
    person.sleepState ||
    (person.hunger ?? 100) <= 20 ||
    (person.sleep ?? 100) <= 20,
  );

const atConversationBoundary = (person: Person): boolean =>
  person.ageStage !== "child" &&
  !person.familyTask &&
  (!person.educationTask || Boolean(person.socialWorkBlocked)) &&
  !person.equipmentTask &&
  !person.scoutWaypostTask &&
  !person.manualMoveTarget &&
  !person.hungerState &&
  !person.sleepState &&
  !person.trip &&
  !person.farmTask &&
  !person.outdoorCarry &&
  !person.huntLootTarget &&
  !person.huntLootQueue?.length &&
  !person.huntAimTarget &&
  person.fishingWaitUntilTick === undefined &&
  (person.progress === 0 || Boolean(person.socialWorkBlocked)) &&
  (person.path.length === 0 || Boolean(person.idleTarget) || Boolean(person.socialWorkBlocked));

/** True only while real work/travel is performed, not merely because a profession exists. */
export const isWorkingForSocial = (person: Person): boolean =>
  Boolean(
    person.educationTask?.active ||
    person.progress > 0 ||
    person.farmTask ||
    person.trip ||
    person.outdoorCarry ||
    person.fishingWaitUntilTick !== undefined ||
    person.huntAimTarget ||
    person.huntLootTarget ||
    person.huntTarget ||
    (person.resourceTarget && person.active) ||
    (person.path.length > 0 && !person.idleTarget && !person.manualMoveTarget && !person.socialTask),
  );

const stopPhase = (person: Person): void => {
  person.socialMode = undefined;
  person.socialCompleted = undefined;
};

/** End one participant's phase. The partner is released without an interruption penalty. */
export function cancelSocial(world: World, person: Person, avoidable = true): void {
  const task = person.socialTask;
  if (task) {
    const partner = world.people.find((candidate) => candidate.id === task.partnerId);
    if (partner?.socialTask?.partnerId === person.id) {
      partner.socialTask = undefined;
      if (!partner.hungerState && !partner.sleepState && !partner.manualMoveTarget) {
        partner.path = [];
        partner.active = false;
        requestImmediateWorkDecision(world, partner);
      }
    }
    if (avoidable && task.startedAtTick !== undefined && !person.socialCompleted)
      person.social = Math.max(0, socialValue(person) - SOCIAL_RULES.interruptionPenalty);
    person.socialTask = undefined;
    if (!person.hungerState && !person.sleepState && !person.manualMoveTarget) {
      person.path = [];
      person.active = false;
    }
  }
  stopPhase(person);
  requestImmediateWorkDecision(world, person);
}

/** The player can order repeated conversations up to a full social meter. */
export function commandSocialize(world: World, personId: number): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  if (!person || person.ageStage === "child" || person.familyTask || person.educationTask) return false;
  if (person.socialMode === "manual") return true;
  if (socialValue(person) >= SOCIAL_RULES.max) return false;
  person.socialMode = "manual";
  return true;
}

export function commandStopSocializing(world: World, personId: number): boolean {
  const person = world.people.find((candidate) => candidate.id === personId);
  if (!person || (!person.socialMode && !person.socialTask)) return false;
  cancelSocial(world, person, true);
  return true;
}

const routeBetween = (world: World, person: Person, target: Hex): Hex[] | null =>
  person.profession === "scout"
    ? findPath(world.tiles, person.position, target, CONFIG.roadSpeedMultiplier)
    : findNavigationPath(world, person.position, target, CONFIG.roadSpeedMultiplier);

const plannedMeeting = (
  world: World,
  first: Person,
  second: Person,
): { firstTarget: Hex; secondTarget: Hex; firstPath: Hex[]; secondPath: Hex[] } | undefined => {
  const direct = routeBetween(world, first, second.position);
  if (!direct) return;
  const tiles = tileIndex(world.tiles);
  const midpoint = Math.floor(direct.length / 2);
  const centers = [direct[midpoint] ?? first.position, ...direct, first.position];
  const visited = new Set<string>();
  for (const center of centers) {
    if (visited.has(key(center))) continue;
    visited.add(key(center));
    const tile = tiles.get(key(center));
    if (!tile || !walkable(tile)) continue;
    const firstPath = routeBetween(world, first, center);
    if (!firstPath) continue;
    const availableNeighbors = neighbors(center)
      .filter((candidate) => {
        const neighborTile = tiles.get(key(candidate));
        return neighborTile && walkable(neighborTile);
      })
      .sort((a, b) => {
        const occupied = (candidate: Hex): number =>
          world.people.some((person) =>
            person.id !== first.id && person.id !== second.id && same(person.position, candidate)
          ) ? 1 : 0;
        return occupied(a) - occupied(b) ||
          distance(a, second.position) - distance(b, second.position) ||
          a.q - b.q || a.r - b.r;
      });
    for (const secondTarget of availableNeighbors) {
      const secondPath = routeBetween(world, second, secondTarget);
      if (secondPath) return {
        firstTarget: { ...center },
        secondTarget: { ...secondTarget },
        firstPath,
        secondPath,
      };
    }
  }
  return undefined;
};

const beginConversation = (
  world: World,
  first: Person,
  second: Person,
  paths: NonNullable<ReturnType<typeof plannedMeeting>>,
): void => {
  const participants = [first, second] as const;
  for (const [index, person] of participants.entries()) {
    const partner = participants[1 - index]!;
    person.socialMode ??= isIdleForSocial(world, person) ? "idle" : "need";
    person.socialTask = {
      partnerId: partner.id,
      target: { ...(index === 0 ? paths.firstTarget : paths.secondTarget) },
      progressTicks: 0,
    };
    person.idleTarget = undefined;
    person.path = index === 0 ? paths.firstPath : paths.secondPath;
    person.movement = 0;
    person.active = false;
  }
};

const partnerCandidate = (
  world: World,
  requester: Person,
  requesterIdle: boolean,
): { person: Person; paths: NonNullable<ReturnType<typeof plannedMeeting>> } | undefined => {
  const possibilities = world.people
    .filter((person) => person.id !== requester.id && !person.socialTask)
    .filter((person) => hexDistance(person.position, requester.position) <= SOCIAL_RULES.searchRadius)
    .filter((person) => !hasEmergency(person) && atConversationBoundary(person))
    .filter((person) =>
      requesterIdle
        ? isIdleForSocial(world, person)
        : isIdleForSocial(world, person) || socialValue(person) <= SOCIAL_RULES.needThreshold,
    )
    .sort((a, b) => {
      const aIdle = isIdleForSocial(world, a);
      const bIdle = isIdleForSocial(world, b);
      const aScore = (aIdle ? 0 : 100) + socialValue(a) + hexDistance(a.position, requester.position);
      const bScore = (bIdle ? 0 : 100) + socialValue(b) + hexDistance(b.position, requester.position);
      return aScore - bScore || a.id - b.id;
    });
  for (const person of possibilities) {
    const paths = plannedMeeting(world, requester, person);
    if (paths) return { person, paths };
  }
};

const finishConversation = (world: World, first: Person, second: Person, completed: boolean): void => {
  if (completed) {
    first.socialCompleted = true;
    second.socialCompleted = true;
  }
  first.socialTask = undefined;
  second.socialTask = undefined;
  for (const person of [first, second]) {
    person.path = [];
    person.active = false;
    if (
      socialValue(person) >= SOCIAL_RULES.max ||
      (person.socialMode === "need" && socialValue(person) > SOCIAL_RULES.needThreshold)
    ) {
      stopPhase(person);
      requestImmediateWorkDecision(world, person);
    }
  }
};

const progressConversations = (world: World): void => {
  for (const first of world.people) {
    const task = first.socialTask;
    if (!task || first.id > task.partnerId) continue;
    const second = world.people.find((candidate) => candidate.id === task.partnerId);
    const otherTask = second?.socialTask;
    if (!second || otherTask?.partnerId !== first.id) {
      cancelSocial(world, first, false);
      continue;
    }
    if (
      hasEmergency(first) ||
      hasEmergency(second) ||
      first.manualMoveTarget ||
      second.manualMoveTarget ||
      first.familyTask ||
      second.familyTask
    ) {
      if (hasEmergency(first) || first.familyTask) cancelSocial(world, first, false);
      else if (hasEmergency(second) || second.familyTask) cancelSocial(world, second, false);
      else cancelSocial(world, first, true);
      continue;
    }
    if (first.path.length || second.path.length) continue;
    if (!same(first.position, task.target) || !same(second.position, otherTask.target) ||
        distance(first.position, second.position) !== 1) {
      cancelSocial(world, first, false);
      continue;
    }
    if (task.startedAtTick === undefined) {
      task.startedAtTick = world.round;
      otherTask.startedAtTick = world.round;
    }
    task.progressTicks++;
    otherTask.progressTicks = task.progressTicks;
    const earned = SOCIAL_RULES.conversationRecovery / SOCIAL_RULES.conversationTicks;
    first.social = Math.min(SOCIAL_RULES.max, socialValue(first) + earned);
    second.social = Math.min(SOCIAL_RULES.max, socialValue(second) + earned);
    if (task.progressTicks >= SOCIAL_RULES.conversationTicks) {
      // Free residents can carry on talking without an artificial break,
      // even after both social meters have reached 100.
      if (first.socialMode === "idle" && second.socialMode === "idle") {
        first.socialCompleted = true;
        second.socialCompleted = true;
        task.progressTicks = 0;
        otherTask.progressTicks = 0;
      } else finishConversation(world, first, second, true);
    } else if (
      task.progressTicks >= SOCIAL_RULES.minimumConversationTicks &&
      ((first.socialMode === "need" && socialValue(first) >= SOCIAL_RULES.max) ||
       (second.socialMode === "need" && socialValue(second) >= SOCIAL_RULES.max))
    ) {
      // Work may resume after the minimum half-conversation. This is a
      // natural ending, not a player interruption or a fully completed talk.
      finishConversation(world, first, second, false);
    }
  }
};

const decaySocial = (person: Person): void => {
  if (person.ageStage === "child") return;
  person.social ??= SOCIAL_RULES.max;
  person.socialAccumulator ??= 0;
  if (person.socialTask?.startedAtTick === undefined) {
    const seconds = isWorkingForSocial(person)
      ? SOCIAL_RULES.workingSecondsPerPoint
      : SOCIAL_RULES.idleSecondsPerPoint;
    person.socialAccumulator += 1 / (seconds * CONFIG.simulationHz);
    while (person.socialAccumulator + 1e-9 >= 1 && person.social > 0) {
      person.socialAccumulator = Math.max(0, person.socialAccumulator - 1);
      person.social = Math.max(0, person.social - 1);
    }
  }
  if (person.social <= 0) person.socialWorkBlocked = true;
  if (person.socialWorkBlocked && person.social >= SOCIAL_RULES.resumeWorkThreshold) {
    person.socialWorkBlocked = undefined;
  }
};

/** Run once per simulation tick before the core worker planner advances. */
export function advanceSocial(world: World): void {
  for (const person of world.people) decaySocial(person);
  for (const person of world.people) {
    if ((person.socialMode || person.socialTask) && hasEmergency(person))
      cancelSocial(world, person, false);
  }
  progressConversations(world);
  if (world.round % CONFIG.decisionIntervalTicks !== 0) return;

  for (const person of [...world.people].sort((a, b) => a.id - b.id)) {
    if (person.ageStage === "child" || person.socialTask) continue;
    if (person.socialMode === "manual" && socialValue(person) >= SOCIAL_RULES.max) {
      cancelSocial(world, person, false);
      continue;
    }
    if (person.socialMode === "idle" && !isIdleForSocial(world, person)) {
      cancelSocial(world, person, false);
      continue;
    }
    if (person.socialMode === "need" && socialValue(person) > SOCIAL_RULES.needThreshold) {
      cancelSocial(world, person, false);
      continue;
    }
    if (hasEmergency(person) || !atConversationBoundary(person)) continue;
    const idle = isIdleForSocial(world, person);
    if (!person.socialMode) {
      if (idle && socialValue(person) < SOCIAL_RULES.max) person.socialMode = "idle";
      else if (socialValue(person) <= SOCIAL_RULES.needThreshold) person.socialMode = "need";
      else continue;
    }
    // Idle autonomy must never interrupt a working resident, even if the idle person was previously needy.
    const partner = partnerCandidate(world, person, idle && person.socialMode !== "manual");
    if (partner) beginConversation(world, person, partner.person, partner.paths);
    else if (person.socialMode !== "manual") {
      // A social phase ends when no next partner is available. Do not block work indefinitely.
      stopPhase(person);
      requestImmediateWorkDecision(world, person);
    }
  }
}
