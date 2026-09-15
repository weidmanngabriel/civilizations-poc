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
    "function retireDepletedResources(\n  w: World,\n  resources: readonly NaturalResource[] = w.naturalResources.filter(\n    (candidate) => !candidate.depleted && candidate.remaining === 0,\n  ),\n): void {",
    "function retireDepletedResources(\n  w: World,\n  resources: readonly NaturalResource[],\n): void {",
)
replace_once(
    core,
    "  if (newlyDepletedResources.length || regularDecisionTick)\n    measureFeature(\"planningResourceCleanup\", () =>\n      retireDepletedResources(\n        w,\n        newlyDepletedResources.length ? newlyDepletedResources : undefined,\n      ),\n    );",
    "  if (newlyDepletedResources.length)\n    measureFeature(\"planningResourceCleanup\", () =>\n      retireDepletedResources(w, newlyDepletedResources),\n    );",
)

architecture = "architecture.md"
replace_once(
    architecture,
    "Natural-resource depletion cleanup is also event-driven: an extraction that reaches zero retires that concrete resource immediately. A full resource-list scan remains only as a one-second fallback for externally changed or inconsistent state instead of running at 60 Hz. Performance diagnostics split work planning into resource cleanup, waiting profession pools and per-person decisions so the former residual `planning` bucket no longer hides distinct costs.",
    "Natural-resource depletion cleanup is fully event-driven: an extraction that reaches zero retires that concrete resource immediately. There is no periodic full resource-list consistency scan; resource mutations must trigger their lifecycle handling directly. Performance diagnostics split work planning into resource cleanup, waiting profession pools and per-person decisions so the former residual `planning` bucket no longer hides distinct costs.",
)

plan = "FINE_GRID_RESOURCE_REWORK_PLAN.md"
replace_once(
    plan,
    "- the full depleted-resource scan is retained only as a one-second consistency fallback,\n",
    "- the periodic depleted-resource consistency scan has been removed; depletion lifecycle handling is fully event-driven,\n",
)
