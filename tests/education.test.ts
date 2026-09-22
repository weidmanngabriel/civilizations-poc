import { test } from "node:test";
import assert from "node:assert/strict";
import type { Building, World } from "../src/simulation/model";
import {
  EDUCATION_DURATION_TICKS,
  advanceEducation,
  educationTeacherCandidates,
  startEducation,
} from "../src/simulation/education";
import { tick } from "../src/simulation/simulation";
import { personInsideBuilding } from "../src/game/personVisibility";
import { createTestWorld } from "./testWorld";

const addCompletedSchool = (world: World): Building => {
  const school: Building = {
    id: "school-test",
    kind: "school",
    name: "Schule",
    position: { q: 0, r: 0 },
    workers: 0,
    carriers: 0,
    input: 0,
    output: 0,
    construction: {
      required: {},
      delivered: {},
      duration: 1,
      progress: 1,
      complete: true,
    },
  };
  world.buildings.push(school);
  return school;
};

const addCarpenter = (world: World): Building => {
  const carpenter: Building = {
    id: "carpenter-test",
    kind: "carpenter",
    name: "Schreinerei",
    position: { q: 0, r: 0 },
    workers: 1,
    carriers: 0,
    input: 0,
    output: 0,
    construction: {
      required: {},
      delivered: {},
      duration: 1,
      progress: 1,
      complete: true,
    },
  };
  world.buildings.push(carpenter);
  return carpenter;
};

test("teacher and student complete a 60-second lesson and teacher returns to workplace", () => {
  const world = createTestWorld({ population: 2 });
  const school = addCompletedSchool(world);
  const carpenter = addCarpenter(world);
  const student = world.people[0]!;
  const teacher = world.people[1]!;

  teacher.experience = { sawmillWorker: 10 };
  teacher.assignment = { building: carpenter.id, role: "worker" };
  teacher.active = true;

  assert.equal(startEducation(world, student.id, school.id, "carpenter", teacher.id), true);
  assert.equal(personInsideBuilding(world, student), true);
  assert.equal(personInsideBuilding(world, teacher), true);
  assert.equal(student.assignment, undefined);
  assert.equal(teacher.assignment, undefined);

  for (let i = 0; i < EDUCATION_DURATION_TICKS - 1; i++) tick(world);
  assert.equal(student.educationTask?.role, "student");
  assert.equal(teacher.educationTask?.role, "teacher");

  tick(world);

  assert.equal(student.educationTask, undefined);
  assert.equal(teacher.educationTask, undefined);
  assert.equal(student.profession, "carpenter");
  assert.deepEqual(teacher.assignment, { building: carpenter.id, role: "worker" });
});

test("lesson progress pauses while either participant is handling a need", () => {
  const world = createTestWorld({ population: 2 });
  const school = addCompletedSchool(world);
  const student = world.people[0]!;
  const teacher = world.people[1]!;
  teacher.experience = { sawmillWorker: 10 };

  assert.equal(startEducation(world, student.id, school.id, "carpenter", teacher.id), true);
  advanceEducation(world);
  assert.equal(student.educationTask?.progressTicks, 1);

  student.hungerState = { resumeActive: false };
  for (let i = 0; i < 120; i++) advanceEducation(world);
  assert.equal(student.educationTask?.progressTicks, 1);
  assert.equal(student.educationTask?.active, false);
  assert.equal(teacher.educationTask?.active, false);

  student.hungerState = undefined;
  advanceEducation(world);
  assert.equal(student.educationTask?.progressTicks, 2);
});

test("a teacher already teaching cannot be selected for another lesson", () => {
  const world = createTestWorld({ population: 3 });
  const school = addCompletedSchool(world);
  const firstStudent = world.people[0]!;
  const secondStudent = world.people[1]!;
  const teacher = world.people[2]!;
  teacher.experience = { sawmillWorker: 10 };

  assert.equal(startEducation(world, firstStudent.id, school.id, "carpenter", teacher.id), true);
  assert.equal(
    educationTeacherCandidates(world, secondStudent.id, "carpenter").some(
      (candidate) => candidate.id === teacher.id,
    ),
    false,
  );
  assert.equal(startEducation(world, secondStudent.id, school.id, "carpenter", teacher.id), false);
});
