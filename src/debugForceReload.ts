const FORCE_RELOAD_BUTTON_ID = "debug-force-reload";
const CACHE_BUST_PARAM = "_reload";

function forceReload(): void {
  const url = new URL(window.location.href);
  url.searchParams.set(CACHE_BUST_PARAM, Date.now().toString());
  window.location.replace(url.toString());
}

function mountForceReloadButton(): boolean {
  if (document.getElementById(FORCE_RELOAD_BUTTON_ID)) return true;

  const panel = document.getElementById("debug-panel");
  if (!panel) return false;

  const header = panel.querySelector(".debug-header");
  const people = panel.querySelector("#people");
  if (!header || !people) return false;

  const button = document.createElement("button");
  button.id = FORCE_RELOAD_BUTTON_ID;
  button.type = "button";
  button.textContent = "Neu laden (Cache umgehen)";
  button.title = "Lädt die aktuelle App-Version mit einer neuen URL und umgeht dabei einen veralteten Seiten-Cache.";
  button.addEventListener("click", forceReload);

  people.before(button);
  return true;
}

if (!mountForceReloadButton()) {
  const observer = new MutationObserver(() => {
    if (!mountForceReloadButton()) return;
    observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
