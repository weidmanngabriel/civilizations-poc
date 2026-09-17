import Phaser from "phaser";
import {
  buildingVisualAnchor,
  definitionForBuilding,
  registeredBuildingDefinitions,
  type RegisteredBuildingDefinition,
} from "../buildings/buildingDefinitionRegistry";
import type { Building, World } from "../simulation/model";
import { pixel } from "./mapGeometry";
import type { MainScene } from "./MainScene";

type MainSceneLayers = {
  mapGraphics?: Phaser.GameObjects.Graphics;
  mapLabels?: Phaser.GameObjects.Container;
  markers?: Phaser.GameObjects.Container;
};

type CreatableScene = MainScene & {
  create?: () => void;
};

const BUILDING_SPRITE_URLS = import.meta.glob("../assets/buildings/**/*.{png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const textureKey = (id: string): string => `building-${id}`;
const displayable = (building: Building): boolean =>
  !building.retired && (!building.construction || building.construction.complete);

const spriteUrlFor = (definition: RegisteredBuildingDefinition): string => {
  const assetPath = `../assets/buildings/${definition.visual.id}/${definition.visual.sprite}`;
  const spriteUrl = BUILDING_SPRITE_URLS[assetPath];
  if (!spriteUrl)
    throw new Error(
      `Sprite für Building-Definition ${definition.visual.id} nicht gefunden: ${definition.visual.sprite}`,
    );
  return spriteUrl;
};

function loadTextures(scene: MainScene): Promise<void> {
  const pending = registeredBuildingDefinitions().filter(
    (definition) => !scene.textures.exists(textureKey(definition.visual.id)),
  );
  if (!pending.length) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      scene.load.off(Phaser.Loader.Events.COMPLETE, complete);
      scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, failed);
    };
    const complete = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error("Ein Gebäude-Sprite konnte nicht geladen werden."));
    };

    scene.load.once(Phaser.Loader.Events.COMPLETE, complete);
    scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, failed);
    for (const definition of pending)
      scene.load.image(textureKey(definition.visual.id), spriteUrlFor(definition));
    scene.load.start();
  });
}

/**
 * Generic runtime renderer for editor-authored building definitions. Gameplay
 * semantics remain in simulation code; this layer only reads bound visual
 * definitions and follows authoritative building instances.
 */
export function installBuildingSprites(scene: MainScene, world: World): void {
  const creatableScene = scene as CreatableScene;
  const originalCreate = creatableScene.create?.bind(scene);
  const sprites = new Map<string, Phaser.GameObjects.Image>();

  const removeSprite = (id: string): void => {
    sprites.get(id)?.destroy();
    sprites.delete(id);
  };

  const createSprite = (building: Building): Phaser.GameObjects.Image | undefined => {
    const registered = definitionForBuilding(building);
    if (!registered) return;
    const key = textureKey(registered.visual.id);
    const source = scene.textures.get(key).getSourceImage() as HTMLImageElement;
    const worldWidth = registered.visual.spriteWorldWidth;
    const worldHeight = worldWidth * (source.height / source.width);
    return scene.add.image(0, 0, key)
      .setOrigin(
        registered.visual.spriteAnchor.x,
        registered.visual.spriteAnchor.y,
      )
      .setDisplaySize(worldWidth, worldHeight)
      .setDepth(1);
  };

  const sync = () => {
    const active = world.buildings.filter(
      (building) => displayable(building) && definitionForBuilding(building),
    );
    const activeIds = new Set(active.map((building) => building.id));
    for (const id of sprites.keys())
      if (!activeIds.has(id)) removeSprite(id);

    for (const building of active) {
      let sprite = sprites.get(building.id);
      if (!sprite) {
        sprite = createSprite(building);
        if (!sprite) continue;
        sprites.set(building.id, sprite);
      }
      const position = pixel(buildingVisualAnchor(building));
      sprite.setPosition(position.x, position.y).setVisible(true);
    }
  };

  const install = async () => {
    try {
      await loadTextures(scene);
      const layers = scene as unknown as MainSceneLayers;
      layers.mapGraphics?.setDepth(0);
      layers.mapLabels?.setDepth(2);
      layers.markers?.setDepth(3);
      sync();
      scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
    } catch (error) {
      console.error("Gebäude-Visuals konnten nicht initialisiert werden.", error);
    }
  };

  creatableScene.create = () => {
    originalCreate?.();
    void install();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync);
      for (const id of [...sprites.keys()]) removeSprite(id);
    });
  };
}
