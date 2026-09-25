import Phaser from "phaser";
import { performanceNow, performanceProfiler } from "./debug/performanceProfiler";
import { IncrementalMainScene } from "./game/IncrementalMainScene";
import { installBuildPlacementHighlights } from "./game/buildPlacementHighlights";
import { installBuildingAttentionIndicators } from "./game/buildingAttentionIndicators";
import { installBuildingSprites } from "./game/buildingSprites";
import { installFishingIndicators } from "./game/fishingIndicators";
import { installFishSchoolIndicators } from "./game/fishSchoolIndicators";
import { installWildlifeIndicators } from "./game/wildlifeIndicators";
import { installBushIndicators } from "./game/bushIndicators";
import { installDesktopBuildPlacement } from "./game/desktopBuildPlacement";
import { installHungerIndicators } from "./game/hungerIndicators";
import { installLooseGoodsIndicators } from "./game/looseGoodsIndicators";
import { installNaturalResourceIndicators } from "./game/naturalResourceIndicators";
import { installPersonSelection } from "./game/personSelection";
import { installPersonCommandInteraction } from "./game/personCommandInteraction";
import { installNavigationBlockedIndicators } from "./game/navigationBlockedIndicators";
import { installSleepIndicators } from "./game/sleepIndicators";
import { installWorkAreaInteraction } from "./game/workAreaInteraction";
import { installWaypostIndicators } from "./game/waypostIndicators";
import {
  installMobileMapTouchControls,
  preventMobilePageZoom,
} from "./game/mobileTouch";
import { installPwaSupport } from "./pwa";
import {
  RUNTIME_CRASH_EVENT,
  hasRuntimeCrashed,
  markRuntimePhase,
  setCrashContextProvider,
} from "./runtime/crashReporter";
import { validateStartupConfiguration } from "./runtime/startupValidation";
import { createDefaultGameWorld } from "./simulation/scenario";
import { serializeSaveGame } from "./simulation/saveGame";
import { installTileSelectionGuard, mountBuildMenu } from "./ui/buildMenu";
import { mountControls } from "./ui/controls";
import { installActionModeVisibility } from "./ui/actionMode";
import { mountGameMenu } from "./ui/gameMenu";
import { mountBuildingPanel } from "./ui/buildingPanel";
import { mountHandbook } from "./ui/handbook";
import { installHqStoragePanel } from "./ui/hqStoragePanel";
import { mountPersonPanel } from "./ui/personPanel";
import { mountPersonContextMenu } from "./ui/personContextMenu";
import { installPerformanceDebugPanel } from "./ui/performanceDebug";
import { installPerformanceRecordingControls } from "./ui/performanceRecordingControls";
import { installResourcePerformanceDebugPanel } from "./ui/resourcePerformanceDebug";
import { mountTechnologyTree } from "./ui/technologyTree";
import { applyTechnologyTreeLayout } from "./ui/technologyTreeLayout";

const preventPageZoom = (): void => {
  document.addEventListener(
    "wheel",
    (event) => {
      if (event.ctrlKey) event.preventDefault();
    },
    { passive: false },
  );

  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (["+", "=", "-", "0"].includes(event.key)) event.preventDefault();
  });

  preventMobilePageZoom();
};

const showBuildVersion = (): void => {
  const versionLabel = document.querySelector<HTMLElement>("#build-version");
  if (!versionLabel) return;

  const buildDate = new Date(process.env.BUILD_TIME ?? "");
  if (Number.isNaN(buildDate.getTime())) return;

  const version = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(buildDate);

  versionLabel.textContent = `POC 01 · ${version}`;
};

const waitForRenderer = (
  firstRender: Promise<void>,
  timeoutMs = 5000,
): Promise<void> =>
  Promise.race([
    firstRender,
    new Promise<void>((_, reject) =>
      window.setTimeout(
        () => reject(new Error("Phaser-Renderer wurde nicht rechtzeitig bereit.")),
        timeoutMs,
      ),
    ),
  ]);

export async function bootstrapGame(): Promise<void> {
  markRuntimePhase("browser-setup");
  preventPageZoom();
  installPwaSupport();

  const sampleAnimationFrames = (timestamp: number): void => {
    if (hasRuntimeCrashed()) return;
    performanceProfiler.recordAnimationFrame(timestamp, performanceNow());
    window.requestAnimationFrame(sampleAnimationFrames);
  };
  window.requestAnimationFrame(sampleAnimationFrames);

  markRuntimePhase("world-create");
  const world = createDefaultGameWorld();
  setCrashContextProvider(() => {
    let saveGame: unknown;
    try {
      saveGame = JSON.parse(serializeSaveGame(world));
    } catch (error) {
      saveGame = {
        serializationError: error instanceof Error ? error.message : String(error),
      };
    }
    return {
      worldSummary: {
        round: world.round,
        population: world.people.length,
        buildings: world.buildings.length,
        households: world.households?.length ?? 0,
        simulationSpeed: world.simulationSpeed,
      },
      saveGame,
    };
  });

  markRuntimePhase("startup-validation");
  validateStartupConfiguration(world);

  markRuntimePhase("scene-create");
  const scene = new IncrementalMainScene(world);
  const rawRenderWorld = scene.renderWorld.bind(scene);
  let renderFrame: number | undefined;
  let firstRenderSettled = false;
  let resolveFirstRender!: () => void;
  let rejectFirstRender!: (error: unknown) => void;
  const firstRender = new Promise<void>((resolve, reject) => {
    resolveFirstRender = resolve;
    rejectFirstRender = reject;
  });

  scene.renderWorld = () => {
    if (renderFrame !== undefined || hasRuntimeCrashed()) return;
    renderFrame = window.requestAnimationFrame(() => {
      renderFrame = undefined;
      const started = performanceNow();
      try {
        rawRenderWorld();
        if (!firstRenderSettled && scene.sys.isActive()) {
          firstRenderSettled = true;
          resolveFirstRender();
        }
      } catch (error) {
        if (!firstRenderSettled) {
          firstRenderSettled = true;
          rejectFirstRender(error);
        }
        throw error;
      } finally {
        performanceProfiler.recordRender(performanceNow() - started);
      }
    });
  };

  installBushIndicators(scene, world);
  installNaturalResourceIndicators(scene, world);
  installLooseGoodsIndicators(scene, world);
  installBuildPlacementHighlights(scene, world);
  installBuildingSprites(scene, world);
  installBuildingAttentionIndicators(scene, world);
  installFishingIndicators(scene, world);
  installFishSchoolIndicators(scene, world);
  installWildlifeIndicators(scene, world);
  installHungerIndicators(scene, world);
  installSleepIndicators(scene, world);
  installPersonSelection(scene, world);
  installNavigationBlockedIndicators(scene, world);
  installWorkAreaInteraction(scene, world);
  installPersonCommandInteraction(scene, world);
  installWaypostIndicators(scene, world);
  installTileSelectionGuard();

  markRuntimePhase("controls-mount");
  mountControls(world, () => scene.renderWorld());

  let game: Phaser.Game | undefined;
  window.addEventListener(
    RUNTIME_CRASH_EVENT,
    () => {
      if (renderFrame !== undefined) window.cancelAnimationFrame(renderFrame);
      renderFrame = undefined;
      game?.destroy(true);
    },
    { once: true },
  );

  markRuntimePhase("phaser-create");
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    backgroundColor: "#304d35",
    scene: [scene],
    input: { activePointers: 3 },
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: window.innerWidth,
      height: window.innerHeight,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: { antialias: true },
  });

  let phaserStepStartedAt: number | undefined;
  let phaserRenderStartedAt: number | undefined;
  let previousPhaserPostRenderAt: number | undefined;

  game.events.on(Phaser.Core.Events.PRE_STEP, () => {
    const current = performanceNow();
    if (previousPhaserPostRenderAt !== undefined)
      performanceProfiler.recordPhaserInterFrameGap(
        Math.max(0, current - previousPhaserPostRenderAt),
        current,
      );
    phaserStepStartedAt = current;
  });

  game.events.on(Phaser.Core.Events.PRE_RENDER, () => {
    phaserRenderStartedAt = performanceNow();
  });

  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    const current = performanceNow();
    if (phaserRenderStartedAt !== undefined)
      performanceProfiler.recordPhaserRender(
        Math.max(0, current - phaserRenderStartedAt),
        current,
      );
    if (phaserStepStartedAt !== undefined)
      performanceProfiler.recordPhaserStep(
        Math.max(0, current - phaserStepStartedAt),
        current,
      );
    previousPhaserPostRenderAt = current;
    phaserStepStartedAt = undefined;
    phaserRenderStartedAt = undefined;
  });

  installMobileMapTouchControls(game, scene);
  installDesktopBuildPlacement(game, scene);

  markRuntimePhase("renderer-first-frame");
  scene.renderWorld();
  await waitForRenderer(firstRender);

  markRuntimePhase("ui-mount");
  installActionModeVisibility();
  installPerformanceDebugPanel(world);
  installPerformanceRecordingControls(world);
  installResourcePerformanceDebugPanel();
  installHqStoragePanel(world);
  mountBuildMenu(world);
  mountHandbook();
  mountGameMenu(world, () => scene.renderWorld(), () => scene.captureSettlementThumbnail());
  mountPersonPanel(world);
  mountPersonContextMenu(world);
  mountBuildingPanel(world);
  mountTechnologyTree(world);
  applyTechnologyTreeLayout();
  showBuildVersion();

  markRuntimePhase("ready");
  document.documentElement.dataset.gameReady = "true";
}
