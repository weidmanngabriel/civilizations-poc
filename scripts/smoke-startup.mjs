import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import { resolve } from "node:path";

const URL = "http://127.0.0.1:4173/civilizations-poc/";

const executable = (candidate) => {
  if (!candidate) return undefined;
  if (candidate.includes("/")) {
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      return undefined;
    }
  }
  const result = spawnSync("which", [candidate], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
};

const chrome = [
  process.env.CHROME_PATH,
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
].map(executable).find(Boolean);

if (!chrome) throw new Error("Kein Chromium/Chrome für den Startup-Smoke-Test gefunden.");

const vite = resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "vite.cmd" : "vite",
);

const preview = spawn(
  vite,
  ["preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
  { stdio: ["ignore", "pipe", "pipe"] },
);

let previewLog = "";
preview.stdout.on("data", (chunk) => { previewLog += String(chunk); });
preview.stderr.on("data", (chunk) => { previewLog += String(chunk); });

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (preview.exitCode !== null)
      throw new Error(`Vite preview wurde unerwartet beendet.\n${previewLog}`);
    try {
      const response = await fetch(URL);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // Server booting.
    }
    await sleep(100);
  }
  if (!ready) throw new Error(`Vite preview wurde nicht erreichbar.\n${previewLog}`);

  const browser = spawnSync(
    chrome,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--virtual-time-budget=8000",
      "--dump-dom",
      URL,
    ],
    {
      encoding: "utf8",
      timeout: 25000,
      maxBuffer: 20 * 1024 * 1024,
    },
  );

  if (browser.error) throw browser.error;
  const dom = browser.stdout ?? "";
  if (browser.status !== 0)
    throw new Error(`Browser-Smoke-Test ist fehlgeschlagen.\n${browser.stderr ?? ""}`);
  if (dom.includes('data-game-crashed="true"')) {
    const crashIndex = dom.indexOf('id="runtime-crash-screen"');
    const crashExcerpt = crashIndex >= 0
      ? dom.slice(Math.max(0, crashIndex - 300), crashIndex + 3500)
      : dom.slice(0, 5000);
    throw new Error(
      `Spiel ist beim Browser-Startup gecrasht.\nBrowser stderr:\n${browser.stderr ?? ""}\nCrash DOM:\n${crashExcerpt}`,
    );
  }
  if (!dom.includes('data-game-ready="true"'))
    throw new Error(
      `Spiel hat den Ready-Zustand nicht erreicht.\nBrowser stderr:\n${browser.stderr ?? ""}\nDOM:\n${dom.slice(0, 5000)}`,
    );

  process.stdout.write("Startup-Smoke-Test erfolgreich: game-ready erreicht.\n");
} finally {
  preview.kill("SIGTERM");
}
