import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import {
  findPath,
  findPathBySteps,
  key,
  movementCost,
  neighbors,
  same,
  walkable,
} from "../src/simulation/hex";
import {
  assigned,
  buildAt,
  building,
  changeAssignment,
  changePopulation,
  changeWoodcutters,
  outputOccupied,
  removeBuilding,
  setRoad,
  tick,
  warehouseStock,
  woodcutters,
} from "../src/simulation/simulation";
import type { Building, BuildingId, Good, Hex, World } from "../src/simulation/model";

const rounds = (w: World, n: number) => {
  for (let i = 0; i < n; i++) tick(w);
};

const CORE_POSITIONS = {
  sawmill: { q: 7, r: 4 },
  carpenter: { q: 13, r: 7 },
  warehouse: { q: 14, r: 11 },
} as const;

function placeCore(w: World) {
  const sawmill = buildAt(w, CORE_POSITIONS.sawmill, "sawmill")!;
  const carpenter = buildAt(w, CORE_POSITIONS.carpenter, "carpenter")!;
  const warehouse = buildAt(w, CORE_POSITIONS.warehouse, "warehouse")!;
  assert.ok(sawmill && carpenter && warehouse);
  return { sawmill, carpenter, warehouse };
}

function workerAt(w: World, id: BuildingId) {
  changeAssignment(w, id, "worker", 1);
  const p = assigned(w, id, "worker").at(-1)!;
  p.position = { ...building(w, id).position };
  p.path = [];
  p.movement = 0;
  p.active = true;
  return p;
}

function carrierAt(w: World, id: BuildingId) {
  changeAssignment(w, id, "carrier", 1);
  const p = assigned(w, id, "carrier").at(-1)!;
  p.position = { ...building(w, id).position };
  p.path = [];
  p.movement = 0;
  p.active = true;
  return p;
}

function woodcutterAtForest(w: World) {
  changeWoodcutters(w, 1);
  const p = woodcutters(w).at(-1)!;
  const forest = building(w, p.assignment!.building);
  p.position = { ...forest.position };
  p.path = [];
  p.movement = 0;
  p.active = true;
  return { p, forest };
}

function assertInvariants(w: World) {
  const goods: Good[] = ["wood", "plank", "woodenTool"];
  for (const b of w.buildings) {
    assert.ok(b.input >= 0 && b.input <= CONFIG.inputCapacity);
    assert.ok(b.output >= 0);
    if (b.kind !== "warehouse") {
      assert.ok(outputOccupied(w, b) <= CONFIG.outputCapacity, `${b.id}: output overflow`);
      assert.ok(
        b.input + w.people.filter((p) => p.trip?.target === b.id).length <= CONFIG.inputCapacity,
      );
      assert.ok(
        w.people.filter((p) => p.trip?.source === b.id && !p.trip.picked).length <= b.output,
      );
    } else {
      for (const good of goods) {
        const stock = warehouseStock(b, good);
        const incoming = w.people.filter(
          (p) => p.trip?.target === b.id && p.trip.good === good,
        ).length;
        const reserved = w.people.filter(
          (p) => p.trip?.source === b.id && p.trip.good === good && !p.trip.picked,
        ).length;
        assert.ok(stock >= 0 && stock <= CONFIG.warehouseCapacityPerGood);
        assert.ok(stock + incoming <= CONFIG.warehouseCapacityPerGood);
        assert.ok(reserved <= stock);
      }
    }
    if (b.forestRemaining !== undefined) {
      assert.ok(b.forestRemaining >= 0 && b.forestRemaining <= CONFIG.forestYield);
      assert.ok(assigned(w, b.id, "worker").length <= 1);
    }
  }
}

function buildableAtDistance(w: World, origin: Hex, predicate: (distance: number) => boolean): Hex {
  const candidate = w.tiles
    .filter((t) => t.terrain === "grass" || t.terrain === "road")
    .map((tile) => ({ tile, path: findPathBySteps(w.tiles, origin, tile) }))
    .filter((entry) => entry.path && predicate(entry.path.length))
    .sort((a, b) => a.path!.length - b.path!.length)[0];
  assert.ok(candidate, "expected a reachable buildable tile at requested distance");
  return { q: candidate.tile.q, r: candidate.tile.r };
}

test("six unique hex neighbors, reciprocal adjacency", () => {
  const h = { q: 0, r: 0 };
  assert.equal(new Set(neighbors(h).map(key)).size, 6);
  for (const n of neighbors(h)) assert.ok(neighbors(n).some((x) => same(x, h)));
});

test("grass is walkable while rivers and mountains remain barriers", () => {
  const tiles = [
    { q: 0, r: 0, terrain: "grass" },
    { q: 1, r: 0, terrain: "grass" },
    { q: 2, r: 0, terrain: "grass" },
    { q: 0, r: 1, terrain: "river" },
    { q: 1, r: 1, terrain: "mountain" },
  ] as World["tiles"];
  assert.equal(findPath(tiles, tiles[0]!, tiles[2]!)!.length, 2);
  assert.equal(findPath(tiles, tiles[0]!, tiles[3]!), null);
  assert.ok(walkable(tiles[0]!));
  assert.equal(walkable(tiles[3]!), false);
  assert.equal(walkable(tiles[4]!), false);
});

test("roads reduce movement cost by thirty percent speed gain", () => {
  const grass = { q: 0, r: 0, terrain: "grass" } as World["tiles"][number];
  const road = { q: 0, r: 0, terrain: "road" } as World["tiles"][number];
  assert.equal(movementCost(grass, CONFIG.roadSpeedMultiplier), 1);
  assert.ok(
    Math.abs(
      movementCost(road, CONFIG.roadSpeedMultiplier) - 1 / CONFIG.roadSpeedMultiplier,
    ) < 1e-9,
  );
});

test("world starts with only the HQ and no roads", () => {
  const w = createWorld();
  assert.deepEqual(w.buildings.map((b) => b.kind), ["hq"]);
  assert.equal(w.people.length, CONFIG.population);
  assert.equal(w.tiles.some((tile) => tile.terrain === "road"), false);
  for (const position of Object.values(CORE_POSITIONS))
    assert.equal(w.tiles.find((t) => same(t, position))?.terrain, "grass");
});

test("arrival controls activation; release and reassignment never teleport", () => {
  const w = createWorld();
  const { sawmill, carpenter } = placeCore(w);
  changeAssignment(w, sawmill.id, "worker", 1);
  const p = w.people[0]!;
  assert.equal(p.active, false);
  while (p.path.length) {
    const prev = { ...p.position };
    tick(w);
    assert.ok(
      same(prev, p.position) || neighbors(prev).some((h) => same(h, p.position)),
    );
  }
  assert.equal(p.active, true);
  changeAssignment(w, sawmill.id, "worker", -1);
  const pos = { ...p.position };
  tick(w);
  assert.ok(
    same(pos, p.position) || neighbors(pos).some((h) => same(h, p.position)),
  );
  const next = { ...p.position };
  changeAssignment(w, carpenter.id, "worker", 1);
  assert.deepEqual(p.position, next);
  assert.deepEqual(p.assignment, { building: carpenter.id, role: "worker" });
});

test("production takes one simulated second and consumes two inputs", () => {
  const w = createWorld();
  const { sawmill } = placeCore(w);
  const p = workerAt(w, sawmill.id);
  sawmill.input = 2;
  rounds(w, CONFIG.duration - 1);
  assert.equal(sawmill.output, 0);
  assert.equal(p.progress, CONFIG.duration - 1);
  tick(w);
  assert.equal(sawmill.output, 1);
  assert.equal(sawmill.input, 0);
});

test("one woodcutter occupies one forest and respects output capacity", () => {
  const w = createWorld();
  const { forest } = woodcutterAtForest(w);
  assert.equal(assigned(w, forest.id, "worker").length, 1);
  rounds(w, CONFIG.duration * 3);
  assert.equal(forest.output, 3);
  rounds(w, CONFIG.duration * 2);
  assert.equal(forest.output, 3);
  assertInvariants(w);
});

test("repeated grass traversal creates a permanent road", () => {
  const w = createWorld(1);
  const hq = building(w, "hq");
  const tile = neighbors(hq.position)
    .map((position) => w.tiles.find((candidate) => same(candidate, position)))
    .find((candidate) => candidate?.terrain === "grass")!;
  assert.ok(tile);
  const p = w.people[0]!;

  for (let i = 0; i < CONFIG.trafficThreshold; i += 1) {
    p.position = { ...hq.position };
    p.path = [{ q: tile.q, r: tile.r }];
    p.movement = 1;
    tick(w);
  }

  assert.equal(tile.terrain, "road");
});

test("one physical unit cannot be claimed twice; carried cancellation returns it", () => {
  const w = createWorld();
  const { sawmill } = placeCore(w);
  const { forest } = woodcutterAtForest(w);
  forest.output = 1;
  changeWoodcutters(w, -1);
  const a = carrierAt(w, sawmill.id);
  const b = carrierAt(w, sawmill.id);
  tick(w);
  assert.equal([a, b].filter((p) => p.trip).length, 1);
  const p = [a, b].find((person) => person.trip)!;
  while (!p.trip?.picked) tick(w);
  assert.equal(forest.output, 0);
  changeAssignment(w, sawmill.id, "carrier", -1);
  changeAssignment(w, sawmill.id, "carrier", -1);
  assert.equal(forest.output, 1);
  assert.equal(p.trip, undefined);
  assertInvariants(w);
});

test("population removal only removes truly free people at HQ; IDs stay unique", () => {
  const w = createWorld(1);
  const hq = building(w, "hq");
  changeWoodcutters(w, 1);
  assert.equal(changePopulation(w, -1), false);
  while (same(w.people[0]!.position, hq.position)) tick(w);
  changeWoodcutters(w, -1);
  assert.equal(changePopulation(w, -1), false);
  while (w.people[0]!.path.length) tick(w);
  assert.equal(changePopulation(w, -1), true);
  changePopulation(w, 1);
  assert.equal(w.people[0]!.id, 2);
});

test("production can fetch needed goods from a warehouse beyond the collection radius", () => {
  const w = createWorld();
  const { sawmill, warehouse } = placeCore(w);
  const path = findPathBySteps(w.tiles, sawmill.position, warehouse.position)!;
  assert.ok(path.length > CONFIG.warehouseCollectionRadius);
  warehouse.inventory!.wood = 2;
  const carrier = carrierAt(w, sawmill.id);
  tick(w);
  assert.equal(carrier.trip?.source, warehouse.id);
  assert.equal(carrier.trip?.good, "wood");
});

test("warehouse carriers never move goods from one warehouse to another", () => {
  const w = createWorld();
  const source = buildAt(w, CORE_POSITIONS.warehouse, "warehouse")!;
  source.inventory!.wood = 5;
  const targetPosition = buildableAtDistance(w, source.position, (distance) => distance >= 1 && distance <= 5);
  const target = buildAt(w, targetPosition, "warehouse")!;
  const carrier = carrierAt(w, target.id);
  tick(w);
  assert.equal(carrier.trip, undefined);
  assert.equal(source.inventory!.wood, 5);
  assert.equal(target.inventory!.wood, 0);
});

test("warehouse collection is limited to five reachable steps", () => {
  const nearWorld = createWorld();
  const nearWarehouse = buildAt(nearWorld, CORE_POSITIONS.warehouse, "warehouse")!;
  const nearPosition = buildableAtDistance(
    nearWorld,
    nearWarehouse.position,
    (distance) => distance >= 1 && distance <= CONFIG.warehouseCollectionRadius,
  );
  const nearSource = buildAt(nearWorld, nearPosition, "sawmill")!;
  nearSource.output = 1;
  const nearCarrier = carrierAt(nearWorld, nearWarehouse.id);
  tick(nearWorld);
  assert.equal(nearCarrier.trip?.source, nearSource.id);

  const farWorld = createWorld();
  const farWarehouse = buildAt(farWorld, CORE_POSITIONS.warehouse, "warehouse")!;
  const farPosition = buildableAtDistance(
    farWorld,
    farWarehouse.position,
    (distance) => distance > CONFIG.warehouseCollectionRadius,
  );
  const farSource = buildAt(farWorld, farPosition, "sawmill")!;
  farSource.output = 1;
  const farDistance = findPathBySteps(farWorld.tiles, farWarehouse.position, farSource.position)!.length;
  assert.ok(farDistance > CONFIG.warehouseCollectionRadius);
  const farCarrier = carrierAt(farWorld, farWarehouse.id);
  tick(farWorld);
  assert.equal(farCarrier.trip, undefined);
  assert.equal(farSource.output, 1);
});

test("buildings and roads can still be placed and removed manually", () => {
  const w = createWorld();
  const grass = w.tiles.find((t) => t.terrain === "grass")!;
  const position = { q: grass.q, r: grass.r };
  const warehouse = buildAt(w, position, "warehouse");
  assert.ok(warehouse);
  assert.equal(grass.terrain, "building");
  assert.equal(removeBuilding(w, warehouse!.id), true);
  assert.equal(grass.terrain, "grass");
  assert.equal(setRoad(w, position, true), true);
  assert.equal(grass.terrain, "road");
  assert.equal(setRoad(w, position, false), true);
  assert.equal(grass.terrain, "grass");
});

test("deterministic replay and frequent reassignments preserve limits", () => {
  const a = createWorld();
  const b = createWorld();
  const coreA = placeCore(a);
  const coreB = placeCore(b);
  const idsA = [coreA.sawmill.id, coreA.carpenter.id, coreA.warehouse.id];
  const idsB = [coreB.sawmill.id, coreB.carpenter.id, coreB.warehouse.id];
  for (let i = 0; i < 300; i++) {
    for (const [w, ids] of [[a, idsA], [b, idsB]] as const) {
      if (i % 5 === 0) changeWoodcutters(w, i % 20 === 0 ? -1 : 1);
      if (i % 3 === 0)
        changeAssignment(
          w,
          ids[Math.floor(i / 3) % ids.length]!,
          i % 2 ? "worker" : "carrier",
          i % 7 === 0 ? -1 : 1,
        );
      if (i % 17 === 0) changePopulation(w, 1);
      if (i % 23 === 0) changePopulation(w, -1);
      tick(w);
      assertInvariants(w);
    }
  }
  assert.deepEqual(a, b);
});
