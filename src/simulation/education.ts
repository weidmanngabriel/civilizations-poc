import type { Building, BuildingId, Person, Profession, World } from "./model";
import { canLearnProfession, currentProfession } from "./experience";
import { same } from "./hex";
import {
  canChangePersonProfession,
  preparePersonForEducation,
  setLearnedProfession,
  setPersonProfession,
  setPersonWorkplace,
} from "./personCommands";
import { CONFIG } from "./scenario";
import { findRequiredNavigationPath } from "./wayposts";

export const EDUCATION_DURATION_TICKS = 60 * CONFIG.simulationHz;

const completedSchool = (building: Building): boolean =>
  building.kind === "school" &&
  !building.retired &&
  (!building.construction || building.construction.complete);

export const completedSchools = (world: World): Building[] =>
  world.buildings.filter(completedSchool);

export const educationTeacherCandidates = (
  world: World,
  studentId: number,
  profession: Profession,
): Person[] =>
  world.people.filter((person) =>
    person.id !== studentId &&
    !person.educationTask &&
    canChangePersonProfession(person) &&
    canLearnProfession(person, profession)
  );

const routeToSchool = (world: World, person: Person, school: Building): boolean => {
  if (same(person.position, school.position)) {
    person.path = [];
    person.movement = 0;
    person.active = false;
    return true;
  }
  const path = findRequiredNavigationPath(
    world,
    person,
    school.position,
    CONFIG.roadSpeedMultiplier,
  );
  if (!path) return false;
  person.path = path;
  person.movement = 0;
  person.active = false;
  return true;
};

const restorePreviousState = (
  world: World,
  person: Person,
  profession: Profession | undefined,
  assignment: Person["assignment"],
): void => {
  if (profession) setPersonProfession(world, person.id, profession);
  else setPersonProfession(world, person.id, undefined);
  if (assignment) setPersonWorkplace(world, person.id, assignment.building);
};

const cancelPair = (world: World, first: Person, second?: Person): void => {
  const firstTask = first.educationTask;
  const secondTask = second?.educationTask;
  first.educationTask = undefined;
  if (second) second.educationTask = undefined;
  if (firstTask)
    restorePreviousState(world, first, firstTask.returnProfession, firstTask.returnAssignment);
  if (second && secondTask)
    restorePreviousState(world, second, secondTask.returnProfession, secondTask.returnAssignment);
};

export function startEducation(
  world: World,
  studentId: number,
  schoolId: BuildingId,
  profession: Profession,
  teacherId: number,
): boolean {
  const student = world.people.find((person) => person.id === studentId);
  const teacher = world.people.find((person) => person.id === teacherId);
  const school = world.buildings.find((building) => building.id === schoolId);
  if (
    !student ||
    !teacher ||
    student === teacher ||
    !school ||
    !completedSchool(school) ||
    student.educationTask ||
    teacher.educationTask ||
    !canChangePersonProfession(student) ||
    !canChangePersonProfession(teacher) ||
    !canLearnProfession(teacher, profession)
  ) return false;

  const studentProfession = currentProfession(world, student);
  const teacherProfession = currentProfession(world, teacher);
  const studentAssignment = student.assignment ? { ...student.assignment } : undefined;
  const teacherAssignment = teacher.assignment ? { ...teacher.assignment } : undefined;

  const studentRoute = same(student.position, school.position)
    ? []
    : findRequiredNavigationPath(world, student, school.position, CONFIG.roadSpeedMultiplier);
  const teacherRoute = same(teacher.position, school.position)
    ? []
    : findRequiredNavigationPath(world, teacher, school.position, CONFIG.roadSpeedMultiplier);
  if (!studentRoute || !teacherRoute) return false;

  if (!preparePersonForEducation(world, student.id)) return false;
  if (!preparePersonForEducation(world, teacher.id)) {
    restorePreviousState(world, student, studentProfession, studentAssignment);
    return false;
  }

  student.educationTask = {
    role: "student",
    schoolId: school.id,
    profession,
    partnerId: teacher.id,
    progressTicks: 0,
    active: false,
    returnProfession: studentProfession,
    returnAssignment: studentAssignment,
  };
  teacher.educationTask = {
    role: "teacher",
    schoolId: school.id,
    profession,
    partnerId: student.id,
    progressTicks: 0,
    active: false,
    returnProfession: teacherProfession,
    returnAssignment: teacherAssignment,
  };

  student.path = studentRoute;
  teacher.path = teacherRoute;
  student.movement = 0;
  teacher.movement = 0;
  student.active = false;
  teacher.active = false;
  return true;
}

const unavailableForLesson = (person: Person): boolean =>
  Boolean(person.hungerState || person.sleepState);

const finishLesson = (world: World, student: Person, teacher: Person): void => {
  const profession = student.educationTask!.profession;
  const teacherTask = teacher.educationTask!;
  student.educationTask = undefined;
  teacher.educationTask = undefined;

  setLearnedProfession(world, student.id, profession);

  if (teacherTask.returnProfession)
    setPersonProfession(world, teacher.id, teacherTask.returnProfession);
  else
    setPersonProfession(world, teacher.id, undefined);

  if (teacherTask.returnAssignment)
    setPersonWorkplace(world, teacher.id, teacherTask.returnAssignment.building);
};

export function advanceEducation(world: World): void {
  const visited = new Set<number>();

  for (const student of world.people) {
    const task = student.educationTask;
    if (!task || task.role !== "student" || visited.has(student.id)) continue;
    const teacher = world.people.find((person) => person.id === task.partnerId);
    visited.add(student.id);
    if (teacher) visited.add(teacher.id);

    if (
      !teacher ||
      teacher.educationTask?.role !== "teacher" ||
      teacher.educationTask.partnerId !== student.id ||
      teacher.educationTask.schoolId !== task.schoolId ||
      teacher.educationTask.profession !== task.profession
    ) {
      cancelPair(world, student, teacher);
      continue;
    }

    const school = world.buildings.find((building) => building.id === task.schoolId);
    if (!school || !completedSchool(school)) {
      cancelPair(world, student, teacher);
      continue;
    }

    if (unavailableForLesson(student) || unavailableForLesson(teacher)) {
      task.active = false;
      teacher.educationTask.active = false;
      continue;
    }

    if (!same(student.position, school.position)) {
      task.active = false;
      teacher.educationTask.active = false;
      if (student.path.length === 0 && !routeToSchool(world, student, school))
        cancelPair(world, student, teacher);
      continue;
    }

    if (!same(teacher.position, school.position)) {
      task.active = false;
      teacher.educationTask.active = false;
      if (teacher.path.length === 0 && !routeToSchool(world, teacher, school))
        cancelPair(world, student, teacher);
      continue;
    }

    student.path = [];
    teacher.path = [];
    task.active = true;
    teacher.educationTask.active = true;
    task.progressTicks += 1;
    teacher.educationTask.progressTicks = task.progressTicks;

    if (task.progressTicks >= EDUCATION_DURATION_TICKS)
      finishLesson(world, student, teacher);
  }
}
