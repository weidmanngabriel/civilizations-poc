import type { BuildingId, Role, World } from "../simulation/model";
import {
  assigned,
  building,
  changeAssignment,
  changePopulation,
  freePeople,
  GOODS,
  status,
  tick,
} from "../simulation/simulation";
import { CONFIG } from "../simulation/scenario";
import { same } from "../simulation/hex";

export function mountControls(w: World, renderMap: () => void): void {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `<main><header><div><p class="eyebrow">DAS ACHTE WELTWUNDER / POC 01</p><h1>Ein Dorf kommt in Gang.</h1><p class="intro">Verteile die Menschen. Verbinde die Wirtschaft. Eine Runde nach der anderen.</p></div><span class="badge">Produktionslogistik</span></header><section class="toolbar"><div id="metrics"></div><div class="round-controls"><button id="next" class="primary">Nächste Runde <span aria-hidden="true">→</span></button><button id="autoplay" aria-pressed="false">Autolauf starten</button><label class="speed-control">Rundendauer<select id="round-duration" aria-label="Rundendauer"><option value="500">0,5 s</option><option value="1000" selected>1,0 s</option><option value="1500">1,5 s</option><option value="2000">2,0 s</option><option value="2500">2,5 s</option><option value="3000">3,0 s</option></select></label></div></section><section class="map-panel"><div class="map-heading"><span>Das erste Dorf</span><span>Wald → Sägewerk → Schreinerei → Lager</span></div><div id="game" role="img" aria-label="Hex-Karte mit Hauptquartier, Wald, Sägewerk, Schreinerei und Lager. Personen bewegen sich nur auf Wegen und Gebäuden."></div><div class="legend"><span><i class="worker"></i> Arbeiter</span><span><i class="carrier"></i> Träger</span><span><i class="free"></i> Frei</span><span>Fracht: H Holz · B Brett · W Werkzeug</span><span>Ressourcen-Slots zeigen Bestand und Kapazität direkt an Produktionsstätten.</span><span>Wiese, Berg und Fluss sind gesperrt.</span></div></section><section class="population"><div><strong>Bevölkerung</strong><small>Debug · Entfernen nur bei freien Personen am HQ</small></div><div class="stepper"><button id="population-minus" aria-label="Bevölkerung verringern">−</button><output id="population-count"></output><button id="population-plus" aria-label="Bevölkerung erhöhen">+</button></div></section><section class="section-title"><h2>Arbeitsstätten</h2><p>Besetzung: zugewiesen / Maximum · aktiv nach Ankunft</p></section><div id="buildings" class="cards"></div><p class="hint">Zum Start: 2 Arbeiter im Wald, je 1 im Sägewerk und in der Schreinerei, dazu mindestens 1 Träger im Lager. Alle acht Menschen starten frei am HQ.</p><details><summary>Personen und Transportaufträge</summary><div id="people"></div></details><footer>PoC 1 · Jede Wegkante kostet eine Runde. Produktion benötigt fünf Arbeitsrunden.</footer></main>`;

  let autoplayTimer: number | undefined;

  const refresh = () => {
    document.querySelector("#metrics")!.innerHTML =
      `<div><small>RUNDE</small><strong>${w.round}</strong></div><div><small>BEVÖLKERUNG</small><strong>${w.people.length}</strong></div><div><small>FREI</small><strong>${freePeople(w).length}</strong></div><div><small>WERKZEUGE IM LAGER</small><strong>${building(w, "warehouse").output}</strong></div>`;
    document.querySelector("#population-count")!.textContent = String(
      w.people.length,
    );
    (
      document.querySelector("#population-minus") as HTMLButtonElement
    ).disabled = !freePeople(w).some((p) =>
      same(p.position, building(w, "hq").position),
    );
    document.querySelector("#buildings")!.innerHTML = w.buildings
      .filter((b) => b.id !== "hq")
      .map((b, index) => {
        const controls = (role: Role, limit: number) =>
          limit
            ? `<div class="assignment"><div>${role === "worker" ? "Arbeiter" : "Träger"}<small>${assigned(w, b.id, role).filter((p) => p.active).length} aktiv</small></div><div class="stepper"><button data-building="${b.id}" data-role="${role}" data-delta="-1" aria-label="${b.name}: ${role === "worker" ? "Arbeiter" : "Träger"} verringern" ${assigned(w, b.id, role).length ? "" : "disabled"}>−</button><output>${assigned(w, b.id, role).length}/${limit}</output><button data-building="${b.id}" data-role="${role}" data-delta="1" aria-label="${b.name}: ${role === "worker" ? "Arbeiter" : "Träger"} erhöhen" ${assigned(w, b.id, role).length < limit && freePeople(w).length ? "" : "disabled"}>+</button></div></div>`
            : "";
        return `<article><div class="card-title"><span class="index">0${index + 1}</span><h3>${b.name}</h3></div><p class="recipe">${b.recipe?.input ? `2 ${GOODS[b.recipe.input]} → 1 ${GOODS[b.recipe.output]}` : b.recipe ? "1 Holz je Arbeiter / 5 Runden" : "Sammelt fertige Holzwerkzeuge"}</p>${controls("worker", b.workers)}${controls("carrier", b.carriers)}<div class="inventory">${b.recipe?.input ? `<div><span>${GOODS[b.recipe.input]} · Input</span><strong>${b.input}/${CONFIG.inputCapacity}</strong></div>` : ""}<div><span>${b.recipe ? GOODS[b.recipe.output] : "Holzwerkzeuge"} · ${b.recipe ? "Output" : "Bestand"}</span><strong>${b.output}/${b.recipe ? CONFIG.outputCapacity : "∞"}</strong></div></div><p class="status">${status(w, b)}</p></article>`;
      })
      .join("");
    document.querySelector("#people")!.innerHTML =
      `<table><thead><tr><th>Person</th><th>Zuweisung</th><th>Zustand / Fracht</th></tr></thead><tbody>${w.people.map((p) => `<tr><td>${p.id}</td><td>${p.assignment ? `${building(w, p.assignment.building).name} · ${p.assignment.role === "worker" ? "Arbeiter" : "Träger"}` : "Frei"}</td><td>${p.trip ? `${p.trip.picked ? "Bringt" : "Holt"} ${GOODS[p.trip.good]} · ${building(w, p.trip.picked ? p.trip.target : p.trip.source).name}` : p.progress ? `Produziert · ${p.progress}/5` : p.path.length ? (p.assignment ? "Auf dem Weg zur Arbeitsstätte" : "Auf dem Rückweg zum HQ") : p.assignment ? "An der Arbeitsstätte" : "Am HQ"}</td></tr>`).join("")}</tbody></table>`;
    renderMap();
  };

  const runRound = () => {
    tick(w);
    refresh();
  };

  const autoplayButton = document.querySelector(
    "#autoplay",
  ) as HTMLButtonElement;
  const durationSelect = document.querySelector(
    "#round-duration",
  ) as HTMLSelectElement;

  const stopAutoplay = () => {
    if (autoplayTimer !== undefined) window.clearInterval(autoplayTimer);
    autoplayTimer = undefined;
    autoplayButton.textContent = "Autolauf starten";
    autoplayButton.setAttribute("aria-pressed", "false");
  };

  const startAutoplay = () => {
    stopAutoplay();
    autoplayTimer = window.setInterval(runRound, Number(durationSelect.value));
    autoplayButton.textContent = "Autolauf pausieren";
    autoplayButton.setAttribute("aria-pressed", "true");
  };

  document.querySelector("#next")!.addEventListener("click", runRound);
  autoplayButton.addEventListener("click", () => {
    if (autoplayTimer === undefined) startAutoplay();
    else stopAutoplay();
  });
  durationSelect.addEventListener("change", () => {
    if (autoplayTimer !== undefined) startAutoplay();
  });

  for (const delta of [-1, 1] as const)
    document
      .querySelector(delta === 1 ? "#population-plus" : "#population-minus")!
      .addEventListener("click", () => {
        changePopulation(w, delta);
        refresh();
      });
  document.querySelector("#buildings")!.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      "button[data-building]",
    );
    if (!button || button.disabled) return;
    const { building: id, role, delta } = button.dataset;
    changeAssignment(
      w,
      id as BuildingId,
      role as Role,
      Number(delta) as 1 | -1,
    );
    refresh();
  });
  refresh();
}
