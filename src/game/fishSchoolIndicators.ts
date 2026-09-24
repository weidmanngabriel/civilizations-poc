import Phaser from "phaser";
import type { FishSchool, Hex, World } from "../simulation/model";
import { key, neighbors } from "../simulation/hex";
import { visibleFishCount } from "../simulation/fishSchools";
import { pixel } from "./mapGeometry";

const pathCache = new Map<string, Hex[]>();

const schoolPath = (school: FishSchool): Hex[] => {
  const cached = pathCache.get(school.id);
  if (cached) return cached;
  if (school.region.length <= 1) {
    const path = school.region.map((position) => ({ ...position }));
    pathCache.set(school.id, path);
    return path;
  }

  const region = new Map(school.region.map((position) => [key(position), position] as const));
  const path: Hex[] = [];
  let current = school.region[0]!;
  let previousKey: string | undefined;
  const salt = [...school.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);

  for (let step = 0; step < Math.max(96, school.region.length * 4); step += 1) {
    path.push({ ...current });
    const adjacent = neighbors(current)
      .map((position) => region.get(key(position)))
      .filter((position): position is Hex => Boolean(position))
      .sort((a, b) => a.q - b.q || a.r - b.r);
    const forward = adjacent.filter((position) => key(position) !== previousKey);
    const candidates = forward.length ? forward : adjacent;
    if (!candidates.length) break;
    const next = candidates[(step + salt) % candidates.length]!;
    previousKey = key(current);
    current = next;
  }

  pathCache.set(school.id, path);
  return path;
};

const smooth = (value: number): number => value * value * (3 - 2 * value);

const FISH_BODY_WIDTH_SCREEN_PX = 6;
const FISH_BODY_HEIGHT_SCREEN_PX = 3.2;
const FISH_TAIL_SCREEN_PX = 2.5;
const FISH_DRIFT_SCREEN_PX = 1.5;

export const installFishSchoolIndicators = (scene: Phaser.Scene, world: World): void => {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();
    const graphics = scene.add.graphics().setDepth(8);

    const render = () => {
      graphics.clear();
      const zoom = scene.cameras.main.zoom || 1;
      const elapsed = scene.time.now / 4200;

      for (const school of world.fishSchools ?? []) {
        const visible = visibleFishCount(school.fish);
        if (!visible) continue;
        const path = schoolPath(school);
        if (!path.length) continue;

        for (let index = 0; index < visible; index += 1) {
          const phase = elapsed + index * 2.35;
          const pathIndex = Math.floor(phase) % path.length;
          const nextIndex = (pathIndex + 1) % path.length;
          const progress = smooth(phase - Math.floor(phase));
          const from = pixel(path[pathIndex]!);
          const to = pixel(path[nextIndex]!);
          const drift = Math.sin(scene.time.now / 900 + index * 1.7) * (FISH_DRIFT_SCREEN_PX / zoom);
          const x = from.x + (to.x - from.x) * progress;
          const y = from.y + (to.y - from.y) * progress + drift;
          const direction = to.x >= from.x ? 1 : -1;
          const bodyWidth = FISH_BODY_WIDTH_SCREEN_PX / zoom;
          const bodyHeight = FISH_BODY_HEIGHT_SCREEN_PX / zoom;
          const tail = FISH_TAIL_SCREEN_PX / zoom;

          graphics.fillStyle(0xd6edf2, 0.9);
          graphics.fillEllipse(x, y, bodyWidth, bodyHeight);
          graphics.fillTriangle(
            x - direction * bodyWidth * 0.42,
            y,
            x - direction * (bodyWidth * 0.42 + tail),
            y - tail * 0.7,
            x - direction * (bodyWidth * 0.42 + tail),
            y + tail * 0.7,
          );
        }
      }
    };

    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, render);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, render);
      graphics.destroy();
    });
  };
};
