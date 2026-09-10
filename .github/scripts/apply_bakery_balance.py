from pathlib import Path


def replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing pattern in {path}: {old[:80]}')
    p.write_text(text.replace(old, new))

replace('src/simulation/model.ts',
'''export interface Recipe {\n  input?: Good;\n  inputs?: GoodAmounts;\n  amount: number;\n  output: Good;\n  duration: number;\n}''',
'''export interface Recipe {\n  input?: Good;\n  inputs?: GoodAmounts;\n  amount: number;\n  output: Good;\n  outputAmount?: number;\n  duration: number;\n}''')

replace('src/simulation/simulation.ts',
'''const producing = (w: World, id: BuildingId) =>\n  w.people.filter((p) => p.assignment?.building === id && p.progress > 0 && !p.farmTask)\n    .length;\nexport const outputOccupied = (w: World, b: Building): number =>\n  b.output + heldOutput(w, b.id) + producing(w, b.id);''',
'''const producing = (w: World, id: BuildingId) =>\n  w.people.filter((p) => p.assignment?.building === id && p.progress > 0 && !p.farmTask)\n    .length;\nconst recipeOutputAmount = (b: Building): number => b.recipe?.outputAmount ?? 1;\nexport const outputOccupied = (w: World, b: Building): number =>\n  b.output + heldOutput(w, b.id) + producing(w, b.id) * recipeOutputAmount(b);''')

replace('src/simulation/simulation.ts',
'''  const goods: Good[] = construction\n    ? (Object.keys(construction.required) as Good[]).filter(\n        (good) =>\n          (construction.delivered[good] ?? 0) + incoming(w, b.id, good) <\n          (construction.required[good] ?? 0),\n      )\n    : isWarehouseCollection\n      ? ALL_GOODS\n      : (Object.keys(recipeRequirements(b)) as Good[]).filter((good) =>\n          inputHasSpace(w, b, good),\n        );\n  if (!goods.length) return;\n\n  const sources: SourceCandidate[] = [];\n  for (const good of goods) {''',
'''  const recipeGoods = (Object.keys(recipeRequirements(b)) as Good[]).filter((good) =>\n    inputHasSpace(w, b, good),\n  );\n  const missingForNextBatch = recipeGoods.filter((good) =>\n    inputStock(b, good) + incoming(w, b.id, good) < (recipeRequirements(b)[good] ?? 0),\n  );\n  const goods: Good[] = construction\n    ? (Object.keys(construction.required) as Good[]).filter(\n        (good) =>\n          (construction.delivered[good] ?? 0) + incoming(w, b.id, good) <\n          (construction.required[good] ?? 0),\n      )\n    : isWarehouseCollection\n      ? ALL_GOODS\n      : missingForNextBatch.length\n        ? missingForNextBatch\n        : recipeGoods;\n  if (!goods.length) return;\n\n  const collectSources = (candidateGoods: Good[]): SourceCandidate[] => {\n    const sources: SourceCandidate[] = [];\n    for (const good of candidateGoods) {''')

replace('src/simulation/simulation.ts',
'''      if (path) sources.push({ source, good, path });\n    }\n  }\n  sources.sort(\n    (a, b) =>\n      pathTravelCost(w.tiles, a.path, CONFIG.roadSpeedMultiplier) -\n      pathTravelCost(w.tiles, b.path, CONFIG.roadSpeedMultiplier),\n  );\n  const source = sources[0];''',
'''      if (path) sources.push({ source, good, path });\n      }\n    }\n    sources.sort(\n      (a, b) =>\n        pathTravelCost(w.tiles, a.path, CONFIG.roadSpeedMultiplier) -\n        pathTravelCost(w.tiles, b.path, CONFIG.roadSpeedMultiplier),\n    );\n    return sources;\n  };\n  let sources = collectSources(goods);\n  if (!sources.length && !construction && !isWarehouseCollection && missingForNextBatch.length)\n    sources = collectSources(recipeGoods);\n  const source = sources[0];''')

replace('src/simulation/simulation.ts',
'''      recipe: { inputs: { flour: 1, water: 1 }, amount: 1, output: "bread", duration: CONFIG.duration },''',
'''      recipe: { inputs: { flour: 2, water: 1 }, amount: 1, output: "bread", outputAmount: 2, duration: CONFIG.duration },''')

replace('src/simulation/simulation.ts',
'''        outputOccupied(w, b) < CONFIG.outputCapacity\n      )''',
'''        outputOccupied(w, b) + recipeOutputAmount(b) <= CONFIG.outputCapacity\n      )''')

replace('src/simulation/simulation.ts',
'''        consumeRecipeInputs(b);\n        b.output++;''',
'''        consumeRecipeInputs(b);\n        b.output += recipeOutputAmount(b);''')

replace('src/ui/controls.ts',
'''              ? `${recipeInputs.map(([good, amount]) => `${GOOD_ICONS[good]} ${amount} ${GOODS[good]}`).join(" + ")} → ${GOOD_ICONS[b.recipe.output]} 1 ${GOODS[b.recipe.output]}`''',
'''              ? `${recipeInputs.map(([good, amount]) => `${GOOD_ICONS[good]} ${amount} ${GOODS[good]}`).join(" + ")} → ${GOOD_ICONS[b.recipe.output]} ${b.recipe.outputAmount ?? 1} ${GOODS[b.recipe.output]}`''')

replace('tests/bread-chain.test.ts',
'''  assert.ok(bakery.output > 0, "expected bread to be produced");\n  assert.equal(well.output, 0, "well water must not be depleted");''',
'''  assert.equal(bakery.output, 2, "one bakery batch should produce two bread");\n  assert.equal(well.output, 0, "well water must not be depleted");''')

insert = '''\n\ntest("bakery fetches only what the next batch needs before topping up another input", () => {\n  const world = createWorld(3);\n  const bakery = buildAt(world, { q: 0, r: 0 }, "bakery")!;\n  const well = buildAt(world, { q: 1, r: 0 }, "well")!;\n  const warehouse = buildAt(world, { q: 4, r: 0 }, "warehouse")!;\n  warehouse.inventory!.flour = 4;\n\n  assert.equal(changeAssignment(world, bakery.id, "worker", 1), true);\n  const baker = activateWorker(world, bakery.id);\n\n  tick(world);\n  assert.equal(baker.trip?.good, "water");\n\n  for (let i = 0; i < 1200 && (bakery.inputInventory?.water ?? 0) < 1; i++) tick(world);\n  assert.equal(bakery.inputInventory?.water, 1);\n  assert.equal(baker.trip?.good, "flour", "after one required water, flour must be prioritized over more water");\n\n  for (let i = 0; i < 2400 && (bakery.inputInventory?.flour ?? 0) < 2; i++) tick(world);\n  assert.equal(bakery.inputInventory?.flour, 2);\n  assert.equal(bakery.inputInventory?.water, 1);\n});\n'''
p = Path('tests/bread-chain.test.ts')
p.write_text(p.read_text() + insert)

replace('concept.md',
'''- Bäckerei: 1 Mehl + 1 Wasser → 1 Brot in ca. 4 Sekunden; ein Bäcker arbeitet dort.''',
'''- Bäckerei: 2 Mehl + 1 Wasser → 2 Brot in ca. 4 Sekunden; ein Bäcker arbeitet dort.''')
replace('concept.md',
'''Produzierte Waren bleiben lokal liegen, bis eine Person sie transportiert. Eine Person trägt aktuell genau eine Einheit pro Transportweg.''',
'''Produzierte Waren bleiben lokal liegen, bis eine Person sie transportiert. Eine Person trägt aktuell genau eine Einheit pro Transportweg. Bei Produktionsgebäuden mit mehreren Inputs wird zuerst nur der Bedarf für den nächsten vollständigen Produktionslauf beschafft; erst wenn dafür keine fehlende Zutat mehr gezielt geholt werden kann, werden freie Inputplätze weiter aufgefüllt.''')

replace('architecture.md',
'''- bakery: 1 flour + 1 water → 1 bread / ~4 seconds.''',
'''- bakery: 2 flour + 1 water → 2 bread / ~4 seconds.''')
replace('architecture.md',
'''Generic production still uses recipes and local input/output capacities. Trips represent reservations directly: an unpicked trip reserves source stock, an incoming trip reserves destination capacity and a picked trip physically carries one unit.''',
'''Generic production still uses recipes and local input/output capacities. Recipes may define an output amount greater than one. Trips represent reservations directly: an unpicked trip reserves source stock, an incoming trip reserves destination capacity and a picked trip physically carries one unit. For multi-input recipes, procurement prioritizes ingredients still missing for the next complete batch before topping up already-sufficient inputs; if no prioritized source is reachable, normal top-up remains available.''')

Path('.github/workflows/apply-bakery-balance.yml').unlink(missing_ok=True)
Path('.github/scripts/apply_bakery_balance.py').unlink(missing_ok=True)
print('bakery balance patch applied')
