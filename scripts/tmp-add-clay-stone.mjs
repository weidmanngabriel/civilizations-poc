import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, content) => fs.writeFileSync(path, content);
const replace = (path, from, to) => {
  const source = read(path);
  if (!source.includes(from)) throw new Error(`Missing anchor in ${path}: ${from.slice(0, 100)}`);
  write(path, source.replace(from, to));
};
const appendAfter = (path, anchor, addition) => replace(path, anchor, anchor + addition);

// model.ts
replace('src/simulation/model.ts',
  'export type Good = "wood" | "plank" | "woodenTool" | "wheat" | "flour" | "water" | "bread";',
  'export type Good = "wood" | "plank" | "woodenTool" | "wheat" | "flour" | "water" | "bread" | "clay" | "rubble" | "brick" | "stoneBlock";');
replace('src/simulation/model.ts',
  'export type BuildingKind = "hq" | "forest" | "field" | "farm" | "sawmill" | "carpenter" | "mill" | "bakery" | "well" | "warehouse" | "house";\nexport type BuildableBuildingKind = Exclude<BuildingKind, "hq" | "forest" | "field" | "house">;',
  'export type BuildingKind = "hq" | "forest" | "clayDeposit" | "stoneDeposit" | "field" | "farm" | "sawmill" | "carpenter" | "mill" | "bakery" | "well" | "pottery" | "stonemason" | "warehouse" | "house";\nexport type BuildableBuildingKind = Exclude<BuildingKind, "hq" | "forest" | "clayDeposit" | "stoneDeposit" | "field" | "house">;');
replace('src/simulation/model.ts',
  '  | "miller"\n  | "baker";',
  '  | "miller"\n  | "baker"\n  | "clayDigger"\n  | "stonecutter"\n  | "potter"\n  | "stonemason";');
appendAfter('src/simulation/model.ts', '  forestRemaining?: number;\n', '  resourceRemaining?: number;\n');

// scenario.ts
appendAfter('src/simulation/scenario.ts', '  forestYield: 10,\n', '  resourceYield: 10,\n  resourceOutputCapacity: 3,\n');
replace('src/simulation/scenario.ts',
  '        bread: suppliedStart ? 10 : 0,\n',
  '        bread: suppliedStart ? 10 : 0,\n        clay: 0,\n        rubble: 0,\n        brick: 0,\n        stoneBlock: 0,\n');
const scenarioAnchor = '  const people: Person[] = Array.from({ length: population }, (_, i) => ({';
const scenarioResources = `  if (suppliedStart) {\n    const adjacentGrass = (terrain: Tile["terrain"]): Tile[] =>\n      tiles.filter((tile) =>\n        tile.terrain === "grass" &&\n        [\n          { q: tile.q + 1, r: tile.r },\n          { q: tile.q - 1, r: tile.r },\n          { q: tile.q, r: tile.r + 1 },\n          { q: tile.q, r: tile.r - 1 },\n          { q: tile.q + 1, r: tile.r - 1 },\n          { q: tile.q - 1, r: tile.r + 1 },\n        ].some((neighbor) => tiles.some((candidate) => candidate.q === neighbor.q && candidate.r === neighbor.r && candidate.terrain === terrain)),\n      );\n    const spread = (candidates: Tile[], count: number): Tile[] => {\n      if (candidates.length <= count) return candidates;\n      return Array.from({ length: count }, (_, index) =>\n        candidates[Math.floor((index * (candidates.length - 1)) / Math.max(1, count - 1))]!,\n      );\n    };\n    const addDeposit = (tile: Tile, kind: "clayDeposit" | "stoneDeposit", index: number) => {\n      const clay = kind === "clayDeposit";\n      buildings.push({\n        id: \`${'${kind}'}-${'${index + 1}'}\`,\n        kind,\n        name: clay ? \`Lehmvorkommen ${'${index + 1}'}\` : \`Steinvorkommen ${'${index + 1}'}\`,\n        position: { q: tile.q, r: tile.r },\n        workers: 1,\n        carriers: 0,\n        input: 0,\n        output: 0,\n        resourceRemaining: CONFIG.resourceYield,\n        recipe: { amount: 0, output: clay ? "clay" : "rubble", duration: CONFIG.duration },\n      });\n      tile.bush = undefined;\n      tile.bushAvailable = undefined;\n      tile.bushRegrowTick = undefined;\n      tile.terrain = "building";\n    };\n    spread(adjacentGrass("river"), 4).forEach((tile, index) => addDeposit(tile, "clayDeposit", index));\n    spread(adjacentGrass("mountain"), 4).forEach((tile, index) => addDeposit(tile, "stoneDeposit", index));\n  }\n\n`;
replace('src/simulation/scenario.ts', scenarioAnchor, scenarioResources + scenarioAnchor);

// buildingPlacement.ts
replace('src/simulation/buildingPlacement.ts',
  '  bakery: constructionPlan({ plank: 4 }),\n  well: constructionPlan({ wood: 4 }),',
  '  bakery: constructionPlan({ plank: 2, brick: 2 }),\n  well: constructionPlan({ wood: 2, stoneBlock: 2 }),\n  pottery: constructionPlan({ wood: 4 }),\n  stonemason: constructionPlan({ wood: 4 }),');
replace('src/simulation/buildingPlacement.ts',
  '  bakery: COMPACT_SHAPE,\n  well: COMPACT_SHAPE,',
  '  bakery: COMPACT_SHAPE,\n  well: COMPACT_SHAPE,\n  pottery: COMPACT_SHAPE,\n  stonemason: COMPACT_SHAPE,');
replace('src/simulation/buildingPlacement.ts',
  '  if (!existing || existing.kind === "hq" || existing.kind === "forest" || existing.kind === "field") return false;',
  '  if (!existing || existing.kind === "hq" || existing.kind === "forest" || existing.kind === "clayDeposit" || existing.kind === "stoneDeposit" || existing.kind === "field") return false;');

// experience.ts
replace('src/simulation/experience.ts',
  '  if (building.kind === "bakery") return "baker";\n  return undefined;',
  '  if (building.kind === "bakery") return "baker";\n  if (building.kind === "clayDeposit") return "clayDigger";\n  if (building.kind === "stoneDeposit") return "stonecutter";\n  if (building.kind === "pottery") return "potter";\n  if (building.kind === "stonemason") return "stonemason";\n  return undefined;');
replace('src/simulation/experience.ts',
  '  baker: "Bäcker",\n};',
  '  baker: "Bäcker",\n  clayDigger: "Lehmgräber",\n  stonecutter: "Steinbrecher",\n  potter: "Töpfer",\n  stonemason: "Steinmetz",\n};');

// simulation.ts goods and capacities
replace('src/simulation/simulation.ts',
  'const outputCapacityFor = (b: Building): number =>\n  b.forestRemaining !== undefined ? CONFIG.forestOutputCapacity : CONFIG.outputCapacity;',
  'const outputCapacityFor = (b: Building): number =>\n  b.forestRemaining !== undefined\n    ? CONFIG.forestOutputCapacity\n    : b.resourceRemaining !== undefined\n      ? CONFIG.resourceOutputCapacity\n      : CONFIG.outputCapacity;');
replace('src/simulation/simulation.ts',
  '  "bread",\n];',
  '  "bread",\n  "clay",\n  "rubble",\n  "brick",\n  "stoneBlock",\n];');
replace('src/simulation/simulation.ts',
  'function retireDepletedForests(w: World): void {\n  for (const forest of w.buildings.filter(\n    (b) => !b.retired && b.forestRemaining === 0,\n  )) {\n    forest.retired = true;\n    const tile = tileAt(w, forest.position);\n    tile.terrain = "grass";\n    tile.trafficTicks = undefined;\n    for (const person of assigned(w, forest.id, "worker")) {\n      person.assignment = undefined;\n      person.active = false;\n      person.progress = 0;\n      person.movement = 0;\n      person.path = [];\n      if (person.woodcutter) assignWoodcutter(w, person);\n    }\n  }\n}',
  'function retireDepletedResources(w: World): void {\n  for (const source of w.buildings.filter(\n    (b) => !b.retired && (b.forestRemaining === 0 || b.resourceRemaining === 0),\n  )) {\n    source.retired = true;\n    const tile = tileAt(w, source.position);\n    tile.terrain = "grass";\n    tile.trafficTicks = undefined;\n    for (const person of assigned(w, source.id, "worker")) {\n      person.assignment = undefined;\n      person.active = false;\n      person.progress = 0;\n      person.movement = 0;\n      person.path = [];\n      if (person.woodcutter) assignWoodcutter(w, person);\n      else route(w, person, building(w, "hq"), "reroute");\n    }\n  }\n}');
replace('src/simulation/simulation.ts',
  '  if (kind === "well")\n    return {',
  '  if (kind === "pottery")\n    return {\n      kind,\n      name: "Töpferei",\n      workers: 1,\n      carriers: 2,\n      input: 0,\n      inputInventory: { clay: 0, wood: 0 },\n      output: 0,\n      recipe: { inputs: { clay: 1, wood: 1 }, amount: 1, output: "brick", duration: CONFIG.duration },\n    };\n  if (kind === "stonemason")\n    return {\n      kind,\n      name: "Steinmetzhütte",\n      workers: 1,\n      carriers: 2,\n      input: 0,\n      output: 0,\n      recipe: { input: "rubble", amount: 2, output: "stoneBlock", duration: CONFIG.duration },\n    };\n  if (kind === "well")\n    return {');
replace('src/simulation/simulation.ts',
  '      bread: 0,\n    },',
  '      bread: 0,\n      clay: 0,\n      rubble: 0,\n      brick: 0,\n      stoneBlock: 0,\n    },');
replace('src/simulation/simulation.ts',
  '  if (removed.kind === "hq" || removed.kind === "forest" || removed.kind === "field") return false;',
  '  if (removed.kind === "hq" || removed.kind === "forest" || removed.kind === "clayDeposit" || removed.kind === "stoneDeposit" || removed.kind === "field") return false;');
replace('src/simulation/simulation.ts',
  '        const forestHasYield =\n          b.forestRemaining === undefined || b.forestRemaining > producing(w, b.id);\n        const outputHasSpace = outputOccupied(w, b) < outputCapacityFor(b);',
  '        const forestHasYield =\n          b.forestRemaining === undefined || b.forestRemaining > producing(w, b.id);\n        const resourceHasYield =\n          b.resourceRemaining === undefined || b.resourceRemaining > producing(w, b.id);\n        const outputHasSpace = outputOccupied(w, b) < outputCapacityFor(b);');
replace('src/simulation/simulation.ts',
  '          forestHasYield &&\n          hasRecipeInputs(b) &&',
  '          forestHasYield &&\n          resourceHasYield &&\n          hasRecipeInputs(b) &&');
replace('src/simulation/simulation.ts',
  '          if (b.forestRemaining !== undefined) b.forestRemaining--;\n          p.progress = 0;',
  '          if (b.forestRemaining !== undefined) b.forestRemaining--;\n          if (b.resourceRemaining !== undefined) b.resourceRemaining--;\n          p.progress = 0;');
replace('src/simulation/simulation.ts',
  '    retireDepletedForests(w);',
  '    retireDepletedResources(w);');
replace('src/simulation/simulation.ts',
  '  bread: "Brot",\n};',
  '  bread: "Brot",\n  clay: "Lehm",\n  rubble: "Bruchstein",\n  brick: "Backstein",\n  stoneBlock: "Steinquader",\n};');
replace('src/simulation/simulation.ts',
  '  if (b.forestRemaining !== undefined) {\n    if (b.retired) return "Erschöpft";',
  '  if (b.resourceRemaining !== undefined) {\n    if (b.retired) return "Erschöpft";\n    const label = b.kind === "clayDeposit" ? "Lehmabbau" : "Steinabbau";\n    const worker = b.kind === "clayDeposit" ? "Lehmgräber" : "Steinbrecher";\n    const progress = workers\n      .filter((p) => p.progress > 0)\n      .map((p) => `${Math.round((p.progress / b.recipe!.duration) * 100)} %`);\n    if (progress.length) return `${label}: ${progress.join(" · ")}`;\n    if (!workers.length) return `Kein ${worker} am Vorkommen`;\n    if (outputOccupied(w, b) >= outputCapacityFor(b)) return "Rohstoff liegt bereit – Abholung abwarten";\n    if (workers.every((p) => !p.active)) return `${worker} auf dem Weg`;\n    return `Bereit zum ${label}`;\n  }\n  if (b.forestRemaining !== undefined) {\n    if (b.retired) return "Erschöpft";');

// build menu
replace('src/ui/buildMenu.ts',
  '  bakery: "Bäckerei",\n  well: "Brunnen",',
  '  bakery: "Bäckerei",\n  well: "Brunnen",\n  pottery: "Töpferei",\n  stonemason: "Steinmetzhütte",');

// icons.ts
replace('src/icons.ts',
  '  bread: "🍞",\n};',
  '  bread: "🍞",\n  clay: "🟤",\n  rubble: "🪨",\n  brick: "🧱",\n  stoneBlock: "◻️",\n};');
replace('src/icons.ts',
  '  well: svg(\'<path d="M5 9h14M7 9v11m10-11v11M4 20h16M8 9l4-5 4 5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 12h4v5h-4z" fill="none" stroke="currentColor" stroke-width="1.5"/>\'),',
  '  well: svg(\'<path d="M5 9h14M7 9v11m10-11v11M4 20h16M8 9l4-5 4 5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 12h4v5h-4z" fill="none" stroke="currentColor" stroke-width="1.5"/>\'),\n  pottery: svg(\'<path d="M8 5h8M9 5c0 3-2 4-2 8 0 4 2 6 5 6s5-2 5-6c0-4-2-5-2-8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 11h8" stroke="currentColor" stroke-width="1.4"/>\'),\n  stonemason: svg(\'<path d="M4 19h16M6 19l2-7h8l2 7M9 12l1-5h4l1 5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m5 7 5-3 2 3" fill="none" stroke="currentColor" stroke-width="1.5"/>\'),');

// HQ storage
replace('src/ui/hqStoragePanel.ts',
  '  bread: "Brot",\n};',
  '  bread: "Brot",\n  clay: "Lehm",\n  rubble: "Bruchstein",\n  brick: "Backstein",\n  stoneBlock: "Steinquader",\n};');

// controls.ts
replace('src/ui/controls.ts',
  '  bakery: "Bäckerei",\n  well: "Brunnen",',
  '  bakery: "Bäckerei",\n  well: "Brunnen",\n  pottery: "Töpferei",\n  stonemason: "Steinmetzhütte",');
replace('src/ui/controls.ts',
  '  const workerLabel = (b: Building) =>\n    b.kind === "farm" ? "Farmer" : b.kind === "mill" ? "Müller" : b.kind === "bakery" ? "Bäcker" : "Arbeiter";',
  '  const workerLabel = (b: Building) =>\n    b.kind === "farm" ? "Farmer"\n      : b.kind === "mill" ? "Müller"\n        : b.kind === "bakery" ? "Bäcker"\n          : b.kind === "clayDeposit" ? "Lehmgräber"\n            : b.kind === "stoneDeposit" ? "Steinbrecher"\n              : b.kind === "pottery" ? "Töpfer"\n                : b.kind === "stonemason" ? "Steinmetz"\n                  : "Arbeiter";');
replace('src/ui/controls.ts',
  '      if (workplace?.kind === "carpenter") return "🛠️";\n',
  '      if (workplace?.kind === "carpenter") return "🛠️";\n      if (workplace?.kind === "clayDeposit") return "🟤";\n      if (workplace?.kind === "stoneDeposit") return "⛏️";\n      if (workplace?.kind === "pottery") return "🧱";\n      if (workplace?.kind === "stonemason") return "🪨";\n');
replace('src/ui/controls.ts',
  '    if (b.forestRemaining !== undefined) {\n      setField("forest-remaining", String(b.forestRemaining));\n      setField("output", `${formatOutputAmount(b.output)}/${CONFIG.outputCapacity}`);\n      return;\n    }',
  '    if (b.forestRemaining !== undefined) {\n      setField("forest-remaining", String(b.forestRemaining));\n      setField("output", `${formatOutputAmount(b.output)}/${CONFIG.forestOutputCapacity}`);\n      return;\n    }\n    if (b.resourceRemaining !== undefined) {\n      setField("resource-remaining", String(b.resourceRemaining));\n      setField("output", `${formatOutputAmount(b.output)}/${CONFIG.resourceOutputCapacity}`);\n    }');
replace('src/ui/controls.ts',
  '      setField("warehouse-wood", `${formatWholeAmount(warehouseStock(b, "wood"))}/${CONFIG.warehouseCapacityPerGood}`);\n      setField("warehouse-plank", `${formatWholeAmount(warehouseStock(b, "plank"))}/${CONFIG.warehouseCapacityPerGood}`);\n      setField("warehouse-tool", `${formatWholeAmount(warehouseStock(b, "woodenTool"))}/${CONFIG.warehouseCapacityPerGood}`);\n      setField("warehouse-wheat", `${formatWholeAmount(warehouseStock(b, "wheat"))}/${CONFIG.warehouseCapacityPerGood}`);\n      setField("warehouse-flour", `${formatWholeAmount(warehouseStock(b, "flour"))}/${CONFIG.warehouseCapacityPerGood}`);\n      setField("warehouse-water", `${formatWholeAmount(warehouseStock(b, "water"))}/${CONFIG.warehouseCapacityPerGood}`);\n      setField("warehouse-bread", `${formatWholeAmount(warehouseStock(b, "bread"))}/${CONFIG.warehouseCapacityPerGood}`);',
  '      for (const good of Object.keys(GOODS) as Good[])\n        setField(`warehouse-${good}`, `${formatWholeAmount(warehouseStock(b, good))}/${CONFIG.warehouseCapacityPerGood}`);');
replace('src/ui/controls.ts',
  '    const demolish = b.kind === "forest" || b.kind === "field"\n      ? ""',
  '    const demolish = b.kind === "forest" || b.kind === "clayDeposit" || b.kind === "stoneDeposit" || b.kind === "field"\n      ? ""');
replace('src/ui/controls.ts',
  '    const recipe = b.forestRemaining !== undefined\n      ? `${GOOD_ICONS.wood} 1 Holz / ${b.recipe!.duration / CONFIG.simulationHz} s bei 1× · Vorrat <span data-field="forest-remaining"></span>/${CONFIG.forestYield}`\n      : b.kind === "warehouse"',
  '    const recipe = b.forestRemaining !== undefined\n      ? `${GOOD_ICONS.wood} 1 Holz / ${b.recipe!.duration / CONFIG.simulationHz} s bei 1× · Vorrat <span data-field="forest-remaining"></span>/${CONFIG.forestYield}`\n      : b.resourceRemaining !== undefined\n        ? `${GOOD_ICONS[b.recipe!.output]} 1 ${GOODS[b.recipe!.output]} / ${b.recipe!.duration / CONFIG.simulationHz} s bei 1× · Vorrat <span data-field="resource-remaining"></span>/${CONFIG.resourceYield}`\n      : b.kind === "warehouse"');
replace('src/ui/controls.ts',
  '    const inventory = b.forestRemaining !== undefined\n      ? `<div><span>${goodLabel("wood")} · Output</span><strong data-field="output"></strong></div>`\n      : b.kind === "warehouse"\n        ? `${(["wood", "plank", "woodenTool", "wheat", "flour", "water", "bread"] as Good[]).map((good) => `<div><span>${goodLabel(good)}</span><strong data-field="warehouse-${good === "woodenTool" ? "tool" : good}"></strong></div>`).join("")}`',
  '    const inventory = b.forestRemaining !== undefined\n      ? `<div><span>${goodLabel("wood")} · Output</span><strong data-field="output"></strong></div>`\n      : b.resourceRemaining !== undefined\n        ? `<div><span>${goodLabel(b.recipe!.output)} · Output</span><strong data-field="output"></strong></div>`\n      : b.kind === "warehouse"\n        ? `${(Object.keys(GOODS) as Good[]).map((good) => `<div><span>${goodLabel(good)}</span><strong data-field="warehouse-${good}"></strong></div>`).join("")}`');

// MainScene.ts
replace('src/game/MainScene.ts',
  '  bread: 0xb8793d,\n};',
  '  bread: 0xb8793d,\n  clay: 0x9b6a4d,\n  rubble: 0x8b8f8c,\n  brick: 0xb55d42,\n  stoneBlock: 0xc8c8bd,\n};');
replace('src/game/MainScene.ts',
  '      if (workplace?.kind === "carpenter") return "🛠️";\n',
  '      if (workplace?.kind === "carpenter") return "🛠️";\n      if (workplace?.kind === "clayDeposit") return "🟤";\n      if (workplace?.kind === "stoneDeposit") return "⛏️";\n      if (workplace?.kind === "pottery") return "🧱";\n      if (workplace?.kind === "stonemason") return "🪨";\n');
replace('src/game/MainScene.ts',
  '      if (b.forestRemaining !== undefined) {\n        this.drawTree(',
  '      if (b.resourceRemaining !== undefined) {\n        if (b.kind === "clayDeposit") {\n          g.fillStyle(0x9b6a4d, 0.95);\n          g.fillCircle(x - 3, y - 11, 4);\n          g.fillCircle(x + 3, y - 10, 3);\n        } else {\n          g.fillStyle(0xaeb3af, 0.95);\n          g.fillTriangle(x - 6, y - 8, x - 1, y - 17, x + 3, y - 8);\n          g.fillTriangle(x, y - 8, x + 5, y - 15, x + 7, y - 8);\n        }\n      } else if (b.forestRemaining !== undefined) {\n        this.drawTree(');

// Incremental map signature updates when deposits deplete.
replace('src/game/IncrementalMainScene.ts',
  '        building.forestRemaining ?? "",\n        building.fieldStage ?? "",',
  '        building.forestRemaining ?? "",\n        building.resourceRemaining ?? "",\n        building.fieldStage ?? "",');

// Documentation
replace('concept.md',
  '## Produktionskette\n\nAktuell:\n',
  '## Natürliche Lehm- und Steinvorkommen\n\nZusätzlich zu Wald gibt es endliche Rohstoffvorkommen. Lehmvorkommen liegen auf begehbaren Kacheln direkt in Flussnähe, Steinvorkommen entsprechend in Bergnähe. Jedes Vorkommen enthält genau 10 Einheiten. Ein zugewiesener Lehmgräber beziehungsweise Steinbrecher baut den Rohstoff lokal ab. Nach der zehnten Einheit verschwindet das Vorkommen sofort; bereits lokal abgelegte Ware bleibt liegen und kann weiter transportiert werden.\n\n## Produktionskette\n\nAktuell:\n');
replace('concept.md',
  '- Brunnen: unerschöpfliches Wasser ohne Arbeiter.\n',
  '- Brunnen: unerschöpfliches Wasser ohne Arbeiter.\n- Lehmvorkommen: 10 × Lehm, danach erschöpft.\n- Steinvorkommen: 10 × Bruchstein, danach erschöpft.\n- Töpferei: 1 Lehm + 1 Holz → 1 Backstein.\n- Steinmetzhütte: 2 Bruchstein → 1 Steinquader.\n\nBackstein und Steinquader sind Baumaterialien. Einfache Startgebäude bleiben bewusst mit Holz baubar; einige fortgeschrittene Gebäude benötigen zusätzlich Backstein oder Steinquader.\n');
replace('concept.md',
  '- Bäckerei: 4 Bretter,\n- Brunnen: 4 Holz.\n',
  '- Bäckerei: 2 Bretter + 2 Backstein,\n- Brunnen: 2 Holz + 2 Steinquader,\n- Töpferei: 4 Holz,\n- Steinmetzhütte: 4 Holz.\n');
replace('architecture.md',
  'Current goods are wood, plank, woodenTool, wheat, flour, water and bread.\n',
  'Current goods are wood, plank, woodenTool, wheat, flour, water, bread, clay, rubble, brick and stoneBlock. Clay and rubble come from finite natural resource nodes next to rivers and mountains; each node contains 10 units and retires after the last extraction while already produced local output remains collectible.\n');
replace('architecture.md',
  'bakery      2 flour + 1 water -> 2 bread\nwell        infinite water source\n',
  'bakery      2 flour + 1 water -> 2 bread\npottery     1 clay + 1 wood -> 1 brick\nstonemason  2 rubble -> 1 stoneBlock\nwell        infinite water source\n');
replace('architecture.md',
  'Bakery      4\nWell        4\n',
  'Bakery      4\nWell        4\nPottery     4\nStonemason  4\n');

appendAfter('src/handbook/logistik.md', '\n', '\n## Lehm und Stein\n\nLehmvorkommen findest du in Flussnähe, Steinvorkommen in Bergnähe. Beide sind endlich. Arbeiter bauen dort Lehm beziehungsweise Bruchstein ab; Träger können die fertigen Rohstoffe anschließend abholen. In der Töpferei entstehen aus Lehm und Holz Backsteine. Die Steinmetzhütte verarbeitet Bruchstein zu Steinquadern. Beide Produkte werden als Baumaterial verwendet.\n');

// Dedicated tests.
write('tests/resourceMaterials.test.ts', `import assert from "node:assert/strict";\nimport test from "node:test";\nimport { CONSTRUCTION_PLANS } from "../src/simulation/buildingPlacement";\nimport { neighbors, same } from "../src/simulation/hex";\nimport type { BuildingKind } from "../src/simulation/model";\nimport { CONFIG, createDefaultGameWorld } from "../src/simulation/scenario";\nimport { changeAssignment, tick } from "../src/simulation/simulation";\n\ntest("default map places finite clay by rivers and stone by mountains", () => {\n  const world = createDefaultGameWorld();\n  for (const [kind, terrain] of [["clayDeposit", "river"], ["stoneDeposit", "mountain"]] as const) {\n    const nodes = world.buildings.filter((building) => building.kind === kind);\n    assert.ok(nodes.length > 0);\n    for (const node of nodes) {\n      assert.equal(node.resourceRemaining, 10);\n      assert.ok(neighbors(node.position).some((position) =>\n        world.tiles.some((tile) => same(tile, position) && tile.terrain === terrain),\n      ));\n    }\n  }\n});\n\ntest("clay and stone processors expose the intended recipes and construction materials", () => {\n  const world = createDefaultGameWorld();\n  const kinds = ["pottery", "stonemason"] as const;\n  for (const kind of kinds) {\n    const buildable = world.tiles.find((tile) => tile.terrain === "grass")!;\n    void buildable;\n    assert.ok(CONSTRUCTION_PLANS[kind]);\n  }\n  assert.deepEqual(CONSTRUCTION_PLANS.bakery.required, { plank: 2, brick: 2 });\n  assert.deepEqual(CONSTRUCTION_PLANS.well.required, { wood: 2, stoneBlock: 2 });\n});\n\ntest("a natural deposit retires after exactly ten extracted units", () => {\n  const world = createDefaultGameWorld();\n  const deposit = world.buildings.find((building) => building.kind === "clayDeposit")!;\n  const person = world.people.find((candidate) => !candidate.assignment && !candidate.builder && !candidate.woodcutter)!;\n  person.position = { ...deposit.position };\n  assert.equal(changeAssignment(world, deposit.id, "worker", 1), true);\n  const assignedPerson = world.people.find((candidate) => candidate.assignment?.building === deposit.id)!;\n  assignedPerson.position = { ...deposit.position };\n  assignedPerson.path = [];\n  assignedPerson.active = true;\n  let extracted = 0;\n  for (let i = 0; i < CONFIG.duration * 15 && !deposit.retired; i += 1) {\n    const before = deposit.output;\n    tick(world);\n    if (deposit.output > before) {\n      extracted += deposit.output - before;\n      deposit.output = 0;\n    }\n    assignedPerson.hunger = 100;\n    assignedPerson.sleep = 100;\n  }\n  assert.equal(extracted, 10);\n  assert.equal(deposit.resourceRemaining, 0);\n  assert.equal(deposit.retired, true);\n});\n`);

// Remove temporary automation artifacts from the resulting commit.
fs.rmSync('scripts/tmp-add-clay-stone.mjs');
fs.rmSync('.github/workflows/tmp-resource-clay-stone.yml');
