import type { Person, World } from "../simulation/model";
import { personWorldPosition } from "../simulation/movement";
import { HEX_Y, pixel } from "./mapGeometry";
import { personInsideBuilding } from "./personVisibility";

export const PERSON_MARKER_RADIUS = HEX_Y / 2;
export const PERSON_FEET_OFFSET_Y = HEX_Y * 0.15;
export const PERSON_MARKER_CENTER_OFFSET_Y = PERSON_FEET_OFFSET_Y - PERSON_MARKER_RADIUS;

export type PersonMarkerPosition = {
  person: Person;
  x: number;
  y: number;
  groundY: number;
};

export function personMarkerPositions(world: World): PersonMarkerPosition[] {
  return world.people.filter((person) => !personInsideBuilding(world, person)).map((person) => {
    const position = pixel(personWorldPosition(world, person));
    const groundY = position.y;

    return {
      person,
      x: position.x,
      groundY,
      y: groundY + PERSON_MARKER_CENTER_OFFSET_Y,
    };
  });
}
