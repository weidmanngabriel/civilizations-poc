import type { Person, World } from "../simulation/model";
import { key } from "../simulation/hex";
import { personWorldPosition } from "../simulation/movement";
import { HEX_Y, pixel } from "./mapGeometry";\nimport { personInsideBuilding } from "./personVisibility";

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
  const groups = new Map<string, number>();
  return world.people.filter((person) => !personInsideBuilding(world, person)).map((person) => {
    const moving = person.path.length > 0;
    const positionKey = key(person.position);
    const groupIndex = groups.get(positionKey) ?? 0;
    groups.set(positionKey, groupIndex + 1);

    const position = pixel(personWorldPosition(world, person));
    const x = moving
      ? position.x
      : position.x + ((groupIndex % 4) - 1.5) * 5;
    const groundY = position.y + (moving ? 0 : Math.floor(groupIndex / 4) * 5);

    return {
      person,
      x,
      groundY,
      y: groundY + PERSON_MARKER_CENTER_OFFSET_Y,
    };
  });
}
