import type { World } from "../simulation/model";
import { performanceProfiler } from "../debug/performanceProfiler";
import {
  capturePerformanceRecordingSample,
  downloadPerformanceRecording,
  finishPerformanceRecording,
  isPerformanceRecording,
  performanceRecordingElapsedMs,
  startPerformanceRecording,
} from "../debug/performanceRecording";

const formatDuration = (milliseconds: number): string => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

export function installPerformanceRecordingControls(world: World): void {
  const panel = document.querySelector<HTMLElement>("#debug-panel");
  const header = panel?.querySelector<HTMLElement>(".debug-header");
  const cheatControls = panel?.querySelector<HTMLElement>(".debug-cheat-controls");
  if (!panel || !header || !cheatControls || document.querySelector("#performance-recording")) return;

  const recorder = document.createElement("section");
  recorder.id = "performance-recording";
  recorder.className = "perf-recorder";
  recorder.innerHTML = `
    <div>
      <strong>Performance-Aufnahme</strong>
      <span data-perf-recording-status>Bereit · 1 Snapshot/s</span>
    </div>
    <button type="button" data-perf-recording-toggle>Tracking starten</button>`;
  cheatControls.insertAdjacentElement("afterend", recorder);

  const button = recorder.querySelector<HTMLButtonElement>("[data-perf-recording-toggle]")!;
  const status = recorder.querySelector<HTMLElement>("[data-perf-recording-status]")!;

  const refreshState = () => {
    if (!isPerformanceRecording()) {
      button.textContent = "Tracking starten";
      button.classList.remove("danger");
      status.textContent = "Bereit · 1 Snapshot/s";
      return;
    }

    button.textContent = "Tracking beenden & herunterladen";
    button.classList.add("danger");
    status.textContent = `Aufnahme läuft · ${formatDuration(performanceRecordingElapsedMs())}`;
  };

  button.addEventListener("click", () => {
    if (!isPerformanceRecording()) {
      startPerformanceRecording();
      capturePerformanceRecordingSample(world, performanceProfiler.snapshot());
      refreshState();
      return;
    }

    capturePerformanceRecordingSample(world, performanceProfiler.snapshot());
    const data = finishPerformanceRecording();
    if (data) downloadPerformanceRecording(data);
    refreshState();
  });

  window.setInterval(() => {
    if (!isPerformanceRecording()) return;
    capturePerformanceRecordingSample(world, performanceProfiler.snapshot());
    refreshState();
  }, 1000);

  refreshState();
}
