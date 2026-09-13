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
  fs.writeFileSync(path, text);
}

{
  const path = "tests/simulation.test.ts";
  let text = fs.readFileSync(path, "utf8");
  text = replace(text, `  changeWoodcutters,\n  removeBuilding,`, `  changeWoodcutters,\n  naturalResource,\n  removeBuilding,`, "simulation naturalResource import");
  text = replace(text, `  const forest = building(w, p.assignment!.building);`, `  const forest = naturalResource(w, p.resourceTarget!);`, "simulation woodcutter helper target");
  text = replace(text, `    if (b.forestRemaining !== undefined) {\n      assert.ok(b.forestRemaining >= 0 && b.forestRemaining <= CONFIG.forestYield);\n      assert.ok(assigned(w, b.id, "worker").length <= 1);\n    }\n  }\n}`, `  }\n  for (const resource of w.naturalResources) {\n    assert.ok(resource.remaining >= 0 && resource.remaining <= CONFIG.resourceYield);\n    assert.ok(resource.output >= 0 && resource.output <= CONFIG.resourceOutputCapacity);\n    assert.ok(w.people.filter((person) => person.resourceTarget === resource.id).length <= 1);\n  }\n}`, "simulation resource invariants");
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
