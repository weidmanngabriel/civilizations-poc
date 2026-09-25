import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const APP_BASE = "/civilizations-poc/";
const buildTime = new Date().toISOString();
const buildSha = process.env.GITHUB_SHA ?? "local";

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
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      (await caches.match(request)) ||
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

function buildingEditorLocalExportPlugin(): Plugin {
  return {
    name: "building-editor-local-export",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const requestPath = request.url?.split("?", 1)[0];
        const endpoint = `${APP_BASE}__building-editor/save`;
        if (request.method !== "POST" || (requestPath !== endpoint && requestPath !== "/__building-editor/save")) {
          next();
          return;
        }

        try {
          let body = "";
          for await (const chunk of request) {
            body += String(chunk);
            if (body.length > 20_000_000) throw new Error("Export ist zu groß.");
          }

          const payload = JSON.parse(body) as {
            definition?: { id?: string; sprite?: string };
            spriteDataUrl?: string;
          };
          const id = payload.definition?.id ?? "";
          if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error("Ungültige Gebäude-ID.");

          const match = payload.spriteDataUrl?.match(/^data:(image\/(?:png|webp));base64,(.+)$/);
          if (!match) throw new Error("Sprite muss PNG oder WebP sein.");
          const mime = match[1];
          const encoded = match[2];
          if (!mime || !encoded) throw new Error("Sprite-Daten fehlen.");
          const extension = mime === "image/webp" ? "webp" : "png";
          if (payload.definition?.sprite !== `sprite.${extension}`) throw new Error("Sprite-Dateiname passt nicht zum Bildtyp.");

          const target = resolve(process.cwd(), "src", "assets", "buildings", id);
          await mkdir(target, { recursive: true });
          await writeFile(resolve(target, "building.json"), `${JSON.stringify(payload.definition, null, 2)}\n`, "utf8");
          await writeFile(resolve(target, `sprite.${extension}`), Buffer.from(encoded, "base64"));

          response.statusCode = 200;
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify({ ok: true, path: `src/assets/buildings/${id}/` }));
        } catch (error) {
          response.statusCode = 400;
          response.setHeader("content-type", "application/json");
          response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Export fehlgeschlagen." }));
        }
      });
    },
  };
}

export default defineConfig({
  base: APP_BASE,
  plugins: [buildingEditorLocalExportPlugin(), offlinePwaPlugin()],
  build: {
    rollupOptions: {
      input: {
        game: resolve(process.cwd(), "index.html"),
        buildingEditor: resolve(process.cwd(), "building-editor", "index.html"),
        characterLab: resolve(process.cwd(), "character-lab", "index.html"),
      },
    },
  },
  define: {
    "process.env.BUILD_TIME": JSON.stringify(buildTime),
    "process.env.BUILD_SHA": JSON.stringify(buildSha),
  },
});
