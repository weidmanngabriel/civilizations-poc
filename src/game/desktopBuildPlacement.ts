import Phaser from "phaser";
import type { IncrementalMainScene } from "./IncrementalMainScene";

const BUILD_MODE_EVENT = "poc-build-mode";
const TAP_MAX_DISTANCE = 8;

type BuildModeDetail = { active: boolean };
type BuildPlacementScene = {
  updateBuildHover: (screenX: number, screenY: number, notify?: boolean) => void;
};

type PointerPosition = { x: number; y: number };

const isDesktopPointer = (event: PointerEvent): boolean => event.pointerType === "mouse";

export function installDesktopBuildPlacement(
  game: Phaser.Game,
  scene: IncrementalMainScene,
): void {
  const canvas = game.canvas;
  const placementScene = scene as unknown as BuildPlacementScene;
  let active = false;
  let pointerDown: PointerPosition | undefined;
  let lastPointer: PointerPosition | undefined;

  const screenPosition = (event: PointerEvent): PointerPosition => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const setDesktopInstructions = (desktop: boolean): void => {
    const overlay = document.querySelector<HTMLElement>("#build-placement-overlay");
    const copy = overlay?.querySelector<HTMLElement>("span");
    const confirm = document.querySelector<HTMLButtonElement>("#build-placement-confirm");
    if (copy) {
      copy.innerHTML = desktop
        ? "<b>Maus bewegen, um die Position zu wählen.</b> Linksklick baut. Escape bricht ab. Grün ist gültig, rot blockiert."
        : "<b>Tippen, um eine Position zu wählen.</b> Ziehen verschiebt die Karte. Grün ist gültig, rot blockiert.";
    }
    if (confirm) confirm.hidden = desktop;
  };

  const updateGhost = (position: PointerPosition): void => {
    lastPointer = position;
    if (!active) return;
    placementScene.updateBuildHover(position.x, position.y, true);
  };

  canvas.addEventListener("pointermove", (event) => {
    if (!isDesktopPointer(event)) return;
    updateGhost(screenPosition(event));
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (!active || !isDesktopPointer(event) || event.button !== 0) return;
    pointerDown = screenPosition(event);
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!active || !isDesktopPointer(event) || event.button !== 0 || !pointerDown) return;
    const position = screenPosition(event);
    const distance = Math.hypot(position.x - pointerDown.x, position.y - pointerDown.y);
    pointerDown = undefined;
    updateGhost(position);
    if (distance > TAP_MAX_DISTANCE) return;
    document.querySelector<HTMLButtonElement>("#build-placement-confirm")?.click();
  });

  window.addEventListener(BUILD_MODE_EVENT, (event) => {
    const detail = (event as CustomEvent<BuildModeDetail>).detail;
    active = detail.active;
    pointerDown = undefined;
    const desktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    setDesktopInstructions(active && desktop);
    if (!active || !desktop) return;

    const activePointer = scene.input?.activePointer;
    const fallback = activePointer
      ? { x: activePointer.x, y: activePointer.y }
      : undefined;
    const position = lastPointer ?? fallback;
    if (position) updateGhost(position);
  });

  document.addEventListener("keydown", (event) => {
    if (!active || event.key !== "Escape") return;
    event.preventDefault();
    document.querySelector<HTMLButtonElement>("#build-placement-cancel")?.click();
  });
}