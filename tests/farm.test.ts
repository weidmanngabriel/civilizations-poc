import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import { findPathBySteps } from "../src/simulation/hex";
import { canPlaceBuilding } from "../src/simulation/buildingPlacement";
import { placeLooseGood } from "../src/simulation/looseGoods";
import { assigned, buildAt, changeAssignment, tick, warehouseStock } from "../src/simulation/simulation";
import { activeFarmFieldCount, planFarmWorker } from "../src/simulation/farm";
import type { Building, BuildableBuildingKind, Hex, World } from "../src/simulation/model";
import { performanceProfiler } from "../src/debug/performanceProfiler";

const rounds = (w: World, count: number) => {
  for (let i = 0; i < count; i++) tick(w);
};

const distance = (a: { q: number; r: number }, b: { q: number; r: number }) => {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
};

const validBuildPosition = (
  w: World,
  kind: BuildableBuildingKind,
  origin?: Hex,
  predicate: (pathLength: number) => boolean = () => true,
): Hex => {
  for (const tile of w.tiles) {
    if (!canPlaceBuilding(w, tile, kind)) continue;
    if (!origin) return { q: tile.q, r: tile.r };
    const path = findPathBySteps(w.tiles, origin, tile);
    if (path && predicate(path.length)) return { q: tile.q, r: tile.r };
  }
  assert.fail(`expected valid ${kind} position`);
};

const nearbyGrass = (w: World, origin: Hex): Hex => {
  const tile = w.tiles.find(
    (candidate) =>
      candidate.terrain === "grass" &&
      distance(candidate, origin) <= CONFIG.farmFieldRadius,
  );
  assert.ok(tile);
  return { q: tile.q, r: tile.r };
};

const finishedFarm = (w: World) => {
  const farm = buildAt(w, validBuildPosition(w, "farm"), "farm")!;
  assert.ok(farm);
  changeAssignment(w, farm.id, "worker", 1);
  const farmer = assigned(w, farm.id, "worker")[0]!;
  farmer.position = { ...farm.position };
  farmer.path = [];
  farmer.movement = 0;
  farmer.active = true;
  return { farm, farmer };
};

const addField = (
  w: World,
  farm: Building,
  position: { q: number; r: number },
  stage: 1 | 2 | 3 | 4,
  progress = 0,
) => {
  const tile = w.tiles.find((candidate) => candidate.q === position.q && candidate.r === position.r)!;
  assert.equal(tile.terrain, "grass");
  tile.terrain = "field";
  const field: Building = {
    id: `field-test-${w.nextFieldId++}`,
    kind: "field",
    name: "Testacker",
    position: { ...position },
    workers: 0,
    carriers: 0,
    input: 0,
    output: 0,
    farmId: farm.id,
    fieldStage: stage,
    fieldGrowthProgress: progress,
    recipe: { amount: 0, output: "wheat", duration: CONFIG.fieldStageDurationTicks },
  };
  w.buildings.push(field);
  return field;
};

test("farmer sows up to four random fields around the farm", () => {
  const w = createWorld();
  const { farm } = finishedFarm(w);

  for (let i = 0; i < 6000 && activeFarmFieldCount(w, farm.id) < CONFIG.farmMaxFields; i++)
    tick(w);

  const fields = w.buildings.filter(
    (b) => b.kind === "field" && b.farmId === farm.id && !b.retired,
  );
  assert.equal(fields.length, 4);
  for (const field of fields) {
    assert.ok(distance(field.position, farm.position) <= CONFIG.farmFieldRadius);
    assert.equal(
      w.tiles.find((tile) => tile.q === field.position.q && tile.r === field.position.r)?.terrain,
      "field",
    );
  }
});

test("sow planning stops pathfinding after finding a reachable random field", () => {
  const w = createWorld();
  const { farm, farmer } = finishedFarm(w);
  const before = performanceProfiler.snapshot().path.count;

  const planned = performanceProfiler.withPathReason("farm", () =>
    planFarmWorker(w, farmer, farm),
  );

  const pathCalls = performanceProfiler.snapshot().path.count - before;
  assert.equal(planned, true);
  assert.equal(farmer.farmTask?.kind, "sow");
  assert.ok(
    pathCalls <= 20,
    `expected lazy farm candidate pathfinding, got ${pathCalls} path searches`,
  );
});

test("a pending sow task is cancelled instead of overwriting a loose good", () => {
  const w = createWorld();
  const { farm, farmer } = finishedFarm(w);
  const target = nearbyGrass(w, farm.position);
  assert.ok(placeLooseGood(w, target, "wood", 1));

  farmer.position = { ...target };
  farmer.path = [];
  farmer.movement = 0;
  farmer.farmTask = {
    kind: "sow",
    target: { ...target },
    progress: CONFIG.farmActionDurationTicks - 1,
  };
  farmer.progress = farmer.farmTask.progress;

  tick(w);

  assert.notDeepEqual(farmer.farmTask?.target, target);
  assert.equal(
    w.buildings.some((building) => building.kind === "field" && building.farmId === farm.id &&
      building.position.q === target.q && building.position.r === target.r),
    false,
  );
  assert.equal(w.looseGoods?.some((stack) => stack.position.q === target.q && stack.position.r === target.r), true);
});

test("fertilizing reduces the remaining time to the next stage to one third", () => {
  const w = createWorld();
  const { farm, farmer } = finishedFarm(w);
  const field = addField(
    w,
    farm,
    nearbyGrass(w, farm.position),
    1,
    CONFIG.fieldStageDurationTicks / 2,
  );
  farmer.position = { ...field.position };
  farmer.path = [];
  farmer.farmTask = {
    kind: "fertilize",
    target: { ...field.position },
    fieldId: field.id,
    progress: 0,
  };

  rounds(w, CONFIG.fieldStageDurationTicks / 6 - 1);
  assert.equal(field.fieldStage, 1);
  tick(w);
  assert.equal(field.fieldStage, 2);
  assert.notEqual(farmer.farmTask?.kind, "fertilize");
});

test("harvest takes ten seconds and farmer carries one physical wheat back to the farm", () => {
  const w = createWorld();
  const { farm, farmer } = finishedFarm(w);
  const field = addField(w, farm, nearbyGrass(w, farm.position), 4);
  farmer.position = { ...field.position };
  farmer.path = [];
  farmer.farmTask = {
    kind: "harvest",
    target: { ...field.position },
    fieldId: field.id,
    progress: 0,
  };

  rounds(w, CONFIG.farmActionDurationTicks - 1);
  assert.equal(field.retired, undefined);
  tick(w);

  assert.equal(field.retired, true);
  assert.equal(field.output, 0);
  assert.equal(farmer.trip?.source, field.id);
  assert.equal(farmer.trip?.target, farm.id);
  assert.equal(farmer.trip?.good, "wheat");
  assert.equal(farmer.trip?.picked, true);
  assert.equal(
    w.tiles.find((tile) => tile.q === field.position.q && tile.r === field.position.r)?.terrain,
    "grass",
  );
  for (let i = 0; i < 1000 && farm.output === 0; i++) tick(w);
  assert.equal(farm.output, 1);
  assert.equal(farmer.trip, undefined);
});

test("warehouse carriers collect one whole wheat from fractional farm output", () => {
  const w = createWorld();
  const farm = buildAt(w, validBuildPosition(w, "farm"), "farm")!;
  const warehouse = buildAt(
    w,
    validBuildPosition(
      w,
      "warehouse",
      farm.position,
      (length) => length <= CONFIG.warehouseCollectionRadius,
    ),
    "warehouse",
  )!;
  assert.ok(farm && warehouse);
  farm.output = 1.7;
  changeAssignment(w, warehouse.id, "carrier", 1);
  const carrier = assigned(w, warehouse.id, "carrier")[0]!;
  carrier.position = { ...warehouse.position };
  carrier.path = [];
  carrier.movement = 0;
  carrier.active = true;
  for (let i = 0; i < 1000 && warehouseStock(warehouse, "wheat") === 0; i++) tick(w);
  assert.equal(warehouseStock(warehouse, "wheat"), 1);
  assert.ok(Math.abs(farm.output - 0.7) < 1e-9);
});

test("farmer waits to harvest while farm output is full", () => {
  const w = createWorld();
  const { farm, farmer } = finishedFarm(w);
  addField(w, farm, nearbyGrass(w, farm.position), 4);
  farm.output = CONFIG.outputCapacity;
  tick(w);
  assert.equal(farmer.farmTask, undefined);
  assert.equal(farmer.trip, undefined);
});


test("full farm output does not pull an idle farmer back into the farm", () => {
  const w = createWorld();
  const { farm, farmer } = finishedFarm(w);
  addField(w, farm, nearbyGrass(w, farm.position), 4);
  farm.output = CONFIG.outputCapacity;

  const waitingPosition = nearbyGrass(w, farm.position);
  farmer.position = { ...waitingPosition };
  farmer.path = [];
  farmer.movement = 0;
  farmer.active = true;

  assert.equal(planFarmWorker(w, farmer, farm), false);
  assert.deepEqual(farmer.position, waitingPosition);
  assert.equal(farmer.path.length, 0);
  assert.equal(farmer.farmTask, undefined);
  assert.equal(farmer.trip, undefined);
});

test("farmers use the farm as a local navigation node without global wayposts", () => {
  const w = createWorld();
  const { farm, farmer } = finishedFarm(w);
  w.wayposts = [];
  w.waypostRevision = 0;

  tick(w);

  assert.ok(farmer.farmTask, "farmer should plan local field work inside the farm area");
  assert.equal(farmer.navigationBlocked, undefined);
  assert.ok(distance(farmer.farmTask!.target, farm.position) <= CONFIG.farmFieldRadius + 8);
});

test("farmers outside the farm work area still require the global waypost network", () => {
  const w = createWorld();
  const { farm, farmer } = finishedFarm(w);
  const farTile = w.tiles
    .filter((tile) => tile.terrain === "grass")
    .find((tile) => distance(tile, farm.position) > CONFIG.farmFieldRadius + 10);
  assert.ok(farTile);

  farmer.position = { q: farTile.q, r: farTile.r };
  farmer.path = [];
  farmer.active = true;
  farmer.farmTask = undefined;
  w.wayposts = [];
  w.waypostRevision = 0;

  tick(w);

  assert.equal(farmer.farmTask, undefined);
  assert.equal(farmer.path.length, 0);
  assert.equal(farmer.navigationBlocked, true);
});


test("farmers return to the farm before starting another local task", () => {
  const w = createWorld();
  const { farm, farmer } = finishedFarm(w);
  const field = addField(
    w,
    farm,
    nearbyGrass(w, farm.position),
    1,
    CONFIG.fieldStageDurationTicks - 3,
  );
  farmer.position = { ...field.position };
  farmer.path = [];
  farmer.farmTask = {
    kind: "fertilize",
    target: { ...field.position },
    fieldId: field.id,
    progress: 0,
  };

  tick(w);
  assert.equal(field.fieldStage, 2);
  assert.equal(farmer.farmTask, undefined);

  tick(w);
  assert.ok(farmer.path.length > 0, "completed field work should route back to the farm");
  assert.deepEqual(farmer.path.at(-1), farm.position);
});
