import type { Hex } from "../simulation/model";

/** Normalized point inside the source sprite. 0/0 is top-left, 1/1 bottom-right. */
export interface SpriteAnchor {
  x: number;
  y: number;
}

export interface BuildingVisualDefinition {
  schema: "civilizations-building-visual";
  version: 3;
  id: string;
  sprite: string;
  /** Resolution-independent anchor inside the sprite image. */
  spriteAnchor: SpriteAnchor;
  /** Display width in runtime world pixels, independent from source resolution. */
  spriteWorldWidth: number;
  footprint: Hex[];
  blocked: Hex[];
  entrance: Hex;
}

const sameHex = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;
const normalized = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;
const validSpriteFilename = (value: string): boolean =>
  /^[a-z0-9][a-z0-9._-]*\.(?:png|webp)$/i.test(value) && !value.includes("/");

export function validateBuildingVisualDefinition(
  definition: BuildingVisualDefinition,
): string[] {
  const errors: string[] = [];
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(definition.id))
    errors.push("Die ID darf nur Buchstaben, Zahlen und Bindestriche enthalten.");
  if (!validSpriteFilename(definition.sprite))
    errors.push("Das Sprite muss eine lokale PNG- oder WebP-Datei sein.");
  if (!normalized(definition.spriteAnchor.x) || !normalized(definition.spriteAnchor.y))
    errors.push("Der Sprite-Anchor muss normalisiert zwischen 0 und 1 liegen.");
  if (!Number.isFinite(definition.spriteWorldWidth) || definition.spriteWorldWidth <= 0)
    errors.push("Die Sprite-Breite in der Spielwelt muss größer als 0 sein.");
  if (definition.footprint.length === 0)
    errors.push("Der Gebäudegrundriss darf nicht leer sein.");
  if (!definition.footprint.some((cell) => sameHex(cell, definition.entrance)))
    errors.push("Der Eingang muss innerhalb des Gebäudegrundrisses liegen.");
  if (definition.blocked.some((cell) => !definition.footprint.some((footprint) => sameHex(footprint, cell))))
    errors.push("Blockierte Zellen müssen zum Gebäudegrundriss gehören.");
  if (definition.blocked.some((cell) => sameHex(cell, definition.entrance)))
    errors.push("Der Eingang darf nicht blockiert sein.");
  return errors;
}
