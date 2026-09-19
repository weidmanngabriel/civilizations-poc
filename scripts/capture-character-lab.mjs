import { spawn, spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const preset = process.argv[2] ?? "woodcut";
const reviewFrameCount = Math.max(2, Number.parseInt(process.argv[3] ?? "21", 10) || 21);
const videoFps = 8;
const root = process.cwd();
const outputDir = path.join(root, "character-lab", "review-output", preset);
const videoFrameDir = path.join(outputDir, ".video-frames");
const port = 4173;
const debugPort = 9222;
const baseUrl = `http://127.0.0.1:${port}/civilizations-poc/character-lab/`;

function which(candidates) {
  for (const candidate of candidates) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  return undefined;
}

async function waitForServer(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Preview server did not become ready: ${url}`);
}

async function waitForJson(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Chrome DevTools endpoint did not become ready: ${url}`);
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.waiters = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const waiter = this.waiters.get(message.method);
      if (waiter) {
        this.waiters.delete(message.method);
        waiter(message.params);
      }
    });
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId++;
    const promise = new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.socket.send(JSON.stringify({ id, method, params }));
    return promise;
  }

  async waitFor(method, timeoutMs = 10000) {
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.waiters.delete(method);
        reject(new Error(`Timed out waiting for CDP event ${method}`));
      }, timeoutMs);
      this.waiters.set(method, (params) => {
        clearTimeout(timeout);
        resolve(params);
      });
    });
  }

  close() {
    this.socket.close();
  }
}

async function waitForLab(client, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await client.send("Runtime.evaluate", {
      expression: `document.querySelector("#status")?.textContent?.startsWith("Bereit") === true && !!window.characterLab`,
      returnByValue: true,
    });
    if (result.result?.value === true) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Character Lab did not become capture-ready.");
}

async function renderProgress(client, progress) {
  await client.send("Runtime.evaluate", {
    expression: `window.characterLab.captureFrame(${Number(progress).toFixed(8)})`,
    awaitPromise: true,
    returnByValue: false,
  });
}

async function capturePng(client, filename) {
  const result = await client.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await writeFile(filename, Buffer.from(result.data, "base64"));
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(videoFrameDir, { recursive: true });

const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: root,
  stdio: "inherit",
});

let chrome;
let client;
const userDataDir = path.join(os.tmpdir(), `character-lab-capture-${process.pid}`);

try {
  await waitForServer(baseUrl);
  const chromePath = which(["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]);
  if (!chromePath) throw new Error("No Chrome/Chromium executable found.");
  const ffmpeg = which(["ffmpeg"]);
  if (!ffmpeg) throw new Error("ffmpeg is required for the Character Lab WebM export.");

  chrome = spawn(chromePath, [
    "--headless=new",
    "--no-sandbox",
    "--hide-scrollbars",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--use-angle=swiftshader",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: "ignore" });

  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const pageInfo = await (await fetch(`http://127.0.0.1:${debugPort}/json/new`, { method: "PUT" })).json();
  client = new CdpClient(pageInfo.webSocketDebuggerUrl);
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 640,
    height: 480,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const url = new URL(baseUrl);
  url.searchParams.set("capture", preset);
  url.searchParams.set("progress", "0");
  url.searchParams.set("yaw", "135");
  url.searchParams.set("zoom", "0.82");

  const loaded = client.waitFor("Page.loadEventFired");
  await client.send("Page.navigate", { url: url.toString() });
  await loaded;
  await waitForLab(client);

  for (let index = 0; index < reviewFrameCount; index += 1) {
    const progress = index / (reviewFrameCount - 1);
    const percent = Math.round(progress * 100);
    await renderProgress(client, progress);
    await capturePng(client, path.join(outputDir, `frame-${String(percent).padStart(3, "0")}.png`));
  }

  const stateResult = await client.send("Runtime.evaluate", {
    expression: "window.characterLab.getState().animation.previewDurationMs ?? 1800",
    returnByValue: true,
  });
  const durationMs = Number(stateResult.result?.value) || 1800;
  const videoFrameCount = Math.max(2, Math.round((durationMs / 1000) * videoFps));

  for (let index = 0; index < videoFrameCount; index += 1) {
    const progress = videoFrameCount <= 1 ? 0 : index / (videoFrameCount - 1);
    await renderProgress(client, progress);
    await capturePng(client, path.join(videoFrameDir, `frame-${String(index).padStart(4, "0")}.png`));
  }

  const videoPath = path.join(outputDir, `${preset}.webm`);
  const encode = spawnSync(ffmpeg, [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-framerate", String(videoFps),
    "-i", path.join(videoFrameDir, "frame-%04d.png"),
    "-c:v", "libvpx-vp9",
    "-crf", "40",
    "-b:v", "0",
    "-deadline", "good",
    "-cpu-used", "4",
    "-pix_fmt", "yuv420p",
    "-an",
    videoPath,
  ], { stdio: "inherit" });
  if (encode.status !== 0) throw new Error("ffmpeg failed to encode Character Lab WebM.");

  await rm(videoFrameDir, { recursive: true, force: true });
  console.log(`Captured ${reviewFrameCount} review PNGs and ${durationMs / 1000}s WebM at ${videoFps} fps to ${outputDir}`);
} finally {
  client?.close();
  if (chrome && chrome.exitCode === null) {
    const exited = new Promise((resolve) => chrome.once("exit", resolve));
    chrome.kill("SIGTERM");
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
  }
  preview.kill("SIGTERM");
  await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}
