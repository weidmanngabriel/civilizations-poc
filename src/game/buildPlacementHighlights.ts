import Phaser from "phaser";
import type { BuildableBuildingKind, Hex, World } from "../simulation/model";
import { validBuildingAnchors } from "../simulation/buildingPlacement";
import { validWaypostAnchors } from "../simulation/wayposts";
import { validPalisadePlanningAnchors } from "../simulation/palisades";
import { HEX_RADIUS, pixel } from "./mapGeometry";

const BUILD_MODE_EVENT = "poc-build-mode";
const HIGHLIGHT_COLOR = 0xd9f2b4;
const HIGHLIGHT_ALPHA = 0.32;

type BuildModeDetail = { active: boolean; kind?: BuildableBuildingKind | "waypost" | "palisade" };
type MainSceneLayers = {
  targetModeOverlay?: Phaser.GameObjects.Graphics;
  targetModeHighlights?: Phaser.GameObjects.Container;
};

const hexPoints = (position: Hex): Phaser.Math.Vector2[] => {
  const { x, y } = pixel(position);
  return Array.from({ length: 6 }, (_, i) => new Phaser.Math.Vector2(
    x + HEX_RADIUS * Math.cos(((60 * i - 30) * Math.PI) / 180),
    y + HEX_RADIUS * Math.sin(((60 * i - 30) * Math.PI) / 180),
  ));
};

/**
 * Restores the build-mode overview on the fine grid without re-running
 * placement validation on every pointer move or render frame. The exact ghost
 * position is still validated live by MainScene before construction.
 */
export function installBuildPlacementHighlights(scene: Phaser.Scene, world: World): void {
  const sceneWithCreate = scene as Phaser.Scene & { create?: () => void };
  const originalCreate = sceneWithCreate.create?.bind(scene);

  sceneWithCreate.create = () => {
    originalCreate?.();

    const layers = scene as unknown as MainSceneLayers;
    layers.targetModeOverlay?.setDepth(10);
    const graphics = scene.add.graphics().setDepth(11);
    layers.targetModeHighlights?.setDepth(12);

    let activeKind: BuildableBuildingKind | "waypost" | "palisade" | undefined;
    let observedWaypostRevision = world.waypostRevision ?? 0;

    const showFor = (kind?: BuildableBuildingKind | "waypost" | "palisade") => {
      graphics.clear();
      if (!kind) return;

      const anchors = kind === "waypost"
        ? validWaypostAnchors(world)
        : kind === "palisade"
          ? validPalisadePlanningAnchors(world)
          : validBuildingAnchors(world, kind);
      graphics.fillStyle(HIGHLIGHT_COLOR, HIGHLIGHT_ALPHA);
      for (const anchor of anchors) graphics.fillPoints(hexPoints(anchor), true);
    };

    const onBuildMode = (event: Event) => {
      const detail = (event as CustomEvent<BuildModeDetail>).detail;
      activeKind = detail.active ? detail.kind : undefined;
      observedWaypostRevision = world.waypostRevision ?? 0;
      showFor(activeKind);
    };

    const onSceneUpdate = () => {
      if (!activeKind) return;
      const revision = world.waypostRevision ?? 0;
      if (revision === observedWaypostRevision) return;
      observedWaypostRevision = revision;
      showFor(activeKind);
    };

    window.addEventListener(BUILD_MODE_EVENT, onBuildMode);
    scene.events.on(Phaser.Scenes.Events.UPDATE, onSceneUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(BUILD_MODE_EVENT, onBuildMode);
      scene.events.off(Phaser.Scenes.Events.UPDATE, onSceneUpdate);
      graphics.destroy();
    });
  };
}
