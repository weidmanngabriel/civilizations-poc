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
    const gameHost = scene.game.canvas.parentElement;
    if (!gameHost) return;

    const overlay = document.createElement("canvas");
    overlay.className = "fish-school-overlay";
    overlay.setAttribute("aria-hidden", "true");
    gameHost.append(overlay);

    const context = overlay.getContext("2d");
    if (!context) {
      overlay.remove();
      return;
    }

    const resizeOverlay = () => {
      const rect = scene.game.canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (overlay.width !== width || overlay.height !== height) {
        overlay.width = width;
        overlay.height = height;
      }
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width: rect.width, height: rect.height };
    };

    const screenPoint = { x: 0, y: 0 };

    const render = () => {
      const { width, height } = resizeOverlay();
      context.clearRect(0, 0, width, height);
      const camera = scene.cameras.main;
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
          const worldX = from.x + (to.x - from.x) * progress;
          const worldY = from.y + (to.y - from.y) * progress;
          camera.matrixCombined.transformPoint(worldX, worldY, screenPoint);
          const x = screenPoint.x;
          const y = screenPoint.y
            + Math.sin(scene.time.now / 900 + index * 1.7) * FISH_DRIFT_SCREEN_PX;
          const direction = to.x >= from.x ? 1 : -1;
          const bodyWidth = FISH_BODY_WIDTH_SCREEN_PX;
          const bodyHeight = FISH_BODY_HEIGHT_SCREEN_PX;
          const tail = FISH_TAIL_SCREEN_PX;

          context.fillStyle = "rgba(214, 237, 242, 0.9)";
          context.beginPath();
          context.ellipse(x, y, bodyWidth / 2, bodyHeight / 2, 0, 0, Math.PI * 2);
          context.fill();

          context.beginPath();
          context.moveTo(x - direction * bodyWidth * 0.42, y);
          context.lineTo(
            x - direction * (bodyWidth * 0.42 + tail),
            y - tail * 0.7,
          );
          context.lineTo(
            x - direction * (bodyWidth * 0.42 + tail),
            y + tail * 0.7,
          );
          context.closePath();
          context.fill();
        }
      }
    };

    const camera = scene.cameras.main;
    camera.on(Phaser.Cameras.Scene2D.Events.POST_RENDER, render);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      camera.off(Phaser.Cameras.Scene2D.Events.POST_RENDER, render);
      overlay.remove();
    });
  };
};
