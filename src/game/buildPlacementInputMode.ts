export type BuildPlacementInputMode = "desktop" | "touch";

export function buildPlacementInputModeForPointer(
  pointerType: string | undefined,
  desktopFallback: boolean,
): BuildPlacementInputMode {
  if (pointerType) return pointerType === "mouse" ? "desktop" : "touch";
  return desktopFallback ? "desktop" : "touch";
}
