import type { World } from "./model";

type DebugCheatState = {
  technologies: boolean;
  materials: boolean;
};

const states = new WeakMap<World, DebugCheatState>();

const stateFor = (world: World): DebugCheatState => {
  let state = states.get(world);
  if (!state) {
    state = { technologies: false, materials: false };
    states.set(world, state);
  }
  return state;
};

export const isTechnologyCheatEnabled = (world: World): boolean =>
  stateFor(world).technologies;

export const isMaterialCheatEnabled = (world: World): boolean =>
  stateFor(world).materials;

export const setTechnologyCheatEnabled = (world: World, enabled: boolean): void => {
  stateFor(world).technologies = enabled;
};

export const setMaterialCheatEnabled = (world: World, enabled: boolean): void => {
  stateFor(world).materials = enabled;
};
