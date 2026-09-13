const BASE_PERSON_NAMES = [
  "Erik",
  "Astrid",
  "Leif",
  "Freya",
  "Björn",
  "Sigrid",
  "Sven",
  "Ingrid",
  "Knut",
  "Runa",
  "Torsten",
  "Liv",
  "Arne",
  "Solveig",
  "Hakon",
  "Tora",
  "Ivar",
  "Alva",
  "Nils",
  "Yrsa",
  "Sten",
  "Eira",
  "Gunnar",
  "Frida",
] as const;

/**
 * Gives every simulation person a stable human-readable identity without adding
 * presentation state to the world model. Person ids are persistent already, so
 * the same id always resolves to the same name.
 */
export function personName(personId: number): string {
  const normalizedId = Math.max(1, Math.trunc(personId));
  const zeroBased = normalizedId - 1;
  const baseName = BASE_PERSON_NAMES[zeroBased % BASE_PERSON_NAMES.length]!;
  const cycle = Math.floor(zeroBased / BASE_PERSON_NAMES.length);
  return cycle === 0 ? baseName : `${baseName} ${cycle + 1}`;
}
