import { defineConfig, type Plugin } from "vite";

const APP_BASE = "/civilizations-poc/";
const buildTime = new Date().toISOString();

function createServiceWorker(precacheUrls: string[]): string {
  return `const APP_BASE = ${JSON.stringify(APP_BASE)};
const CACHE_NAME = ${JSON.stringify(`civilizations-poc-${buildTime}`)};
const VERSION_PATH = APP_BASE + "version.json";
const PRECACHE_URLS = ${JSON.stringify(precacheUrls)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.startsWith("civilizations-poc-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(APP_BASE + "index.html", response.clone());
    }
    return response;
  } catch {
    return (
      (await caches.match(APP_BASE + "index.html")) ||
      Response.error()
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(APP_BASE)) return;

  if (url.pathname === VERSION_PATH) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});
`;
}

function offlinePwaPlugin(): Plugin {
  return {
    name: "offline-pwa",
    apply: "build",
    generateBundle(_options, bundle) {
      const bundleUrls = Object.keys(bundle)
        .filter((fileName) => fileName !== "version.json" && fileName !== "sw.js")
        .map((fileName) => `${APP_BASE}${fileName}`);
      const precacheUrls = [
        `${APP_BASE}index.html`,
        `${APP_BASE}manifest.webmanifest`,
        `${APP_BASE}pwa-icon.svg`,
        ...bundleUrls,
      ];

      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ buildTime }, null, 2),
      });
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: createServiceWorker([...new Set(precacheUrls)]),
      });
    },
  };
}

export default defineConfig({
  base: APP_BASE,
  plugins: [offlinePwaPlugin()],
  define: {
    "process.env.BUILD_TIME": JSON.stringify(buildTime),
  },
});
