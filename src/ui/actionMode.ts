const ACTION_MODE_EVENTS = [
  "poc-build-mode",
  "poc-merchant-target-mode",
  "poc-upgrade-preview",
  "poc-person-command-mode",
  "poc-work-area-mode",
] as const;

type ActionModeDetail = { active?: boolean };

/**
 * Keeps a single presentation-only focus state for map actions.
 * Multiple action sources are tracked independently so one mode ending cannot
 * accidentally reveal the normal UI while another mode is still active.
 */
export function installActionModeVisibility(): void {
  const main = document.querySelector<HTMLElement>("main");
  if (!main) return;

  const activeModes = new Set<string>();
  const sync = () => main.classList.toggle("ui-action-mode", activeModes.size > 0);

  for (const eventName of ACTION_MODE_EVENTS) {
    window.addEventListener(eventName, (event) => {
      const active = Boolean((event as CustomEvent<ActionModeDetail>).detail?.active);
      if (active) activeModes.add(eventName);
      else activeModes.delete(eventName);
      sync();
    });
  }
}
