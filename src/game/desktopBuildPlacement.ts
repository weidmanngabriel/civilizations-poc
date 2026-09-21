import Phaser from "phaser";
import type { IncrementalMainScene } from "./IncrementalMainScene";
import { buildPlacementInputModeForPointer } from "./buildPlacementInputMode";

const BUILD_MODE_EVENT = "poc-build-mode";
const TAP_MAX_DISTANCE = 8;

type BuildModeDetail = { active: boolean; kind?: string };
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
  let activeKind: string | undefined;
  let pointerDown: PointerPosition | undefined;
  let clickEligible = false;
  let lastPointer: PointerPosition | undefined;
  let lastPointerType: string | undefined;

  const screenPosition = (clientX: number, clientY: number): PointerPosition => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const setPlacementInputMode = (pointerType?: string): "desktop" | "touch" => {
    const mode = buildPlacementInputModeForPointer(
      pointerType,
      window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    );
    const overlay = document.querySelector<HTMLElement>("#build-placement-overlay");
    const copy = overlay?.querySelector<HTMLElement>("span");
    const confirm = document.querySelector<HTMLButtonElement>("#build-placement-confirm");
    if (copy && activeKind !== "palisade") {
      copy.innerHTML = mode === "desktop"
        ? "<b>Maus bewegen, um die Position zu wählen.</b> Linksklick platziert. Rechtsklick oder Escape bricht ab. Grün ist gültig, rot blockiert."
        : "<b>Tippen, um eine Position zu wählen.</b> Ziehen verschiebt die Karte. Grün ist gültig, rot blockiert.";
    }
    if (confirm) confirm.hidden = mode === "desktop" && activeKind !== "palisade";
    return mode;
  };

  const updateGhost = (position: PointerPosition): void => {
    lastPointer = position;
    if (!active) return;
    placementScene.updateBuildHover(position.x, position.y, true);
  };

  window.addEventListener("pointerdown", (event) => {
    lastPointerType = event.pointerType;
    if (active) setPlacementInputMode(lastPointerType);
  }, { capture: true });

  canvas.addEventListener("pointermove", (event) => {
    if (!isDesktopPointer(event)) return;
    lastPointerType = event.pointerType;
    if (active) setPlacementInputMode(lastPointerType);
    updateGhost(screenPosition(event.clientX, event.clientY));
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (!active || !isDesktopPointer(event) || event.button !== 0) return;
    pointerDown = screenPosition(event.clientX, event.clientY);
    clickEligible = false;
  });

  canvas.addEventListener("pointerup", (event) => {
    if (!active || !isDesktopPointer(event) || event.button !== 0 || !pointerDown) return;
    const position = screenPosition(event.clientX, event.clientY);
    clickEligible = Math.hypot(position.x - pointerDown.x, position.y - pointerDown.y) <= TAP_MAX_DISTANCE;
    pointerDown = undefined;
    updateGhost(position);
  });

  canvas.addEventListener("click", (event) => {
    if (!active || !clickEligible) return;
    clickEligible = false;
    updateGhost(screenPosition(event.clientX, event.clientY));
    if (activeKind !== "palisade")
      document.querySelector<HTMLButtonElement>("#build-placement-confirm")?.click();
  });

  canvas.addEventListener("contextmenu", (event) => {
    if (!active) return;
    event.preventDefault();
    document.querySelector<HTMLButtonElement>("#build-placement-cancel")?.click();
  });

  window.addEventListener(BUILD_MODE_EVENT, (event) => {
    const detail = (event as CustomEvent<BuildModeDetail>).detail;
    active = detail.active;
    activeKind = detail.active ? detail.kind : undefined;
    pointerDown = undefined;
    clickEligible = false;
    if (!active) return;
    const mode = setPlacementInputMode(lastPointerType);
    if (mode !== "desktop") return;

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