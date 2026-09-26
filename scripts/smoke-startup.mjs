import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const URL = "http://127.0.0.1:4173/civilizations-poc/";
const DEBUG_PORT = 9222;

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

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const waitForHttp = async (url, label, attempts = 80, diagnose) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const failure = diagnose?.();
    if (failure) throw new Error(`${label} konnte nicht gestartet werden.\n${failure}`);
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Process is still booting.
    }
    await sleep(100);
  }
  const failure = diagnose?.();
  throw new Error(`${label} wurde nicht rechtzeitig erreichbar.${failure ? `\n${failure}` : ""}`);
};

const connectCdp = async (webSocketDebuggerUrl) => {
  const socket = new WebSocket(webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("DevTools-WebSocket konnte nicht verbunden werden.")),
      5000,
    );
    socket.addEventListener("open", () => {
      clearTimeout(timeout);
      resolvePromise();
    }, { once: true });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("DevTools-WebSocket meldete einen Verbindungsfehler."));
    }, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  const exceptions = [];

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.method === "Runtime.exceptionThrown")
      exceptions.push(message.params?.exceptionDetails);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });

  const call = (method, params = {}) =>
    new Promise((resolvePromise, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve: resolvePromise, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  return { socket, call, exceptions };
};

const preview = spawn(
  vite,
  ["preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let previewLog = "";
preview.stdout.on("data", (chunk) => { previewLog += String(chunk); });
preview.stderr.on("data", (chunk) => { previewLog += String(chunk); });

let browser;
let browserLog = "";
let browserSpawnError;
const profile = mkdtempSync(join(tmpdir(), "civilizations-smoke-"));

try {
  await waitForHttp(URL, "Vite preview");

  browser = spawn(
    chrome,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--enable-unsafe-swiftshader",
      "--remote-allow-origins=*",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile}`,
      "--window-size=1280,800",
      URL,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  browser.stdout.on("data", (chunk) => { browserLog += String(chunk); });
  browser.stderr.on("data", (chunk) => { browserLog += String(chunk); });
  browser.on("error", (error) => { browserSpawnError = error; });

  await waitForHttp(
    `http://127.0.0.1:${DEBUG_PORT}/json/list`,
    "Chrome DevTools",
    200,
    () => {
      if (browserSpawnError)
        return `Chrome-Prozessfehler: ${browserSpawnError.message}\nBrowser:\n${browserLog}`;
      if (browser?.exitCode !== null)
        return `Chrome wurde vorzeitig mit Exit-Code ${browser.exitCode} beendet.\nBrowser:\n${browserLog}`;
      return undefined;
    },
  );

  const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const page = targets.find((target) => target.type === "page" && target.url.startsWith(URL));
  if (!page?.webSocketDebuggerUrl)
    throw new Error(`Spiel-Tab nicht in DevTools gefunden.\n${JSON.stringify(targets, null, 2)}`);

  const { socket, call, exceptions } = await connectCdp(page.webSocketDebuggerUrl);
  try {
    await call("Runtime.enable");

    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const evaluation = await call("Runtime.evaluate", {
        expression: `JSON.stringify({
          ready: document.documentElement.dataset.gameReady === "true",
          crashed: document.documentElement.dataset.gameCrashed === "true",
          crashText: document.querySelector("#runtime-crash-screen")?.innerText ?? "",
          canvasCount: document.querySelectorAll("#game canvas").length
        })`,
        returnByValue: true,
      });
      const state = JSON.parse(evaluation.result?.value ?? "{}");

      if (state.crashed)
        throw new Error(
          `Spiel ist beim Browser-Startup gecrasht.\n${state.crashText}\nBrowser:\n${browserLog}\nExceptions:\n${JSON.stringify(exceptions, null, 2)}`,
        );

      if (state.ready) {
        if (state.canvasCount < 1)
          throw new Error("Spiel meldet game-ready, aber im #game-Container existiert kein Canvas.");
        process.stdout.write("Startup-Smoke-Test erfolgreich: game-ready erreicht.\n");
        break;
      }

      await sleep(100);
    }

    const finalEvaluation = await call("Runtime.evaluate", {
      expression: 'document.documentElement.dataset.gameReady === "true"',
      returnByValue: true,
    });
    if (finalEvaluation.result?.value !== true)
      throw new Error(
        `Spiel hat den Ready-Zustand nicht innerhalb von 20 Sekunden erreicht.\nBrowser:\n${browserLog}\nExceptions:\n${JSON.stringify(exceptions, null, 2)}`,
      );
  } finally {
    socket.close();
  }
} finally {
  browser?.kill("SIGKILL");
  preview.kill("SIGTERM");
  rmSync(profile, { recursive: true, force: true });
}
