import fs from 'node:fs';

const replace = (path, from, to) => {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`Missing anchor in ${path}`);
  fs.writeFileSync(path, source.replace(from, to));
};

replace(
  'src/simulation/experience.ts',
  'export const woodcuttingSpeedMultiplier = (p: Person): number =>\n  1 + 0.5 * professionExperience(p, "woodcutter") / 100;\n',
  'export const woodcuttingSpeedMultiplier = (p: Person): number =>\n  1 + 0.5 * professionExperience(p, "woodcutter") / 100;\n\nexport const extractionSpeedMultiplier = (\n  p: Person,\n  profession: "woodcutter" | "clayDigger" | "stonecutter",\n): number => 1 + 0.5 * professionExperience(p, profession) / 100;\n',
);

replace(
  'src/simulation/simulation.ts',
  '  logisticsSpeedMultiplier,\n  productionMultiplier,\n  woodcuttingSpeedMultiplier,\n  workerProfession,',
  '  extractionSpeedMultiplier,\n  logisticsSpeedMultiplier,\n  productionMultiplier,\n  workerProfession,',
);

replace(
  'src/simulation/simulation.ts',
  '        const outputHasSpace = outputOccupied(w, b) < outputCapacityFor(b);\n        const workSpeed = b.kind === "forest" ? woodcuttingSpeedMultiplier(p) : 1;',
  '        const outputHasSpace = outputOccupied(w, b) < outputCapacityFor(b);\n        const naturalExtraction = b.kind === "forest" || b.resourceRemaining !== undefined;\n        const workSpeed =\n          naturalExtraction &&\n          (profession === "woodcutter" || profession === "clayDigger" || profession === "stonecutter")\n            ? extractionSpeedMultiplier(p, profession)\n            : 1;',
);

replace(
  'src/simulation/simulation.ts',
  '          const multiplier =\n            b.kind === "forest"\n              ? 1\n              : profession\n                ? productionMultiplier(p, profession)\n                : 1;',
  '          const multiplier =\n            naturalExtraction\n              ? 1\n              : profession\n                ? productionMultiplier(p, profession)\n                : 1;',
);

fs.rmSync('scripts/tmp-fix-resource-yield.mjs');
