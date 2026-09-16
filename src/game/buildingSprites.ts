import Phaser from "phaser";
import type { BuildingVisualDefinition } from "../buildings/buildingVisualDefinition";
import { validateBuildingVisualDefinition } from "../buildings/buildingVisualDefinition";
import type { World } from "../simulation/model";
import { pixel } from "./mapGeometry";
import type { MainScene } from "./MainScene";

const HQ_TEXTURE_KEY = "building-headquarter";
const HQ_DEFINITION_URL = new URL(
  "../assets/buildings/headquarter/building.json",
  import.meta.url,
).href;
const HQ_SPRITE_URL = new URL(
  "../assets/buildings/headquarter/sprite.webp",
  import.meta.url,
).href;

type MainSceneLayers = {
  mapGraphics?: Phaser.GameObjects.Graphics;
  mapLabels?: Phaser.GameObjects.Container;
  markers?: Phaser.GameObjects.Container;
};

async function loadDefinition(): Promise<BuildingVisualDefinition> {
  const response = await fetch(HQ_DEFINITION_URL);
  if (!response.ok) throw new Error(`HQ-Definition konnte nicht geladen werden (${response.status}).`);
  const definition = await response.json() as BuildingVisualDefinition;
  const errors = validateBuildingVisualDefinition(definition);
  if (definition.id !== "headquarter") errors.push("Die HQ-Definition hat nicht die ID headquarter.");
  if (definition.sprite !== "sprite.webp") errors.push("Die HQ-Definition verweist nicht auf sprite.webp.");
  if (errors.length) throw new Error(errors.join(" "));
  return definition;
}

function loadTexture(scene: MainScene): Promise<void> {
  if (scene.textures.exists(HQ_TEXTURE_KEY)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
    scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => reject(new Error("HQ-Sprite konnte nicht geladen werden.")));
    scene.load.image(HQ_TEXTURE_KEY, HQ_SPRITE_URL);
    scene.load.start();
  });
}

/**
 * Runtime bridge for editor-authored building visuals. The simulation remains
 * authoritative; this module only replaces the temporary geometric HQ drawing.
 */
export function installBuildingSprites(scene: MainScene, world: World): void {
  let sprite: Phaser.GameObjects.Image | undefined;

  const sync = () => {
    if (!sprite) return;
    const hq = world.buildings.find((building) => building.kind === "hq" && !building.retired);
    if (!hq) {
      sprite.setVisible(false);
      return;
    }
    const position = pixel(hq.position);
    sprite.setPosition(position.x, position.y).setVisible(true);
  };

  const install = async () => {
    try {
      const definition = await loadDefinition();
      await loadTexture(scene);
      const source = scene.textures.get(HQ_TEXTURE_KEY).getSourceImage() as HTMLImageElement;

      sprite = scene.add.image(0, 0, HQ_TEXTURE_KEY)
        .setOrigin(
          definition.spriteAnchor.x / source.width,
          definition.spriteAnchor.y / source.height,
        )
        .setScale(definition.spriteScale)
        .setDepth(1);

      const layers = scene as unknown as MainSceneLayers;
      layers.mapGraphics?.setDepth(0);
      layers.mapLabels?.setDepth(2);
      layers.markers?.setDepth(3);
      sync();
      scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
    } catch (error) {
      console.error("HQ-Visual konnte nicht initialisiert werden.", error);
    }
  };

  scene.events.once(Phaser.Scenes.Events.CREATE, () => void install());
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
    sprite?.destroy();
    sprite = undefined;
  });
}
