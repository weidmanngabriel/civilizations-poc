export const RUNTIME_CRASH_EVENT = "poc-runtime-crash";

type CrashContext = Record<string, unknown>;

type CrashReport = {
  format: "civilizations-poc-crash-report";
  version: 1;
  crashedAt: string;
  buildTime: string;
  source: string;
  phase: string;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  browser: {
    userAgent: string;
    language: string;
    viewport: { width: number; height: number };
    devicePixelRatio: number;
  };
  url: string;
  context?: CrashContext;
};

let phase = "entry";
let crashed = false;
let contextProvider: (() => CrashContext) | undefined;
let lastReport: CrashReport | undefined;

const normalizedError = (value: unknown): Error => {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
};

const safeContext = (): CrashContext | undefined => {
  if (!contextProvider) return;
  try {
    return contextProvider();
  } catch (error) {
    const normalized = normalizedError(error);
    return {
      contextError: {
        name: normalized.name,
        message: normalized.message,
        stack: normalized.stack,
      },
    };
  }
};

const createReport = (error: unknown, source: string): CrashReport => {
  const normalized = normalizedError(error);
  return {
    format: "civilizations-poc-crash-report",
    version: 1,
    crashedAt: new Date().toISOString(),
    buildTime: process.env.BUILD_TIME ?? "",
    source,
    phase,
    error: {
      name: normalized.name,
      message: normalized.message,
      ...(normalized.stack ? { stack: normalized.stack } : {}),
    },
    browser: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      devicePixelRatio: window.devicePixelRatio,
    },
    url: window.location.href,
    context: safeContext(),
  };
};

const downloadReport = (report: CrashReport): void => {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `civilizations-crash-${report.crashedAt.replace(/[:.]/g, "-")}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const showCrashScreen = (report: CrashReport): void => {
  document.documentElement.dataset.gameCrashed = "true";
  delete document.documentElement.dataset.gameReady;

  const existing = document.getElementById("runtime-crash-screen");
  if (existing) existing.remove();

  const screen = document.createElement("section");
  screen.id = "runtime-crash-screen";
  screen.setAttribute("role", "alert");
  Object.assign(screen.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    background: "#f5f2e9",
    color: "#202820",
    fontFamily: "system-ui, sans-serif",
  });

  const card = document.createElement("div");
  Object.assign(card.style, {
    width: "min(680px, 100%)",
    border: "1px solid #b9b4a8",
    borderRadius: "12px",
    background: "#ffffff",
    padding: "22px",
  });

  const title = document.createElement("h1");
  title.textContent = "Das Spiel wurde angehalten";
  title.style.marginTop = "0";

  const explanation = document.createElement("p");
  explanation.textContent =
    "Ein unerwarteter Fehler ist aufgetreten. Die Simulation wurde gestoppt, damit kein halb funktionierender Spielzustand weiterläuft.";

  const detail = document.createElement("pre");
  detail.textContent = `${report.error.name}: ${report.error.message}\nPhase: ${report.phase}`;
  Object.assign(detail.style, {
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    padding: "12px",
    background: "#f3f3ef",
    borderRadius: "8px",
  });

  const actions = document.createElement("div");
  Object.assign(actions.style, { display: "flex", gap: "10px", flexWrap: "wrap" });

  const download = document.createElement("button");
  download.type = "button";
  download.textContent = "Crash-Report herunterladen";
  download.addEventListener("click", () => downloadReport(report));

  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "Neu laden";
  reload.addEventListener("click", () => window.location.reload());

  actions.append(download, reload);
  card.append(title, explanation, detail, actions);
  screen.append(card);
  document.body.append(screen);
};

export const setCrashContextProvider = (provider: () => CrashContext): void => {
  contextProvider = provider;
};

export const markRuntimePhase = (nextPhase: string): void => {
  phase = nextPhase;
};

export const hasRuntimeCrashed = (): boolean => crashed;

export const reportRuntimeCrash = (error: unknown, source = "runtime"): CrashReport => {
  if (lastReport) return lastReport;
  crashed = true;
  lastReport = createReport(error, source);
  window.dispatchEvent(new CustomEvent(RUNTIME_CRASH_EVENT, { detail: lastReport }));
  showCrashScreen(lastReport);
  return lastReport;
};

export const installGlobalCrashReporter = (): void => {
  window.addEventListener("error", (event) => {
    reportRuntimeCrash(event.error ?? event.message, "window.error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportRuntimeCrash(event.reason, "unhandledrejection");
  });
};
