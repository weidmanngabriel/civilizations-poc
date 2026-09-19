import type {
  Hex,
  Person,
  Profession,
  Projectile,
  ProjectileKind,
  RangedEntityRef,
  World,
} from "./model";
import { randomFraction } from "./random";

export type RangedAttackProfile = {
  projectileKind: ProjectileKind;
  flightTicks: number;
  cooldownTicks: number;
  range: number;
  /** How long an impacted projectile remains in the world for presentation. */
  impactLifetimeTicks?: number;
};

export type RangedImpact = {
  projectile: Projectile;
  target: RangedEntityRef;
  hit: boolean;
  rewardProfession?: Profession;
};

const nextProjectileId = (world: World): string => {
  const id = world.nextProjectileId ?? 1;
  world.nextProjectileId = id + 1;
  return `projectile-${id}`;
};

export function fireRangedAttack(
  world: World,
  attacker: Person,
  target: RangedEntityRef,
  targetPosition: Hex,
  profile: RangedAttackProfile,
  hitChance: number,
  rewardProfession?: Profession,
): Projectile {
  const projectile: Projectile = {
    id: nextProjectileId(world),
    kind: profile.projectileKind,
    source: { kind: "person", id: attacker.id },
    target,
    start: { ...attacker.position },
    targetPosition: { ...targetPosition },
    startedAtTick: world.round,
    impactAtTick: world.round + profile.flightTicks,
    hit: randomFraction(world) < Math.max(0, Math.min(1, hitChance)),
    ...(profile.impactLifetimeTicks !== undefined
      ? { impactLifetimeTicks: profile.impactLifetimeTicks }
      : {}),
    ...(rewardProfession ? { rewardProfession } : {}),
  };
  (world.projectiles ??= []).push(projectile);
  return projectile;
}

export function advanceRangedCombat(world: World): RangedImpact[] {
  const active = world.projectiles ?? [];
  if (!active.length) return [];

  const impacts: RangedImpact[] = [];
  const remaining: Projectile[] = [];
  for (const projectile of active) {
    if (projectile.resolvedAtTick !== undefined) {
      if (projectile.expiresAtTick === undefined || world.round < projectile.expiresAtTick)
        remaining.push(projectile);
      continue;
    }
    if (world.round < projectile.impactAtTick) {
      remaining.push(projectile);
      continue;
    }

    projectile.resolvedAtTick = world.round;
    projectile.expiresAtTick =
      world.round + Math.max(0, projectile.impactLifetimeTicks ?? 0);
    impacts.push({
      projectile,
      target: projectile.target,
      hit: projectile.hit,
      rewardProfession: projectile.rewardProfession,
    });
    if (projectile.expiresAtTick > world.round) remaining.push(projectile);
  }
  world.projectiles = remaining;
  return impacts;
}
