import { spawn, spawnSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const preset = process.argv[2] ?? "woodcut";
const frameCount = Math.max(2, Number.parseInt(process.argv[3] ?? "21", 10) || 21);
const root = process.cwd();
const outputDir = path.join(root, "character-lab", "review-output", preset);
const port = 4173;
const baseUrl = `http://127.0.0.1:${port}/civilizations-poc/character-lab/`;

function findChrome() {
  for (const candidate of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [candidate], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("No Chrome/Chromium executable found.");
}

async function waitForServer(url, timeoutMs = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not become ready: ${url}`);
}

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const preview = spawn("npm", ["run", "preview", "--", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
  cwd: root,
  stdio: "inherit",
});

try {
  await waitForServer(baseUrl);
  const chrome = findChrome();

  for (let index = 0; index < frameCount; index += 1) {
    const progress = index / (frameCount - 1);
    const percent = Math.round(progress * 100);
    const filename = path.join(outputDir, `frame-${String(percent).padStart(3, "0")}.png`);
    const url = new URL(baseUrl);
    url.searchParams.set("capture", preset);
    url.searchParams.set("progress", progress.toFixed(6));
    url.searchParams.set("yaw", "135");
    url.searchParams.set("zoom", "0.9");

    const result = spawnSync(chrome, [
      "--headless=new",
      "--no-sandbox",
      "--hide-scrollbars",
      "--window-size=960,720",
      "--force-device-scale-factor=1",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-angle=swiftshader",
      "--virtual-time-budget=1500",
      `--screenshot=${filename}`,
      url.toString(),
    ], { stdio: "inherit" });

    if (result.status !== 0) throw new Error(`Chrome capture failed at progress ${progress}`);
  }

  console.log(`Captured ${frameCount} review frames to ${outputDir}`);
} finally {
  preview.kill("SIGTERM");
}
