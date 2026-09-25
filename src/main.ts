import {
  installGlobalCrashReporter,
  markRuntimePhase,
  reportRuntimeCrash,
} from "./runtime/crashReporter";
import "./style.css";
import "./map-interaction.css";
import "./build-placement.css";
import "./build-menu.css";
import "./handbook.css";
import "./person-panel.css";
import "./person-context-menu.css";
import "./building-panel.css";
import "./performance-debug.css";
import "./performance-recording.css";
import "./technology-tree.css";
import "./modal-dialog.css";
import "./game-menu.css";
import "./light-theme.css";

installGlobalCrashReporter();
markRuntimePhase("module-load");

void import("./bootstrap")
  .then(({ bootstrapGame }) => bootstrapGame())
  .catch((error) => {
    reportRuntimeCrash(error, "startup");
  });
