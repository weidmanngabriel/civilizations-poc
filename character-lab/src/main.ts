import "./style.css";
import characterDefinitionJson from "./character.json";

type Axis = "pitch" | "yaw";
type PartId = "head" | "leftArm" | "rightArm" | "leftLeg" | "rightLeg";
type Pose = Record<string, number>;
type Keyframe = { progress: number; pose: Pose };
type AnimationDefinition = {
  schema: "civilizations-character-animation";
  version: 1;
  id: string;
  keyframes: Keyframe[];
};

type JointBound = { min: number; max: number; neutral: number };
type CharacterDefinition = {
  parts: Record<PartId, Partial<Record<Axis, JointBound>>>;
};

const CHARACTER = characterDefinitionJson as unknown as CharacterDefinition;

const NEUTRAL_POSE: Pose = {
  "head.pitch": 0,
  "head.yaw": 0,
  "leftArm.pitch": 0,
  "rightArm.pitch": 0,
  "leftLeg.pitch": 0,
  "rightLeg.pitch": 0,
};

const IDLE: AnimationDefinition = {
  schema: "civilizations-character-animation",
  version: 1,
  id: "idle",
  keyframes: [
    { progress: 0, pose: { ...NEUTRAL_POSE } },
    { progress: 1, pose: { ...NEUTRAL_POSE } },
  ],
};

const WALK: AnimationDefinition = {
  schema: "civilizations-character-animation",
  version: 1,
  id: "walk",
  keyframes: [
    {
      progress: 0,
      pose: {
        ...NEUTRAL_POSE,
        "leftArm.pitch": -32,
        "rightArm.pitch": 32,
        "leftLeg.pitch": 34,
        "rightLeg.pitch": -34,
      },
    },
    {
      progress: 0.5,
      pose: {
        ...NEUTRAL_POSE,
        "leftArm.pitch": 32,
        "rightArm.pitch": -32,
        "leftLeg.pitch": -34,
        "rightLeg.pitch": 34,
      },
    },
    {
      progress: 1,
      pose: {
        ...NEUTRAL_POSE,
        "leftArm.pitch": -32,
        "rightArm.pitch": 32,
        "leftLeg.pitch": 34,
        "rightLeg.pitch": -34,
      },
    },
  ],
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Character Lab root missing.");

app.innerHTML = `
<div class="lab-shell">
  <header class="lab-header">
    <div>
      <h1>Character Lab</h1>
      <p>Blockiger 3D-Charakter · Posen und Animationen mit normiertem Fortschritt</p>
    </div>
    <a href="${import.meta.env.BASE_URL}">Zum Spiel</a>
  </header>
  <main class="lab-layout">
    <section class="preview-panel">
      <canvas id="viewport" aria-label="3D-Charaktervorschau"></canvas>
      <div class="preview-toolbar" aria-label="Feste Blickrichtungen">
        <button data-dir="0">N</button><button data-dir="45">NE</button><button data-dir="90">E</button>
        <button data-dir="135">SE</button><button data-dir="180">S</button><button data-dir="225">SW</button>
        <button data-dir="270">W</button><button data-dir="315">NW</button>
      </div>
    </section>
    <aside class="sidebar">
      <section class="panel">
        <h2>Animation</h2>
        <div class="field">
          <label for="animation-id">ID</label>
          <input id="animation-id" type="text" value="walk" spellcheck="false" />
        </div>
        <div class="actions">
          <button class="secondary" id="example-idle">Idle laden</button>
          <button class="secondary" id="example-walk">Walk laden</button>
          <button class="secondary" id="import-animation">JSON öffnen</button>
          <button class="primary" id="export-animation">JSON exportieren</button>
        </div>
        <input id="import-input" type="file" accept="application/json,.json" hidden />
      </section>

      <section class="panel">
        <h2>Timeline</h2>
        <div class="timeline">
          <button class="secondary" id="play">▶</button>
          <input id="progress" type="range" min="0" max="1" step="0.001" value="0" />
        </div>
        <div class="value-row"><span>Fortschritt</span><strong id="progress-label">0 %</strong></div>
        <div class="actions" style="margin-top:10px">
          <button class="primary" id="set-keyframe">Keyframe setzen</button>
          <button class="secondary" id="delete-keyframe">Keyframe löschen</button>
        </div>
        <div class="keyframes" id="keyframes" aria-label="Keyframes"></div>
      </section>

      <section class="panel">
        <h2>Pose</h2>
        <div class="field">
          <label for="part">Körperteil</label>
          <select id="part">
            <option value="head">Kopf</option>
            <option value="leftArm">Linker Arm</option>
            <option value="rightArm">Rechter Arm</option>
            <option value="leftLeg">Linkes Bein</option>
            <option value="rightLeg">Rechtes Bein</option>
          </select>
        </div>
        <div id="joint-controls"></div>
        <button class="secondary" id="neutral-pose">Neutralpose</button>
      </section>

      <section class="panel">
        <h2>Ansicht</h2>
        <div class="field">
          <label for="yaw">Charakterdrehung</label>
          <input id="yaw" type="range" min="0" max="360" step="1" value="135" />
          <div class="value-row"><span>360° frei drehbar</span><strong id="yaw-label">135°</strong></div>
        </div>
        <div class="field">
          <label for="zoom">Zoom</label>
          <input id="zoom" type="range" min="0.6" max="2.5" step="0.01" value="1" />
        </div>
        <p class="help">Du kannst die Vorschau außerdem horizontal ziehen, um die Figur zu drehen, und mit dem Mausrad zoomen.</p>
      </section>

      <section class="panel api-note">
        <h2>Agent-Steuerung</h2>
        <p class="help">Die UI und Automatisierung benutzen denselben Steuerkern. Im Browser steht <code>window.characterLab</code> zur Verfügung.</p>
        <div class="status" id="status">Initialisiere 3D-Vorschau …</div>
      </section>
    </aside>
  </main>
</div>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#viewport")!;
const progressInput = document.querySelector<HTMLInputElement>("#progress")!;
const progressLabel = document.querySelector<HTMLElement>("#progress-label")!;
const animationIdInput = document.querySelector<HTMLInputElement>("#animation-id")!;
const partSelect = document.querySelector<HTMLSelectElement>("#part")!;
const jointControls = document.querySelector<HTMLDivElement>("#joint-controls")!;
const keyframesEl = document.querySelector<HTMLDivElement>("#keyframes")!;
const playButton = document.querySelector<HTMLButtonElement>("#play")!;
const yawInput = document.querySelector<HTMLInputElement>("#yaw")!;
const yawLabel = document.querySelector<HTMLElement>("#yaw-label")!;
const zoomInput = document.querySelector<HTMLInputElement>("#zoom")!;
const status = document.querySelector<HTMLDivElement>("#status")!;
const importInput = document.querySelector<HTMLInputElement>("#import-input")!;

let currentAnimation = structuredClone(WALK);
let currentPose: Pose = { ...NEUTRAL_POSE };
let progress = 0;
let playing = false;
let playStart = 0;
let playStartProgress = 0;
let characterYaw = 135;
let zoom = 1;
let renderPose: (pose: Pose) => void = () => {};
let renderYaw: (degrees: number) => void = () => {};
let renderZoom: (value: number) => void = () => {};

function jointKey(part: PartId, axis: Axis): string {
  return `${part}.${axis}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function boundForKey(key: string): JointBound | undefined {
  const [partRaw, axisRaw] = key.split(".");
  const part = partRaw as PartId;
  const axis = axisRaw as Axis;
  return CHARACTER.parts[part]?.[axis];
}

function sanitizePose(value: unknown): Pose {
  const result: Pose = { ...NEUTRAL_POSE };
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const bound = boundForKey(key);
    if (!bound || typeof raw !== "number" || !Number.isFinite(raw)) continue;
    result[key] = clamp(raw, bound.min, bound.max);
  }
  return result;
}

function sanitizeAnimation(value: unknown): AnimationDefinition {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Animation muss ein JSON-Objekt sein.");
  const raw = value as Record<string, unknown>;
  if (raw.schema !== "civilizations-character-animation" || raw.version !== 1)
    throw new Error("Unbekanntes Animationsschema.");
  if (typeof raw.id !== "string" || !/^[a-z0-9][a-z0-9_-]*$/i.test(raw.id))
    throw new Error("Ungültige Animations-ID.");
  if (!Array.isArray(raw.keyframes) || raw.keyframes.length < 1) throw new Error("Mindestens ein Keyframe ist erforderlich.");

  const keyframes = raw.keyframes.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error("Ungültiger Keyframe.");
    const frame = entry as Record<string, unknown>;
    if (typeof frame.progress !== "number" || !Number.isFinite(frame.progress))
      throw new Error("Keyframe-Fortschritt fehlt.");
    return {
      progress: clamp(frame.progress, 0, 1),
      pose: sanitizePose(frame.pose),
    };
  }).sort((a, b) => a.progress - b.progress);

  const deduped: Keyframe[] = [];
  for (const frame of keyframes) {
    const previous = deduped.at(-1);
    if (previous && Math.abs(previous.progress - frame.progress) < 0.0001) deduped[deduped.length - 1] = frame;
    else deduped.push(frame);
  }
  return { schema: "civilizations-character-animation", version: 1, id: raw.id, keyframes: deduped };
}

function evaluateAnimation(animation: AnimationDefinition, at: number): Pose {
  const t = clamp(at, 0, 1);
  const frames = animation.keyframes;
  if (!frames.length) return { ...NEUTRAL_POSE };
  if (t <= frames[0]!.progress) return { ...frames[0]!.pose };
  const last = frames[frames.length - 1]!;
  if (t >= last.progress) return { ...last.pose };

  for (let i = 0; i < frames.length - 1; i += 1) {
    const a = frames[i]!;
    const b = frames[i + 1]!;
    if (t < a.progress || t > b.progress) continue;
    const span = Math.max(0.000001, b.progress - a.progress);
    const local = (t - a.progress) / span;
    const result: Pose = {};
    for (const key of Object.keys(NEUTRAL_POSE)) {
      const av = a.pose[key] ?? NEUTRAL_POSE[key] ?? 0;
      const bv = b.pose[key] ?? av;
      result[key] = av + (bv - av) * local;
    }
    return sanitizePose(result);
  }
  return { ...last.pose };
}

function setStatus(message: string, error = false): void {
  status.textContent = message;
  status.classList.toggle("error", error);
}

function updatePose(next: Pose): void {
  currentPose = sanitizePose(next);
  renderPose(currentPose);
  renderJointControls();
}

function setProgress(value: number): void {
  progress = clamp(Number.isFinite(value) ? value : 0, 0, 1);
  progressInput.value = String(progress);
  progressLabel.textContent = `${Math.round(progress * 100)} %`;
  updatePose(evaluateAnimation(currentAnimation, progress));
  renderKeyframes();
}

function setPartAngle(part: PartId, axis: Axis, degrees: number): number {
  const bound = CHARACTER.parts[part]?.[axis];
  if (!bound) throw new Error(`${part} unterstützt ${axis} nicht.`);
  const value = clamp(degrees, bound.min, bound.max);
  currentPose[jointKey(part, axis)] = value;
  updatePose(currentPose);
  return value;
}

function setCharacterYaw(value: number): void {
  characterYaw = ((value % 360) + 360) % 360;
  yawInput.value = String(characterYaw);
  yawLabel.textContent = `${Math.round(characterYaw)}°`;
  renderYaw(characterYaw);
}

function setZoom(value: number): void {
  zoom = clamp(value, 0.6, 2.5);
  zoomInput.value = String(zoom);
  renderZoom(zoom);
}

function setKeyframe(at = progress, pose = currentPose): void {
  const p = clamp(at, 0, 1);
  const frame = { progress: p, pose: sanitizePose(pose) };
  const existing = currentAnimation.keyframes.findIndex((candidate) => Math.abs(candidate.progress - p) < 0.0001);
  if (existing >= 0) currentAnimation.keyframes[existing] = frame;
  else currentAnimation.keyframes.push(frame);
  currentAnimation.keyframes.sort((a, b) => a.progress - b.progress);
  renderKeyframes();
  setStatus(`Keyframe bei ${Math.round(p * 100)} % gespeichert.`);
}

function deleteKeyframe(at = progress): void {
  const index = currentAnimation.keyframes.findIndex((candidate) => Math.abs(candidate.progress - at) < 0.005);
  if (index < 0) {
    setStatus("An dieser Position gibt es keinen Keyframe.", true);
    return;
  }
  if (currentAnimation.keyframes.length <= 1) {
    setStatus("Mindestens ein Keyframe muss erhalten bleiben.", true);
    return;
  }
  currentAnimation.keyframes.splice(index, 1);
  setProgress(progress);
  setStatus("Keyframe gelöscht.");
}

function loadAnimation(animation: unknown): void {
  currentAnimation = sanitizeAnimation(animation);
  animationIdInput.value = currentAnimation.id;
  pause();
  setProgress(0);
  setStatus(`Animation „${currentAnimation.id}“ geladen.`);
}

function exportAnimation(): AnimationDefinition {
  currentAnimation.id = animationIdInput.value.trim() || "animation";
  return sanitizeAnimation(currentAnimation);
}

function play(): void {
  if (playing) return;
  playing = true;
  playStart = performance.now();
  playStartProgress = progress >= 0.999 ? 0 : progress;
  playButton.textContent = "⏸";
}

function pause(): void {
  playing = false;
  playButton.textContent = "▶";
}

function renderKeyframes(): void {
  keyframesEl.replaceChildren();
  for (const frame of currentAnimation.keyframes) {
    const button = document.createElement("button");
    button.className = "keyframe-chip";
    if (Math.abs(frame.progress - progress) < 0.005) button.classList.add("active");
    button.textContent = `${Math.round(frame.progress * 100)} %`;
    button.addEventListener("click", () => {
      pause();
      setProgress(frame.progress);
    });
    keyframesEl.append(button);
  }
}

function renderJointControls(): void {
  jointControls.replaceChildren();
  const part = partSelect.value as PartId;
  const axes = CHARACTER.parts[part];
  for (const axis of Object.keys(axes) as Axis[]) {
    const bound = axes[axis]!;
    const key = jointKey(part, axis);
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    const label = document.createElement("label");
    label.textContent = axis === "pitch" ? "Vor / zurück" : "Links / rechts";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(bound.min);
    slider.max = String(bound.max);
    slider.step = "1";
    slider.value = String(currentPose[key] ?? bound.neutral);
    const values = document.createElement("div");
    values.className = "value-row";
    values.innerHTML = `<span>${bound.min}° … ${bound.max}°</span><strong>${Math.round(Number(slider.value))}°</strong>`;
    slider.addEventListener("input", () => {
      pause();
      const actual = setPartAngle(part, axis, Number(slider.value));
      const strong = values.querySelector("strong");
      if (strong) strong.textContent = `${Math.round(actual)}°`;
    });
    wrapper.append(label, slider, values);
    jointControls.append(wrapper);
  }
}

function downloadJson(value: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function neutralizePose(): void {
  pause();
  updatePose({ ...NEUTRAL_POSE });
}

progressInput.addEventListener("input", () => {
  pause();
  setProgress(Number(progressInput.value));
});
partSelect.addEventListener("change", renderJointControls);
document.querySelector("#set-keyframe")!.addEventListener("click", () => setKeyframe());
document.querySelector("#delete-keyframe")!.addEventListener("click", () => deleteKeyframe());
document.querySelector("#neutral-pose")!.addEventListener("click", neutralizePose);
playButton.addEventListener("click", () => playing ? pause() : play());
yawInput.addEventListener("input", () => setCharacterYaw(Number(yawInput.value)));
zoomInput.addEventListener("input", () => setZoom(Number(zoomInput.value)));
animationIdInput.addEventListener("input", () => {
  currentAnimation.id = animationIdInput.value.trim() || "animation";
});
document.querySelector("#example-idle")!.addEventListener("click", () => loadAnimation(IDLE));
document.querySelector("#example-walk")!.addEventListener("click", () => loadAnimation(WALK));
document.querySelector("#import-animation")!.addEventListener("click", () => importInput.click());
document.querySelector("#export-animation")!.addEventListener("click", () => {
  try {
    const animation = exportAnimation();
    downloadJson(animation, `${animation.id}.json`);
    setStatus("Animation als JSON exportiert.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Export fehlgeschlagen.", true);
  }
});
importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) return;
  try {
    loadAnimation(JSON.parse(await file.text()) as unknown);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Import fehlgeschlagen.", true);
  } finally {
    importInput.value = "";
  }
});
document.querySelectorAll<HTMLButtonElement>("[data-dir]").forEach((button) => {
  button.addEventListener("click", () => setCharacterYaw(Number(button.dataset.dir)));
});

type CharacterLabApi = {
  getState(): {
    animation: AnimationDefinition;
    progress: number;
    pose: Pose;
    characterYaw: number;
    zoom: number;
    bounds: CharacterDefinition;
  };
  setProgress(value: number): void;
  setPartAngle(part: PartId, axis: Axis, degrees: number): number;
  setCharacterYaw(degrees: number): void;
  setZoom(value: number): void;
  loadAnimation(animation: unknown): void;
  exportAnimation(): AnimationDefinition;
  setKeyframe(progress?: number, pose?: Pose): void;
  deleteKeyframe(progress?: number): void;
  play(): void;
  pause(): void;
};

declare global {
  interface Window { characterLab: CharacterLabApi; }
}

window.characterLab = {
  getState: () => ({
    animation: structuredClone(exportAnimation()),
    progress,
    pose: { ...currentPose },
    characterYaw,
    zoom,
    bounds: structuredClone(CHARACTER),
  }),
  setProgress,
  setPartAngle,
  setCharacterYaw,
  setZoom,
  loadAnimation,
  exportAnimation: () => structuredClone(exportAnimation()),
  setKeyframe,
  deleteKeyframe,
  play,
  pause,
};

async function initThree(): Promise<void> {
  try {
    const threeUrl = "https://cdn.jsdelivr.net/npm/three@0.180.0/+esm";
    const THREE = await import(/* @vite-ignore */ threeUrl);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x17271d);

    const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
    camera.position.set(7, 6, 7);
    camera.lookAt(0, 2.5, 0);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x526257, 2.2);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(5, 9, 6);
    scene.add(key);

    const grid = new THREE.GridHelper(14, 14, 0x617264, 0x35483b);
    scene.add(grid);

    const root = new THREE.Group();
    scene.add(root);

    const material = new THREE.MeshStandardMaterial({ color: 0xd9b08c, roughness: 1, metalness: 0 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x547a60, roughness: 1, metalness: 0 });
    const trousers = new THREE.MeshStandardMaterial({ color: 0x3e5264, roughness: 1, metalness: 0 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x6d4b2d, roughness: 1, metalness: 0 });

    function box(width: number, height: number, depth: number, mat: unknown) {
      return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
    }

    const torso = box(1.5, 2.1, 0.75, shirt);
    torso.position.y = 3.55;
    root.add(torso);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 4.75, 0);
    root.add(headPivot);
    const head = box(1.25, 1.25, 1.15, material);
    head.position.y = 0.62;
    headPivot.add(head);
    const hairTop = box(1.29, 0.18, 1.19, hair);
    hairTop.position.y = 1.18;
    headPivot.add(hairTop);

    function limbPivot(x: number, y: number, length: number, mat: unknown, isArm: boolean) {
      const pivot = new THREE.Group();
      pivot.position.set(x, y, 0);
      root.add(pivot);
      const limb = box(isArm ? 0.48 : 0.58, length, isArm ? 0.48 : 0.62, mat);
      limb.position.y = -length / 2;
      pivot.add(limb);
      return pivot;
    }

    const leftArm = limbPivot(-1.0, 4.35, 2.05, material, true);
    const rightArm = limbPivot(1.0, 4.35, 2.05, material, true);
    const leftLeg = limbPivot(-0.42, 2.48, 2.45, trousers, false);
    const rightLeg = limbPivot(0.42, 2.48, 2.45, trousers, false);

    renderPose = (pose) => {
      headPivot.rotation.x = THREE.MathUtils.degToRad(pose["head.pitch"] ?? 0);
      headPivot.rotation.y = THREE.MathUtils.degToRad(pose["head.yaw"] ?? 0);
      leftArm.rotation.x = THREE.MathUtils.degToRad(pose["leftArm.pitch"] ?? 0);
      rightArm.rotation.x = THREE.MathUtils.degToRad(pose["rightArm.pitch"] ?? 0);
      leftLeg.rotation.x = THREE.MathUtils.degToRad(pose["leftLeg.pitch"] ?? 0);
      rightLeg.rotation.x = THREE.MathUtils.degToRad(pose["rightLeg.pitch"] ?? 0);
    };
    renderYaw = (degrees) => { root.rotation.y = THREE.MathUtils.degToRad(degrees); };
    renderZoom = (value) => { camera.zoom = value; camera.updateProjectionMatrix(); };

    function resize(): void {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const size = 4.1;
      camera.left = -size * aspect;
      camera.right = size * aspect;
      camera.top = size;
      camera.bottom = -size;
      camera.updateProjectionMatrix();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let dragX: number | undefined;
    canvas.addEventListener("pointerdown", (event) => {
      dragX = event.clientX;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (dragX === undefined) return;
      const dx = event.clientX - dragX;
      dragX = event.clientX;
      setCharacterYaw(characterYaw + dx * 0.65);
    });
    const endDrag = () => { dragX = undefined; };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      setZoom(zoom * (event.deltaY > 0 ? 0.92 : 1.08));
    }, { passive: false });

    renderPose(currentPose);
    renderYaw(characterYaw);
    renderZoom(zoom);
    setStatus("Bereit · Three.js-Vorschau aktiv · window.characterLab verfügbar.");

    function frame(now: number): void {
      if (playing) {
        const cycleMs = 1800;
        const elapsed = (now - playStart) / cycleMs;
        const next = playStartProgress + elapsed;
        setProgress(next % 1);
      }
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } catch (error) {
    setStatus(
      `3D-Vorschau konnte nicht geladen werden: ${error instanceof Error ? error.message : "unbekannter Fehler"}`,
      true,
    );
  }
}

renderJointControls();
renderKeyframes();
setProgress(0);
setCharacterYaw(characterYaw);
setZoom(zoom);
void initThree();
