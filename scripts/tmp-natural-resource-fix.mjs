import fs from "node:fs";

const replace = (text, from, to, label) => {
  if (!text.includes(from)) throw new Error(`Pattern not found: ${label}`);
  return text.replace(from, to);
};

{
  const path = "src/simulation/simulation.ts";
  let text = fs.readFileSync(path, "utf8");
  const stale = `  const progress = workers
      .filter((p) => p.progress > 0)
      .map((p) => \`${'${'}Math.round((p.progress / b.recipe!.duration) * 100)} %\`);
    if (progress.length) return \`Holzabbau: ${'${'}progress.join(" · ")}\`;
    if (!workers.length) return "Kein Holzfäller am Wald";
    if (outputOccupied(w, b) >= outputCapacityFor(b))
      return "Holz liegt bereit – Abholung abwarten";
    if (workers.every((p) => !p.active)) return "Holzfäller auf dem Weg";
    return "Bereit zum Holzabbau";
  }
`;
  text = replace(text, stale, "", "stale forest building status block");
  text = replace(
    text,
    `const naturalOutputCapacity = (_resource: NaturalResource): number => CONFIG.resourceOutputCapacity;`,
    `const naturalOutputCapacity = (resource: NaturalResource): number =>\n  resource.kind === "forest" ? CONFIG.forestOutputCapacity : CONFIG.resourceOutputCapacity;`,
    "natural output capacity by resource kind",
  );
  fs.writeFileSync(path, text);
}

{
  const path = "src/ui/performanceDebug.ts";
  let text = fs.readFileSync(path, "utf8");
  text = replace(
    text,
    `  const forests = activeBuildings.filter((building) => building.forestRemaining !== undefined).length;`,
    `  const forests = world.naturalResources.filter((resource) => resource.kind === "forest" && !resource.depleted).length;`,
    "performance debug forest count",
  );
  fs.writeFileSync(path, text);
}

{
  const path = "tests/simulation.test.ts";
  let text = fs.readFileSync(path, "utf8");
  text = replace(text, `  changeWoodcutters,\n  removeBuilding,`, `  changeWoodcutters,\n  naturalResource,\n  removeBuilding,`, "simulation naturalResource import");
  text = replace(text, `  const forest = building(w, p.assignment!.building);`, `  const forest = naturalResource(w, p.resourceTarget!);`, "simulation woodcutter helper target");
  text = replace(text, `    if (b.forestRemaining !== undefined) {\n      assert.ok(b.forestRemaining >= 0 && b.forestRemaining <= CONFIG.forestYield);\n      assert.ok(assigned(w, b.id, "worker").length <= 1);\n    }\n  }\n}`, `  }\n  for (const resource of w.naturalResources) {\n    const capacity = resource.kind === "forest" ? CONFIG.forestOutputCapacity : CONFIG.resourceOutputCapacity;\n    assert.ok(resource.remaining >= 0 && resource.remaining <= CONFIG.resourceYield);\n    assert.ok(resource.output >= 0 && resource.output <= capacity);\n    assert.ok(w.people.filter((person) => person.resourceTarget === resource.id).length <= 1);\n  }\n}`, "simulation resource invariants");
  text = replace(text, `  assert.equal(assigned(w, forest.id, "worker").length, 1);`, `  assert.equal(w.people.filter((person) => person.resourceTarget === forest.id).length, 1);`, "simulation forest occupancy assertion");
  fs.writeFileSync(path, text);
}

{
  const path = "tests/worker-input.test.ts";
  let text = fs.readFileSync(path, "utf8");
  text = replace(text, `  changeWoodcutters,\n  tick,`, `  changeWoodcutters,\n  naturalResource,\n  tick,`, "worker input naturalResource import");
  text = replace(text, `  const forest = building(world, woodcutter.assignment!.building);`, `  const forest = naturalResource(world, woodcutter.resourceTarget!);`, "worker input forest target");
  text = text.replaceAll(`    source: forest.id,\n    target: sawmill.id,`, `    source: forest.id,\n    sourceKind: "resource",\n    target: sawmill.id,`);
  fs.writeFileSync(path, text);
}

{
  const path = "tests/construction.test.ts";
  let text = fs.readFileSync(path, "utf8");
  text = replace(
    text,
    `  world.buildings.push({\n    id: "test-wood-source",\n    kind: "forest",\n    name: "Testholz",\n    position: { ...sourcePosition! },\n    workers: 0,\n    carriers: 0,\n    input: 0,\n    output: 4,\n    recipe: { amount: 0, output: "wood", duration: 1 },\n  });`,
    `  world.buildings.push({\n    id: "test-wood-source",\n    kind: "warehouse",\n    name: "Testholz-Lager",\n    position: { ...sourcePosition! },\n    workers: 0,\n    carriers: 0,\n    merchants: 0,\n    input: 0,\n    output: 0,\n    inventory: { wood: 4 },\n  });`,
    "construction wood source",
  );
  text = replace(
    text,
    `  world.buildings.push({ id: "ready-wood-source", kind: "forest", name: "Bereites Holz", position: { q: sourcePosition!.q, r: sourcePosition!.r }, workers: 0, carriers: 0, input: 0, output: 4, recipe: { amount: 0, output: "wood", duration: 1 } });`,
    `  world.buildings.push({ id: "ready-wood-source", kind: "warehouse", name: "Bereites Holz", position: { q: sourcePosition!.q, r: sourcePosition!.r }, workers: 0, carriers: 0, merchants: 0, input: 0, output: 0, inventory: { wood: 4 } });`,
    "construction ready wood source",
  );
  fs.writeFileSync(path, text);
}

{
  const path = "tests/hunger.test.ts";
  let text = fs.readFileSync(path, "utf8");
  text = replace(
    text,
    `import type { Building, World } from "../src/simulation/model";`,
    `import type { Building, NaturalResource, World } from "../src/simulation/model";`,
    "hunger NaturalResource import",
  );
  text = replace(
    text,
    `  const woodSource: Building = {\n    id: "test-wood",\n    kind: "forest",\n    name: "Testholz",\n    position: { q: hq.position.q + 3, r: hq.position.r },\n    workers: 0,\n    carriers: 0,\n    input: 0,\n    output: 3,\n    forestRemaining: 10,\n    recipe: { amount: 0, output: "wood", duration: 240 },\n  };\n  world.buildings.push(sawmill, woodSource);`,
    `  const woodSource: NaturalResource = {\n    id: "test-wood",\n    kind: "forest",\n    position: { q: hq.position.q + 3, r: hq.position.r },\n    remaining: 10,\n    output: 3,\n  };\n  world.buildings.push(sawmill);\n  world.naturalResources.push(woodSource);`,
    "hunger natural wood source",
  );
  fs.writeFileSync(path, text);
}
