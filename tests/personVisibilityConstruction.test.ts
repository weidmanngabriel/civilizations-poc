import { test } from "node:test";
import assert from "node:assert/strict";
import type { Building } from "../src/simulation/model";
import { createWorld } from "../src/simulation/scenario";
import { personInsideBuilding } from "../src/game/personVisibility";

test("builders stay visible while transferring goods at an unfinished construction site", () => {
  const world = createWorld(1);
  const person = world.people[0]!;
  const site: Building = {
    id: "site",
    kind: "sawmill",
    name: "Baustelle",
    position: { ...person.position },
    workers: 1,
    carriers: 1,
    input: 0,
    output: 0,
    construction: {
      required: { wood: 1 },
      delivered: {},
      duration: 60,
      progress: 0,
      complete: false,
    },
  };
  world.buildings.push(site);

  person.builder = true;
  person.path = [];
  person.trip = {
    source: "hq",
    target: site.id,
    good: "wood",
    picked: true,
    transferUntilTick: world.round + 60,
  };

  assert.equal(personInsideBuilding(world, person), false);

  site.construction!.complete = true;
  assert.equal(personInsideBuilding(world, person), true);
});
