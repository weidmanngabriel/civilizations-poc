import type { World } from "../simulation/model";
import {
  performanceProfiler,
  type FeatureMetric,
  type PathReasonMetric,
  type PerformanceFeature,
  type PerformanceHistoryPoint,
  type PathReason,
} from "../debug/performanceProfiler";

const format = (value: number, digits = 1): string =>
  Number.isFinite(value) ? value.toFixed(digits).replace(".", ",") : "0";
const svgNumber = (value: number): string =>
  Number.isFinite(value) ? value.toFixed(2) : "0";

const FEATURE_LABELS: Record<PerformanceFeature, string> = {
  hunger: "Hunger / Nahrung",
  movement: "Bewegung",
  transport: "Logistik / Transport",
  construction: "Baustellen",
  farm: "Farm / Felder",
  production: "Produktion",
  planning: "Arbeitsplanung",
  renderWorld: "renderWorld",
  overlayHunger: "Hunger-Overlay",
  overlayBush: "Busch-Overlay",
};

const PATH_REASON_LABELS: Record<PathReason, string> = {
  hunger: "Hunger / Nahrung",
  woodcutter: "Holzfäller",
  builder: "Bauarbeiter",
  logistics: "Träger / Versorgung",
  merchant: "Händler",
  farm: "Farm",
  reroute: "Neuberechnung",
  other: "Sonstige",
};

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

const featureRow = (feature: FeatureMetric): string =>
  `<tr><td>${FEATURE_LABELS[feature.key]}</td><td>${format(feature.msPerSecond, 2)}</td><td>${format(feature.average, 3)}</td><td>${format(feature.p95, 3)}</td><td>${format(feature.callsPerSecond, 1)}</td><td>${feature.objectsPerSecond > 0 ? format(feature.objectsPerSecond, 0) : "–"}</td></tr>`;

const pathReasonRow = (reason: PathReasonMetric): string =>
  `<tr><td>${PATH_REASON_LABELS[reason.reason]}</td><td>${format(reason.msPerSecond, 2)}</td><td>${format(reason.callsPerSecond, 1)}</td><td>${format(reason.average, 3)}</td><td>${format(reason.p95, 3)}</td></tr>`;

export function renderPerformanceDebug(container: HTMLElement, world: World): void {
  const snapshot = performanceProfiler.snapshot();
  const activeBuildings = world.buildings.filter((building) => !building.retired);
  const fields = activeBuildings.filter((building) => building.kind === "field").length;
  const forests = activeBuildings.filter((building) => building.forestRemaining !== undefined).length;
  const moving = world.people.filter((person) => person.path.length > 0).length;
  const trips = world.people.filter((person) => person.trip).length;
  const featuresByCost = [...snapshot.features].sort((a, b) => b.msPerSecond - a.msPerSecond);
  const visiblePathReasons = snapshot.pathReasons
    .filter((reason) => reason.count > 0)
    .sort((a, b) => b.msPerSecond - a.msPerSecond);

  const consumers = [
    ...snapshot.features.map((feature) => ({
      label: FEATURE_LABELS[feature.key],
      ms: feature.msPerSecond,
    })),
    { label: "Sim Sonstiges", ms: snapshot.simulationOtherMsPerSecond },
  ].filter((consumer) => consumer.ms > 0.001).sort((a, b) => b.ms - a.ms);
  const measuredTotal = consumers.reduce((sum, consumer) => sum + consumer.ms, 0);
  const consumerSummary = consumers.slice(0, 5).map((consumer) => {
    const share = measuredTotal > 0 ? (consumer.ms / measuredTotal) * 100 : 0;
    return `<span><strong>${format(share, 0)} %</strong> ${consumer.label}</span>`;
  }).join("");

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
      <span>Sim erfasst: <strong>${format(snapshot.simulationAccountedMsPerSecond, 2)} ms/s</strong></span>
      <span>Sim Sonstiges: <strong>${format(snapshot.simulationOtherMsPerSecond, 2)} ms/s</strong></span>
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
    </div>
    <div class="perf-section">
      <div class="perf-section-title"><strong>Top-Verbraucher</strong><small>Anteil an der gemessenen App-Zeit · Pathfinding ist bereits in den Features enthalten</small></div>
      <div class="perf-consumers">${consumerSummary || "<span>Noch keine Samples</span>"}</div>
    </div>
    <div class="perf-section">
      <div class="perf-section-title"><strong>Features · 10-s-Fenster</strong><small>Objekte/s zeigt neu erzeugte Phaser-Objekte der Overlays</small></div>
      <div class="perf-table-wrap"><table class="perf-table"><thead><tr><th>Feature</th><th>ms/s</th><th>Ø ms</th><th>p95</th><th>Aufr./s</th><th>Obj./s</th></tr></thead><tbody>${featuresByCost.map(featureRow).join("")}</tbody></table></div>
    </div>
    <div class="perf-section">
      <div class="perf-section-title"><strong>Pathfinding nach Auslöser</strong><small>Nur Attribution; die Zeit nicht zusätzlich zu den Feature-Kosten addieren</small></div>
      <div class="perf-table-wrap"><table class="perf-table"><thead><tr><th>Auslöser</th><th>ms/s</th><th>Suchen/s</th><th>Ø ms</th><th>p95</th></tr></thead><tbody>${visiblePathReasons.length ? visiblePathReasons.map(pathReasonRow).join("") : "<tr><td colspan=\"5\">Noch keine Pfadsuchen</td></tr>"}</tbody></table></div>
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
