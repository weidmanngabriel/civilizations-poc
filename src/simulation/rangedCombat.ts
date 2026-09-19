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
    if (world.round < projectile.impactAtTick) {
      remaining.push(projectile);
      continue;
    }
    impacts.push({
      projectile,
      target: projectile.target,
      hit: projectile.hit,
      rewardProfession: projectile.rewardProfession,
    });
  }
  world.projectiles = remaining;
  return impacts;
}
