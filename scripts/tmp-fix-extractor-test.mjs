import fs from 'node:fs';

const path = 'tests/resourceMaterials.test.ts';
let text = fs.readFileSync(path, 'utf8');
const from = `  const world = createDefaultGameWorld();\n  const deposit = world.buildings.find((building) => building.kind === "clayDeposit")!;\n  assert.equal(changeExtractors(world, "clay", 1), true);\n  const assignedPerson = clayDiggers(world)[0]!;\n  assignedPerson.position = { ...deposit.position };\n`;
const to = `  const world = createDefaultGameWorld();\n  assert.equal(changeExtractors(world, "clay", 1), true);\n  const assignedPerson = clayDiggers(world)[0]!;\n  const deposit = world.buildings.find((building) => building.id === assignedPerson.assignment?.building)!;\n  assert.equal(deposit.kind, "clayDeposit");\n  assignedPerson.position = { ...deposit.position };\n`;
if (!text.includes(from)) throw new Error('Extractor test pattern not found');
text = text.replace(from, to);
fs.writeFileSync(path, text);
