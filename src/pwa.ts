import "./pwa.css";

const APP_BASE = "/civilizations-poc/";
const CURRENT_BUILD_TIME = process.env.BUILD_TIME ?? "";
const VERSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const UPDATE_BANNER_ID = "pwa-update-banner";

interface VersionPayload {
  buildTime?: unknown;
}

let reloadForServiceWorker = false;

function showUpdateBanner(registration: ServiceWorkerRegistration): void {
  if (document.getElementById(UPDATE_BANNER_ID)) return;

  const banner = document.createElement("aside");
  banner.id = UPDATE_BANNER_ID;
  banner.className = "pwa-update-banner";
  banner.setAttribute("role", "status");

  const label = document.createElement("span");
  label.textContent = "Neue Version verfügbar.";

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Neu laden";
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Aktualisiere …";

    try {
      await registration.update();
    } catch {
      // A normal reload still performs a network-first navigation when online.
    }

    if (registration.waiting) {
      reloadForServiceWorker = true;
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(() => window.location.reload(), 1500);
      return;
    }

    window.location.reload();
  });

  banner.append(label, button);
  document.body.append(banner);
}

async function fetchLatestBuildTime(): Promise<string | null> {
  if (!navigator.onLine) return null;

  try {
    const url = new URL(`${APP_BASE}version.json`, window.location.origin);
    url.searchParams.set("check", Date.now().toString());
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as VersionPayload;
    return typeof payload.buildTime === "string" ? payload.buildTime : null;
  } catch {
    return null;
  }
}

function watchInstallingWorker(
  registration: ServiceWorkerRegistration,
  worker: ServiceWorker | null,
): void {
  if (!worker) return;

  worker.addEventListener("statechange", () => {
    if (worker.state !== "installed") return;
    if (!navigator.serviceWorker.controller) return;
    showUpdateBanner(registration);
  });
}

export function installPwaSupport(): void {
  if (!("serviceWorker" in navigator)) return;

  void navigator.serviceWorker
    .register(`${APP_BASE}sw.js`, {
      scope: APP_BASE,
      updateViaCache: "none",
    })
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner(registration);
      }

      registration.addEventListener("updatefound", () => {
        watchInstallingWorker(registration, registration.installing);
      });

      const checkForVersion = async (): Promise<void> => {
        if (document.visibilityState === "hidden") return;
        const latestBuildTime = await fetchLatestBuildTime();
        if (!latestBuildTime || latestBuildTime === CURRENT_BUILD_TIME) return;

        try {
          await registration.update();
        } catch {
          // The version endpoint already proved a newer deployment exists.
        }
        showUpdateBanner(registration);
      };

      void checkForVersion();
      window.setInterval(() => void checkForVersion(), VERSION_CHECK_INTERVAL_MS);
      window.addEventListener("online", () => void checkForVersion());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void checkForVersion();
      });
    })
    .catch(() => {
      // Offline startup or unsupported hosting must not block the game.
    });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloadForServiceWorker) return;
    reloadForServiceWorker = false;
    window.location.reload();
  });
}
