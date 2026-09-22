export type ScreenPoint = { x: number; y: number };

export const DESKTOP_TAP_MAX_DISTANCE = 8;
export const MOBILE_TAP_MAX_DISTANCE = 18;
export const MOBILE_LONG_PRESS_MS = 450;

export const screenPointDistance = (a: ScreenPoint, b: ScreenPoint): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

export const isWithinTapDistance = (
  start: ScreenPoint,
  current: ScreenPoint,
  maxDistance: number,
): boolean => screenPointDistance(start, current) <= maxDistance;
