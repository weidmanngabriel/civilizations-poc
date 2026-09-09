import Phaser from "phaser";

const MIN_CAMERA_ZOOM = 0.7;
const MAX_CAMERA_ZOOM = 3.5;
const TAP_MAX_DISTANCE = 18;

type Point = { x: number; y: number };
type SelectableScene = Phaser.Scene;
type SceneWithSelection = Phaser.Scene & {
  selectAtScreenPoint?: (screenX: number, screenY: number) => void;
};

const clampZoom = (zoom: number): number =>
  Phaser.Math.Clamp(zoom, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);

export function installMobileMapTouchControls(
  game: Phaser.Game,
  scene: SelectableScene,
): void {
  const canvas = game.canvas;
  let previousTouches = new Map<number, Point>();
  let tapStart: Point | undefined;
  let tapMoved = false;

  const toGamePoint = (clientX: number, clientY: number): Point => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) * scene.scale.width) / rect.width,
      y: ((clientY - rect.top) * scene.scale.height) / rect.height,
    };
  };

  const snapshotTouches = (touches: TouchList): Map<number, Point> => {
    const result = new Map<number, Point>();
    for (const touch of Array.from(touches))
      result.set(touch.identifier, toGamePoint(touch.clientX, touch.clientY));
    return result;
  };

  const captureTouch = (event: TouchEvent): void => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const onTouchStart = (event: TouchEvent): void => {
    captureTouch(event);
    previousTouches = snapshotTouches(event.touches);
    if (event.touches.length === 1) {
      tapStart = [...previousTouches.values()][0];
      tapMoved = false;
    } else {
      tapStart = undefined;
      tapMoved = true;
    }
  };

  const onTouchMove = (event: TouchEvent): void => {
    captureTouch(event);

    const nextTouches = snapshotTouches(event.touches);
    const camera = scene.cameras.main;
    const current = Array.from(nextTouches.entries());

    if (current.length >= 2) {
      tapStart = undefined;
      tapMoved = true;
      const first = current[0];
      const second = current[1];
      if (!first || !second) return;

      const [firstId, firstNow] = first;
      const [secondId, secondNow] = second;
      const firstBefore = previousTouches.get(firstId);
      const secondBefore = previousTouches.get(secondId);
      if (!firstBefore || !secondBefore) {
        previousTouches = nextTouches;
        return;
      }

      const oldDistance = Phaser.Math.Distance.Between(
        firstBefore.x,
        firstBefore.y,
        secondBefore.x,
        secondBefore.y,
      );
      const newDistance = Phaser.Math.Distance.Between(
        firstNow.x,
        firstNow.y,
        secondNow.x,
        secondNow.y,
      );
      if (oldDistance > 0) {
        const oldCenter = {
          x: (firstBefore.x + secondBefore.x) / 2,
          y: (firstBefore.y + secondBefore.y) / 2,
        };
        const newCenter = {
          x: (firstNow.x + secondNow.x) / 2,
          y: (firstNow.y + secondNow.y) / 2,
        };
        const anchorWorld = camera.getWorldPoint(oldCenter.x, oldCenter.y);
        camera.setZoom(clampZoom(camera.zoom * (newDistance / oldDistance)));
        const movedAnchorWorld = camera.getWorldPoint(newCenter.x, newCenter.y);
        camera.scrollX += anchorWorld.x - movedAnchorWorld.x;
        camera.scrollY += anchorWorld.y - movedAnchorWorld.y;
      }
    } else if (current.length === 1) {
      const only = current[0];
      if (!only) return;
      const [id, now] = only;
      const before = previousTouches.get(id);
      if (tapStart && Phaser.Math.Distance.Between(tapStart.x, tapStart.y, now.x, now.y) > TAP_MAX_DISTANCE)
        tapMoved = true;
      if (before) {
        camera.scrollX -= (now.x - before.x) / camera.zoom;
        camera.scrollY -= (now.y - before.y) / camera.zoom;
      }
    }

    previousTouches = nextTouches;
  };

  const onTouchEnd = (event: TouchEvent): void => {
    captureTouch(event);
    if (event.touches.length === 0 && tapStart && !tapMoved)
      (scene as SceneWithSelection).selectAtScreenPoint?.(tapStart.x, tapStart.y);
    previousTouches = snapshotTouches(event.touches);
    if (event.touches.length === 0) {
      tapStart = undefined;
      tapMoved = false;
    }
  };

  const touchOptions: AddEventListenerOptions = {
    passive: false,
    capture: true,
  };
  canvas.addEventListener("touchstart", onTouchStart, touchOptions);
  canvas.addEventListener("touchmove", onTouchMove, touchOptions);
  canvas.addEventListener("touchend", onTouchEnd, touchOptions);
  canvas.addEventListener("touchcancel", onTouchEnd, touchOptions);
}

export function preventMobilePageZoom(): void {
  const preventGesture = (event: Event): void => event.preventDefault();
  const preventMultiTouch = (event: TouchEvent): void => {
    if (event.touches.length > 1) event.preventDefault();
  };

  for (const type of ["gesturestart", "gesturechange", "gestureend"])
    document.addEventListener(type, preventGesture, {
      passive: false,
      capture: true,
    });

  document.addEventListener("touchmove", preventMultiTouch, {
    passive: false,
    capture: true,
  });
}
