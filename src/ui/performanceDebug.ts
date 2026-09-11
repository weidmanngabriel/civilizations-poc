import type { World } from "../simulation/model";
import { performanceProfiler, type PerformanceHistoryPoint } from "../debug/performanceProfiler";

const format = (value: number, digits = 1): string =>
  Number.isFinite(value) ? value.toFixed(digits).replace(".", ",") : "0";
const svgNumber = (value: number): string =>
  Number.isFinite(value) ? value.toFixed(2) : "0";

const sparkline = (
  points: PerformanceHistoryPoint[],
  pick: (point: PerformanceHistoryPoint) => number,
): string => {
  const values = points.map(pick).map((value) => Number.isFinite(value) ? value : 0);
  const max = Math.max(1, ...values);
  const width = 180;
  const height = 46;
  const polyline = values
    .map((value, index) => {
      const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * width;
      const y = height - (value / max) * height;
      return `${svgNumber(x)},${svgNumber(y)}`;
    })
    .join(" ");
  return `<svg class="perf-chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${polyline}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke" /></svg>`;
};

const metric = (label: string, value: string, detail: string): string =>
  `<div class="perf-metric"><small>${label}</small><strong>${value}</strong><span>${detail}</span></div>`;

export function renderPerformanceDebug(container: HTMLElement, world: World): void {
  const snapshot = performanceProfiler.snapshot();
  const activeBuildings = world.buildings.filter((building) => !building.retired);
  const fields = activeBuildings.filter((building) => building.kind === "field").length;
  const forests = activeBuildings.filter((building) => building.forestRemaining !== undefined).length;
  const moving = world.people.filter((person) => person.path.length > 0).length;
  const trips = world.people.filter((person) => person.trip).length;

  container.innerHTML = `
    <div class="perf-grid">
      ${metric("FPS · 1 s", format(snapshot.fps1s, 0), `10 s Ø ${format(snapshot.fps10s, 1)}`)}
      ${metric("Frame", `${format(snapshot.frame.average, 2)} ms`, `p95 ${format(snapshot.frame.p95, 2)} · max ${format(snapshot.frame.max, 2)}`)}
      ${metric("Sim-Ticks/s", format(snapshot.ticksPerSecond, 0), `${snapshot.simulationRunning ? `${format(snapshot.simulationSpeed, 1)}×` : "pausiert"} · Rückstand ${format(snapshot.simulationBacklogMs, 1)} ms`)}
      ${metric("Sim-Tick", `${format(snapshot.tick.average, 3)} ms`, `p95 ${format(snapshot.tick.p95, 3)} · max ${format(snapshot.tick.max, 3)}`)}
      ${metric("Pathfinding", `${format(snapshot.path.total / 10, 2)} ms/s`, `${format(snapshot.pathCallsPerSecond, 1)} Suchen/s · p95 ${format(snapshot.path.p95, 3)} ms`)}
      ${metric("renderWorld", `${format(snapshot.render.average, 2)} ms`, `${format(snapshot.renderCallsPerSecond, 1)} Aufrufe/s · p95 ${format(snapshot.render.p95, 2)}`)}
    </div>
    <div class="perf-warning-row">
      <span>Frames &gt; 16,7 ms: <strong>${snapshot.slowFrames16}</strong> / 10 s</span>
      <span>Frames &gt; 33 ms: <strong>${snapshot.slowFrames33}</strong> / 10 s</span>
    </div>
    <div class="perf-world">
      <span>Tiles <strong>${world.tiles.length}</strong></span>
      <span>Personen <strong>${world.people.length}</strong></span>
      <span>Gebäude <strong>${activeBuildings.length}</strong></span>
      <span>Felder <strong>${fields}</strong></span>
      <span>Wälder <strong>${forests}</strong></span>
      <span>laufend <strong>${moving}</strong></span>
      <span>Trips <strong>${trips}</strong></span>
    </div>
    <div class="perf-charts">
      <div><small>FPS · 30 s</small>${sparkline(snapshot.history, (point) => point.fps)}</div>
      <div><small>Framezeit · 30 s</small>${sparkline(snapshot.history, (point) => point.frameMs)}</div>
      <div><small>Sim-Tick · 30 s</small>${sparkline(snapshot.history, (point) => point.tickMs)}</div>
      <div><small>Pathfinding-Zeit/s · 30 s</small>${sparkline(snapshot.history, (point) => point.pathMs)}</div>
    </div>`;
}

export function installPerformanceDebugPanel(world: World): void {
  const panel = document.querySelector<HTMLElement>("#debug-panel");
  const header = panel?.querySelector<HTMLElement>(".debug-header");
  if (!panel || !header) return;

  header.querySelector("strong")!.textContent = "Debug / Performance";
  const container = document.createElement("section");
  container.id = "performance-debug";
  header.insertAdjacentElement("afterend", container);

  const people = document.querySelector<HTMLElement>("#people");
  if (people) {
    const heading = document.createElement("div");
    heading.className = "debug-subheading";
    heading.textContent = "Personen und Transportaufträge";
    people.insertAdjacentElement("beforebegin", heading);
  }

  const refresh = () => {
    if (!panel.hidden) renderPerformanceDebug(container, world);
  };
  refresh();
  window.setInterval(refresh, 250);
}
