import type { Hex } from "../simulation/model";

/** Normalized point inside the source sprite. 0/0 is top-left, 1/1 bottom-right. */
export interface SpriteAnchor {
  x: number;
  y: number;
}

export interface BuildingVisualLevel {
  level: number;
  sprite: string;
  /** Resolution-independent anchor inside the sprite image. */
  spriteAnchor: SpriteAnchor;
  /** Display width in runtime world pixels, independent from source resolution. */
  spriteWorldWidth: number;
  footprint: Hex[];
  blocked: Hex[];
  entrance: Hex;
}

export interface BuildingVisualDefinition {
  schema: "civilizations-building-visual";
  version: 4;
  id: string;
  levels: BuildingVisualLevel[];
}

const sameHex = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;
const normalized = (value: number): boolean =>
  Number.isFinite(value) && value >= 0 && value <= 1;
const validSpriteFilename = (value: string): boolean =>
  /^[a-z0-9][a-z0-9._-]*\.(?:png|webp)$/i.test(value) && !value.includes("/");

export function validateBuildingVisualLevel(level: BuildingVisualLevel): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(level.level) || level.level < 1)
    errors.push("Die Gebäudestufe muss eine positive ganze Zahl sein.");
  if (!validSpriteFilename(level.sprite))
    errors.push(`Stufe ${level.level}: Das Sprite muss eine lokale PNG- oder WebP-Datei sein.`);
  if (!normalized(level.spriteAnchor.x) || !normalized(level.spriteAnchor.y))
    errors.push(`Stufe ${level.level}: Der Sprite-Anchor muss normalisiert zwischen 0 und 1 liegen.`);
  if (!Number.isFinite(level.spriteWorldWidth) || level.spriteWorldWidth <= 0)
    errors.push(`Stufe ${level.level}: Die Sprite-Breite in der Spielwelt muss größer als 0 sein.`);
  if (level.footprint.length === 0)
    errors.push(`Stufe ${level.level}: Der Gebäudegrundriss darf nicht leer sein.`);
  if (!level.footprint.some((cell) => sameHex(cell, level.entrance)))
    errors.push(`Stufe ${level.level}: Der Eingang muss innerhalb des Gebäudegrundrisses liegen.`);
  if (level.blocked.some((cell) => !level.footprint.some((footprint) => sameHex(footprint, cell))))
    errors.push(`Stufe ${level.level}: Blockierte Zellen müssen zum Gebäudegrundriss gehören.`);
  if (level.blocked.some((cell) => sameHex(cell, level.entrance)))
    errors.push(`Stufe ${level.level}: Der Eingang darf nicht blockiert sein.`);
  return errors;
}

export function validateBuildingVisualDefinition(
  definition: BuildingVisualDefinition,
): string[] {
  const errors: string[] = [];
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(definition.id))
    errors.push("Die ID darf nur Buchstaben, Zahlen und Bindestriche enthalten.");
  if (!definition.levels.length)
    errors.push("Mindestens eine Gebäudestufe ist erforderlich.");

  const sorted = [...definition.levels].sort((a, b) => a.level - b.level);
  const seenLevels = new Set<number>();
  const seenSprites = new Set<string>();
  for (const level of sorted) {
    if (seenLevels.has(level.level))
      errors.push(`Gebäudestufe ${level.level} ist mehrfach definiert.`);
    seenLevels.add(level.level);
    if (seenSprites.has(level.sprite))
      errors.push(`Das Sprite ${level.sprite} wird von mehreren Gebäudestufen verwendet.`);
    seenSprites.add(level.sprite);
    errors.push(...validateBuildingVisualLevel(level));
  }
  return errors;
}
