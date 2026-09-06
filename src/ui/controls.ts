import type { BuildingId, Role, World } from "../simulation/model";
import {
  assigned,
  building,
  changeAssignment,
  changePopulation,
  changeWoodcutters,
  freePeople,
  GOODS,
  status,
  tick,
  woodcutters,
} from "../simulation/simulation";
import { CONFIG } from "../simulation/scenario";
import { same } from "../simulation/hex";

export function mountControls(w: World, renderMap: () => void): void {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `<main><header><div><p class="eyebrow">DAS ACHTE WELTWUNDER / POC 01</p><h1>Ein Dorf kommt in Gang.</h1><p class="intro">Verteile die Menschen. Verbinde die Wirtschaft. Eine Runde nach der anderen.</p></div><span class="badge">Produktionslogistik</span></header><section class="toolbar"><div id="metrics"></div><div class="round-controls"><button id="next" class="primary">Nächste Runde <span aria-hidden="true">→</span></button><button id="autoplay" aria-pressed="false">Autolauf starten</button><label class="speed-control">Geschwindigkeit <input id="fps" type="range" min="1" max="10" step="1" value="1" aria-label="Autolauf in Runden pro Sekunde"><output id="fps-value">1 FPS</output></label><button id="max-fps" aria-pressed="false">Max FPS</button></div></section><section class="map-panel"><div class="map-heading"><span>Das erste Dorf</span><span>Wald → Sägewerk → Schreinerei → Lager</span></div><div id="game" role="img" aria-label="Große Hex-Karte mit Hauptquartier, Waldflächen, Sägewerk, Schreinerei und Lager. Personen bewegen sich auf Wegen, Wald- und Gebäudefeldern."></div><div class="legend"><span><i class="worker"></i> Arbeiter / Holzfäller</span><span><i class="carrier"></i> Träger</span><span><i class="free"></i> Frei</span><span>Fracht: H Holz · B Brett · W Werkzeug</span><span>Jeder Wald liefert 10 Holz und verblasst mit sinkendem Vorrat.</span><span>Wiese, Berg und Fluss sind gesperrt.</span></div></section><section class="population"><div><strong>Bevölkerung</strong><small>Debug · Entfernen nur bei freien Personen am HQ</small></div><div class="stepper"><button id="population-minus" aria-label="Bevölkerung verringern">−</button><output id="population-count"></output><button id="population-plus" aria-label="Bevölkerung erhöhen">+</button></div></section><section class="population"><div><strong>Holzfäller</strong><small>Jeder sucht einen eigenen freien Wald</small></div><div class="stepper"><button id="woodcutter-minus" aria-label="Holzfäller verringern">−</button><output id="woodcutter-count"></output><button id="woodcutter-plus" aria-label="Holzfäller erhöhen">+</button></div></section><section class="section-title"><h2>Arbeitsstätten</h2><p>Besetzung: zugewiesen / Maximum · aktiv nach Ankunft</p></section><div id="buildings" class="cards"></div><p class="hint">Zum Start gibt es keinen aktiven Wald. Ernenne Holzfäller; jeder sucht automatisch einen eigenen Waldstandort. Erschöpfte Wälder verschwinden sofort, Restholz bleibt liegen.</p><details><summary>Personen und Transportaufträge</summary><div id="people"></div></details><footer>PoC 1 · Jede Wegkante kostet eine Runde. Produktion benötigt fünf Arbeitsrunden.</footer></main>`;

  let autoplayTimer: number | undefined;
  let autoplayFrame: number | undefined;

  const refresh = () => {
    document.querySelector("#metrics")!.innerHTML =
      `<div><small>RUNDE</small><strong>${w.round}</strong></div><div><small>BEVÖLKERUNG</small><strong>${w.people.length}</strong></div><div><small>FREI</small><strong>${freePeople(w).length}</strong></div><div><small>WERKZEUGE IM LAGER</small><strong>${building(w, "warehouse").output}</strong></div>`;
    document.querySelector("#population-count")!.textContent = String(w.people.length);
    document.querySelector("#woodcutter-count")!.textContent = String(woodcutters(w).length);
    (document.querySelector("#population-minus") as HTMLButtonElement).disabled = !freePeople(w).some((p) =>
      same(p.position, building(w, "hq").position),
    );
    (document.querySelector("#woodcutter-minus") as HTMLButtonElement).disabled = woodcutters(w).length === 0;
    (document.querySelector("#woodcutter-plus") as HTMLButtonElement).disabled = freePeople(w).length === 0;
    document.querySelector("#buildings")!.innerHTML = w.buildings
      .filter((b) => b.id !== "hq" && !b.retired)
      .map((b, index) => {
        const controls = (role: Role, limit: number) =>
          b.forestRemaining !== undefined
            ? ""
            : limit
              ? `<div class="assignment"><div>${role === "worker" ? "Arbeiter" : "Träger"}<small>${assigned(w, b.id, role).filter((p) => p.active).length} aktiv</small></div><div class="stepper"><button data-building="${b.id}" data-role="${role}" data-delta="-1" aria-label="${b.name}: ${role === "worker" ? "Arbeiter" : "Träger"} verringern" ${assigned(w, b.id, role).length ? "" : "disabled"}>−</button><output>${assigned(w, b.id, role).length}/${limit}</output><button data-building="${b.id}" data-role="${role}" data-delta="1" aria-label="${b.name}: ${role === "worker" ? "Arbeiter" : "Träger"} erhöhen" ${assigned(w, b.id, role).length < limit && freePeople(w).length ? "" : "disabled"}>+</button></div></div>`
              : "";
        const recipe = b.forestRemaining !== undefined
          ? `1 Holz / 5 Runden · Vorrat ${b.forestRemaining}/${CONFIG.forestYield}`
          : b.recipe?.input
            ? `2 ${GOODS[b.recipe.input]} → 1 ${GOODS[b.recipe.output]}`
            : b.recipe
              ? "Produktion"
              : "Sammelt fertige Holzwerkzeuge";
        return `<article><div class="card-title"><span class="index">${String(index + 1).padStart(2, "0")}</span><h3>${b.name}</h3></div><p class="recipe">${recipe}</p>${controls("worker", b.workers)}${controls("carrier", b.carriers)}<div class="inventory">${b.recipe?.input ? `<div><span>${GOODS[b.recipe.input]} · Input</span><strong>${b.input}/${CONFIG.inputCapacity}</strong></div>` : ""}<div><span>${b.recipe ? GOODS[b.recipe.output] : "Holzwerkzeuge"} · ${b.recipe ? "Output" : "Bestand"}</span><strong>${b.output}/${b.recipe ? CONFIG.outputCapacity : "∞"}</strong></div></div><p class="status">${status(w, b)}</p></article>`;
      })
      .join("");
    document.querySelector("#people")!.innerHTML =
      `<table><thead><tr><th>Person</th><th>Zuweisung</th><th>Zustand / Fracht</th></tr></thead><tbody>${w.people.map((p) => `<tr><td>${p.id}</td><td>${p.woodcutter ? (p.assignment ? `Holzfäller · ${building(w, p.assignment.building).name}` : "Holzfäller · wartet auf Wald") : p.assignment ? `${building(w, p.assignment.building).name} · ${p.assignment.role === "worker" ? "Arbeiter" : "Träger"}` : "Frei"}</td><td>${p.trip ? `${p.trip.picked ? "Bringt" : "Holt"} ${GOODS[p.trip.good]} · ${building(w, p.trip.picked ? p.trip.target : p.trip.source).name}` : p.progress ? `${p.woodcutter ? "Fällt Holz" : "Produziert"} · ${p.progress}/5` : p.path.length ? (p.assignment ? "Auf dem Weg zur Arbeitsstätte" : p.woodcutter ? "Sucht / wartet auf Wald" : "Auf dem Rückweg zum HQ") : p.assignment ? "An der Arbeitsstätte" : p.woodcutter ? "Wartet auf Wald" : "Am HQ"}</td></tr>`).join("")}</tbody></table>`;
    renderMap();
  };

  const runRound = () => {
    tick(w);
    refresh();
  };

  const autoplayButton = document.querySelector("#autoplay") as HTMLButtonElement;
  const fpsInput = document.querySelector("#fps") as HTMLInputElement;
  const fpsValue = document.querySelector("#fps-value") as HTMLOutputElement;
  const maxFpsButton = document.querySelector("#max-fps") as HTMLButtonElement;

  const isRunning = () => autoplayTimer !== undefined || autoplayFrame !== undefined;

  const stopAutoplay = () => {
    if (autoplayTimer !== undefined) window.clearInterval(autoplayTimer);
    if (autoplayFrame !== undefined) window.cancelAnimationFrame(autoplayFrame);
    autoplayTimer = undefined;
    autoplayFrame = undefined;
    autoplayButton.textContent = "Autolauf starten";
    autoplayButton.setAttribute("aria-pressed", "false");
  };

  const startAutoplay = () => {
    stopAutoplay();
    if (maxFpsButton.getAttribute("aria-pressed") === "true") {
      const frame = () => {
        runRound();
        autoplayFrame = window.requestAnimationFrame(frame);
      };
      autoplayFrame = window.requestAnimationFrame(frame);
    } else {
      autoplayTimer = window.setInterval(runRound, 1000 / Number(fpsInput.value));
    }
    autoplayButton.textContent = "Autolauf pausieren";
    autoplayButton.setAttribute("aria-pressed", "true");
  };

  const updateFps = () => {
    if (maxFpsButton.getAttribute("aria-pressed") !== "true")
      fpsValue.value = `${fpsInput.value} FPS`;
    if (isRunning()) startAutoplay();
  };

  document.querySelector("#next")!.addEventListener("click", runRound);
  autoplayButton.addEventListener("click", () => {
    if (!isRunning()) startAutoplay();
    else stopAutoplay();
  });
  fpsInput.addEventListener("input", updateFps);
  maxFpsButton.addEventListener("click", () => {
    const wasRunning = isRunning();
    const enabled = maxFpsButton.getAttribute("aria-pressed") !== "true";
    maxFpsButton.setAttribute("aria-pressed", String(enabled));
    fpsInput.disabled = enabled;
    fpsValue.value = enabled ? "MAX" : `${fpsInput.value} FPS`;
    if (wasRunning) startAutoplay();
  });

  for (const delta of [-1, 1] as const)
    document
      .querySelector(delta === 1 ? "#population-plus" : "#population-minus")!
      .addEventListener("click", () => {
        changePopulation(w, delta);
        refresh();
      });
  for (const delta of [-1, 1] as const)
    document
      .querySelector(delta === 1 ? "#woodcutter-plus" : "#woodcutter-minus")!
      .addEventListener("click", () => {
        changeWoodcutters(w, delta);
        refresh();
      });
  document.querySelector("#buildings")!.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-building]");
    if (!button || button.disabled) return;
    const { building: id, role, delta } = button.dataset;
    changeAssignment(w, id as BuildingId, role as Role, Number(delta) as 1 | -1);
    refresh();
  });
  refresh();
}
