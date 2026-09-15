from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}")
    file.write_text(text.replace(old, new, 1))


core = "src/simulation/simulationCoreEngine.ts"
replace_once(
    core,
    "function advanceNaturalResourceExtraction(w: World, immediateDecisionPeople: Set<number>): void {\n",
    "function advanceNaturalResourceExtraction(\n  w: World,\n  immediateDecisionPeople: Set<number>,\n): NaturalResource[] {\n  const depletedResources: NaturalResource[] = [];\n",
)
replace_once(
    core,
    "      resource.output += 1;\n      resource.remaining--;\n      p.progress = 0;\n      immediateDecisionPeople.add(p.id);\n    }\n  }\n}\n\nfunction advanceConstruction",
    "      resource.output += 1;\n      resource.remaining--;\n      if (resource.remaining === 0) depletedResources.push(resource);\n      p.progress = 0;\n      immediateDecisionPeople.add(p.id);\n    }\n  }\n  return depletedResources;\n}\n\nfunction advanceConstruction",
)
replace_once(
    core,
    "function retireDepletedResources(w: World): void {\n  for (const resource of w.naturalResources.filter(\n    (candidate) => !candidate.depleted && candidate.remaining === 0,\n  )) {",
    "function retireDepletedResources(\n  w: World,\n  resources: readonly NaturalResource[] = w.naturalResources.filter(\n    (candidate) => !candidate.depleted && candidate.remaining === 0,\n  ),\n): void {\n  for (const resource of resources) {\n    if (resource.depleted || resource.remaining !== 0) continue;",
)
replace_once(
    core,
    "  measureFeature(\"production\", () => {\n    advanceNaturalResourceExtraction(w, immediateDecisionPeople);",
    "  let newlyDepletedResources: NaturalResource[] = [];\n  measureFeature(\"production\", () => {\n    newlyDepletedResources = advanceNaturalResourceExtraction(w, immediateDecisionPeople);",
)
replace_once(
    core,
    "  measureFeature(\"planning\", () => {\n    retireDepletedResources(w);\n    if (regularDecisionTick) {\n      assignWaitingWoodcutters(w, w.round === 1);\n      assignWaitingExtractors(w);\n      assignWaitingBuilders(w);\n    }\n  });",
    "  if (newlyDepletedResources.length || regularDecisionTick)\n    measureFeature(\"planningResourceCleanup\", () =>\n      retireDepletedResources(\n        w,\n        newlyDepletedResources.length ? newlyDepletedResources : undefined,\n      ),\n    );\n  if (regularDecisionTick)\n    measureFeature(\"planningIdlePools\", () => {\n      assignWaitingWoodcutters(w, w.round === 1);\n      assignWaitingExtractors(w);\n      assignWaitingBuilders(w);\n    });",
)
replace_once(
    core,
    "  performanceProfiler.recordFeature(\n    \"planning\",\n    Math.max(0, decisionTotalMs - decisionTransportMs - decisionFarmMs),\n  );",
    "  performanceProfiler.recordFeature(\n    \"planningDecisions\",\n    Math.max(0, decisionTotalMs - decisionTransportMs - decisionFarmMs),\n  );",
)

profiler = "src/debug/performanceProfiler.ts"
replace_once(
    profiler,
    '  | "planning"\n',
    '  | "planningResourceCleanup"\n  | "planningIdlePools"\n  | "planningDecisions"\n',
)
replace_once(
    profiler,
    '  "planning",\n  "renderWorld",',
    '  "planningResourceCleanup",\n  "planningIdlePools",\n  "planningDecisions",\n  "renderWorld",',
)
replace_once(
    profiler,
    '  "planning",\n]);',
    '  "planningResourceCleanup",\n  "planningIdlePools",\n  "planningDecisions",\n]);',
)

ui = "src/ui/performanceDebug.ts"
replace_once(
    ui,
    '  planning: "Arbeitsplanung",\n',
    '  planningResourceCleanup: "Planung · Ressourcen-Cleanup",\n  planningIdlePools: "Planung · wartende Berufe",\n  planningDecisions: "Planung · Personenentscheidungen",\n',
)

architecture = "architecture.md"
replace_once(
    architecture,
    "If a work planner cannot find a valid task or source, only that waiting person receives a retry deadline. The one-second cadence is a fallback for waiting persons rather than a global re-plan. Movement, need decay and active production still advance at 60 Hz.\n",
    "If a work planner cannot find a valid task or source, only that waiting person receives a retry deadline. The one-second cadence is a fallback for waiting persons rather than a global re-plan. Movement, need decay and active production still advance at 60 Hz.\n\nNatural-resource depletion cleanup is also event-driven: an extraction that reaches zero retires that concrete resource immediately. A full resource-list scan remains only as a one-second fallback for externally changed or inconsistent state instead of running at 60 Hz. Performance diagnostics split work planning into resource cleanup, waiting profession pools and per-person decisions so the former residual `planning` bucket no longer hides distinct costs.\n",
)

plan = "FINE_GRID_RESOURCE_REWORK_PLAN.md"
replace_once(
    plan,
    "- regression coverage locks these logistics semantics across warehouse, HQ, merchant and builder flows.\n",
    "- regression coverage locks these logistics semantics across warehouse, HQ, merchant and builder flows,\n- natural-resource depletion retirement is event-driven on actual extraction instead of scanning every resource on every 60-Hz simulation tick,\n- the full depleted-resource scan is retained only as a one-second consistency fallback,\n- performance diagnostics split work planning into resource cleanup, waiting profession pools and per-person decisions instead of one residual `planning` bucket.\n",
)
