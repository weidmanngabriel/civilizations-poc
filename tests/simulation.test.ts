import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, CONFIG } from "../src/simulation/scenario";
import {
  findPath,
  key,
  neighbors,
  same,
  walkable,
} from "../src/simulation/hex";
import {
  assigned,
  building,
  changeAssignment,
  changePopulation,
  changeWoodcutters,
  outputOccupied,
  tick,
  woodcutters,
} from "../src/simulation/simulation";
import type { BuildingId, World } from "../src/simulation/model";

const rounds = (w: World, n: number) => {
  for (let i = 0; i < n; i++) tick(w);
};

function workerAt(w: World, id: BuildingId) {
  changeAssignment(w, id, "worker", 1);
  const p = assigned(w, id, "worker").at(-1)!;
  p.position = { ...building(w, id).position };
  p.path = [];
  p.active = true;
  return p;
}

function woodcutterAtForest(w: World) {
  changeWoodcutters(w, 1);
  const p = woodcutters(w).at(-1)!;
  const forest = building(w, p.assignment!.building);
  p.position = { ...forest.position };
  p.path = [];
  p.active = true;
  return { p, forest };
}

function assertInvariants(w: World) {
  for (const b of w.buildings) {
    assert.ok(b.input >= 0 && b.input <= CONFIG.inputCapacity);
    assert.ok(b.output >= 0);
    if (b.id !== "warehouse")
      assert.ok(
        outputOccupied(w, b) <= CONFIG.outputCapacity,
        `${b.id}: output overflow`,
      );
    assert.ok(
      b.id === "warehouse" ||
        b.input + w.people.filter((p) => p.trip?.target === b.id).length <=
          CONFIG.inputCapacity,
    );
    assert.ok(
      w.people.filter((p) => p.trip?.source === b.id && !p.trip.picked)
        .length <= b.output,
    );
    if (b.forestRemaining !== undefined) {
      assert.ok(b.forestRemaining >= 0 && b.forestRemaining <= CONFIG.forestYield);
      assert.ok(assigned(w, b.id, "worker").length <= 1);
    }
  }
}

test("six unique hex neighbors, reciprocal adjacency", () => {
  const h = { q: 0, r: 0 };
  assert.equal(new Set(neighbors(h).map(key)).size, 6);
  for (const n of neighbors(h)) assert.ok(neighbors(n).some((x) => same(x, h)));
});

test("BFS shortest path, barriers, disconnected nodes, every initial building reachable", () => {
  const w = createWorld();
  const hq = building(w, "hq");
  for (const b of w.buildings) {
    const path = findPath(w.tiles, hq.position, b.position);
    assert.ok(path);
    let current = hq.position;
    for (const step of path) {
      assert.ok(neighbors(current).some((x) => same(x, step)));
      assert.ok(w.tiles.some((t) => same(t, step) && walkable(t)));
      current = step;
    }
  }
  const tiles = [
    { q: 0, r: 0, terrain: "road" },
    { q: 1, r: 0, terrain: "road" },
    { q: 2, r: 0, terrain: "road" },
    { q: 0, r: 1, terrain: "grass" },
  ] as World["tiles"];
  assert.equal(findPath(tiles, tiles[0]!, tiles[2]!)!.length, 2);
  assert.equal(findPath(tiles, tiles[0]!, tiles[3]!), null);
  assert.equal(
    findPath(
      tiles.filter((t) => t.q !== 1),
      tiles[0]!,
      tiles[2]!,
    ),
    null,
  );
});

test("arrival controls activation; one edge per round; release and reassignment never teleport", () => {
  const w = createWorld();
  changeAssignment(w, "sawmill", "worker", 1);
  const p = w.people[0]!;
  assert.equal(p.active, false);
  while (p.path.length) {
    const prev = { ...p.position };
    tick(w);
    assert.ok(neighbors(prev).some((h) => same(h, p.position)));
  }
  assert.equal(p.active, true);
  changeAssignment(w, "sawmill", "worker", -1);
  assert.equal(p.assignment, undefined);
  const pos = { ...p.position };
  tick(w);
  assert.ok(neighbors(pos).some((h) => same(h, p.position)));
  const next = { ...p.position };
  changeAssignment(w, "carpenter", "worker", 1);
  assert.deepEqual(p.position, next);
  assert.deepEqual(p.assignment, { building: "carpenter", role: "worker" });
});

test("exactly five working rounds, 2 input consumed, one output, cancellation preserves inputs", () => {
  const w = createWorld();
  const b = building(w, "sawmill");
  const p = workerAt(w, "sawmill");
  b.input = 2;
  rounds(w, 4);
  assert.equal(b.output, 0);
  assert.equal(p.progress, 4);
  tick(w);
  assert.equal(b.output, 1);
  assert.equal(b.input, 0);
  b.input = 2;
  rounds(w, 2);
  changeAssignment(w, "sawmill", "worker", -1);
  assert.equal(b.input, 2);
  assert.equal(b.output, 1);
  assert.equal(p.progress, 0);
});

test("no production without worker, two inputs or output space", () => {
  const w = createWorld();
  const b = building(w, "sawmill");
  b.input = 2;
  rounds(w, 8);
  assert.equal(b.output, 0);
  workerAt(w, "sawmill");
  b.input = 1;
  rounds(w, 8);
  assert.equal(b.output, 0);
  b.input = 2;
  b.output = 3;
  rounds(w, 8);
  assert.equal(b.input, 2);
  assert.equal(b.output, 3);
});

test("one woodcutter occupies one forest and respects output capacity", () => {
  const w = createWorld();
  const { forest } = woodcutterAtForest(w);
  assert.equal(assigned(w, forest.id, "worker").length, 1);
  rounds(w, 15);
  assert.equal(forest.output, 3);
  rounds(w, 10);
  assert.equal(forest.output, 3);
  assertInvariants(w);
});

test("one physical unit cannot be claimed twice; carried cancellation returns the unit", () => {
  const w = createWorld();
  const { forest } = woodcutterAtForest(w);
  forest.output = 1;
  for (let i = 0; i < 2; i++) {
    changeAssignment(w, "sawmill", "carrier", 1);
    const p = assigned(w, "sawmill", "carrier").at(-1)!;
    p.position = { ...building(w, "sawmill").position };
    p.path = [];
    p.active = true;
  }
  tick(w);
  assert.equal(w.people.filter((p) => p.trip).length, 1);
  const p = w.people.find((person) => person.trip)!;
  while (!p.trip?.picked) tick(w);
  assert.equal(forest.output, 0);
  assert.equal(w.people.filter((person) => person.trip?.picked).length, 1);
  changeAssignment(w, "sawmill", "carrier", -1);
  changeAssignment(w, "sawmill", "carrier", -1);
  assert.equal(forest.output, 1);
  assert.equal(p.trip, undefined);
  assertInvariants(w);
});

test("population removal only removes truly free people at HQ; IDs stay unique", () => {
  const w = createWorld(1);
  changeWoodcutters(w, 1);
  assert.equal(changePopulation(w, -1), false);
  changeWoodcutters(w, -1);
  assert.equal(changePopulation(w, -1), false);
  while (w.people[0]!.path.length) tick(w);
  assert.equal(changePopulation(w, -1), true);
  assert.equal(w.people.length, 0);
  changePopulation(w, 1);
  assert.equal(w.people[0]!.id, 2);
});

test("whole economy repeatedly reaches unbounded warehouse, with conserved goods and legal movement", () => {
  const w = createWorld();
  changeWoodcutters(w, 1);
  changeWoodcutters(w, 1);
  for (const id of ["sawmill", "carpenter"] as const) {
    changeAssignment(w, id, "worker", 1);
    changeAssignment(w, id, "carrier", 1);
  }
  changeAssignment(w, "warehouse", "carrier", 1);
  changeAssignment(w, "warehouse", "carrier", 1);
  const timber = (world: World) =>
    world.buildings.reduce(
      (sum, b) =>
        sum +
        b.input * (b.id === "carpenter" ? 2 : 1) +
        b.output *
          (b.recipe?.output === "wood"
            ? 1
            : b.recipe?.output === "plank"
              ? 2
              : 4),
      0,
    ) +
    world.people.reduce(
      (sum, p) =>
        sum +
        (p.trip?.picked
          ? { wood: 1, plank: 2, woodenTool: 4 }[p.trip.good]
          : 0),
      0,
    );
  let priorWarehouse = 0;
  for (let i = 0; i < 1500; i++) {
    const before = w.people.map((p) => ({ ...p.position }));
    const goodsBefore = timber(w);
    const producedWood = w.people.filter((p) => {
      if (p.progress !== 4 || !p.assignment) return false;
      return building(w, p.assignment.building).forestRemaining !== undefined;
    }).length;
    tick(w);
    assert.equal(timber(w), goodsBefore + producedWood);
    w.people.forEach((p, j) =>
      assert.ok(
        same(before[j]!, p.position) ||
          neighbors(before[j]!).some((h) => same(h, p.position)),
      ),
    );
    assertInvariants(w);
    assert.ok(building(w, "warehouse").output >= priorWarehouse);
    priorWarehouse = building(w, "warehouse").output;
  }
  assert.ok(priorWarehouse > 10, `tools: ${priorWarehouse}`);
});

test("deterministic replay and frequent reassignments preserve limits", () => {
  const a = createWorld(),
    b = createWorld();
  const ids = ["sawmill", "carpenter", "warehouse"] as const;
  for (let i = 0; i < 600; i++) {
    for (const w of [a, b]) {
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
