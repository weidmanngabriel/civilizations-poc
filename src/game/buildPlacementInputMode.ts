export type BuildPlacementInputMode = "desktop" | "touch";

export function buildPlacementInputModeForPointer(
  pointerType: string | undefined,
  desktopFallback: boolean,
): BuildPlacementInputMode {
  switch (pointerType?.toLowerCase()) {
    case "mouse":
      return "desktop";
    case "touch":
    case "pen":
      return "touch";
    default:
      return desktopFallback ? "desktop" : "touch";
  }
}
