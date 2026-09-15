import { resourcePerformanceSnapshot } from "../debug/resourcePerformance";

const format = (value: number, digits = 2): string =>
  Number.isFinite(value) ? value.toFixed(digits).replace(".", ",") : "0";

export function installResourcePerformanceDebugPanel(): void {
  const mainPanel = document.querySelector<HTMLElement>("#debug-panel");
  const performancePanel = document.querySelector<HTMLElement>("#performance-debug");
  if (!mainPanel || !performancePanel) return;

  const container = document.createElement("section");
  container.id = "resource-performance-debug";
  container.className = "perf-section";
  performancePanel.insertAdjacentElement("afterend", container);

  const refresh = () => {
    if (mainPanel.hidden) return;
    const metrics = resourcePerformanceSnapshot();
    const retirement = metrics.find((metric) => metric.key === "resourceRetirement")!;
    const blocking = metrics.find((metric) => metric.key === "resourceBlockingSync")!;
    container.innerHTML = `
      <div class="perf-section-title">
        <strong>Ressourcen · Detailmessung</strong>
        <small>Eigenes 10-s-Fenster für Retirement und resourceBlocking-Synchronisierung</small>
      </div>
      <div class="perf-table-wrap"><table class="perf-table">
        <thead><tr><th>Feature</th><th>ms/s</th><th>Ø ms</th><th>p95</th><th>Aufr./s</th></tr></thead>
        <tbody>
          <tr><td>Resource retirement</td><td>${format(retirement.msPerSecond)}</td><td>${format(retirement.average, 3)}</td><td>${format(retirement.p95, 3)}</td><td>${format(retirement.callsPerSecond, 0)}</td></tr>
          <tr><td>Resource blocking sync</td><td>${format(blocking.msPerSecond)}</td><td>${format(blocking.average, 3)}</td><td>${format(blocking.p95, 3)}</td><td>${format(blocking.callsPerSecond, 0)}</td></tr>
        </tbody>
      </table></div>`;
  };

  refresh();
  window.setInterval(refresh, 250);
}
