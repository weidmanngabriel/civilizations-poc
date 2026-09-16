import type { Hex } from "../simulation/model";

export interface SpriteAnchor {
  x: number;
  y: number;
}

export interface BuildingVisualDefinition {
  schema: "civilizations-building-visual";
  version: 1;
  id: string;
  sprite: string;
  spriteAnchor: SpriteAnchor;
  spriteScale?: number;
  footprint: Hex[];
  blocked: Hex[];
  entrance: Hex;
}

const sameHex = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

export function validateBuildingVisualDefinition(
  definition: BuildingVisualDefinition,
): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9][a-z0-9-]*$/.test(definition.id))
    errors.push("Die ID darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.");
  if (definition.spriteScale !== undefined && (!Number.isFinite(definition.spriteScale) || definition.spriteScale <= 0))
    errors.push("Die Sprite-Skalierung muss größer als 0 sein.");
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
