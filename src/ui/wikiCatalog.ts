import type {
  AnimalKind,
  BuildableBuildingKind,
  Good,
  GoodAmounts,
  Profession,
} from "../simulation/model";
import { GOODS, buildingKindDefinition } from "../simulation/simulation";
import { BUILDING_CONSTRUCTION_REQUIREMENTS } from "../simulation/constructionRules";
import { BUILDING_UPGRADE_RULES } from "../simulation/buildingUpgradeRules";
import { PROFESSION_LABELS, PROFESSION_XP_REQUIREMENTS } from "../simulation/experience";
import { TECHNOLOGY_UNLOCK_RULES } from "../simulation/technology";
import { GOOD_ICONS, buildingIcon } from "../icons";
import { BUILDING_WIKI_LABELS, type WikiBuildingKind } from "./wikiLinks";

export const WIKI_GOODS = (Object.keys(GOODS) as Good[])
  .sort((a, b) => GOODS[a].localeCompare(GOODS[b], "de"));

const WIKI_BUILDING_KINDS: WikiBuildingKind[] = [
  "hq", "house", "farm", "sawmill", "carpenter", "mill", "bakery", "well",
  "pottery", "pottery2", "stonemason", "stonemason2", "tailor",
  "livestockBreeder", "school", "warehouse", "palisade",
];

export const WIKI_BUILDINGS: WikiBuildingKind[] = [...WIKI_BUILDING_KINDS]
  .sort((a, b) => BUILDING_WIKI_LABELS[a].localeCompare(BUILDING_WIKI_LABELS[b], "de"));

export const ANIMAL_LABELS: Record<AnimalKind, string> = {
  hare: "Hase",
  boar: "Wildschwein",
  cow: "Kuh",
  sheep: "Schaf",
};

export const ANIMAL_ICONS: Record<AnimalKind, string> = {
  hare: "🐇",
  boar: "🐗",
  cow: "🐄",
  sheep: "🐑",
};

export const WIKI_ANIMALS = (Object.keys(ANIMAL_LABELS) as AnimalKind[])
  .sort((a, b) => ANIMAL_LABELS[a].localeCompare(ANIMAL_LABELS[b], "de"));

export const WIKI_PROFESSIONS = (Object.keys(PROFESSION_LABELS) as Profession[])
  .sort((a, b) => PROFESSION_LABELS[a].localeCompare(PROFESSION_LABELS[b], "de"));

const PROFESSION_ICONS: Record<Profession, string> = {
  woodcutter: "🪓", fisher: "🎣", hunter: "🏹", scout: "🧭", builder: "🔨",
  carrier: "📦", merchant: "🧭", farmer: "🌾", sawmillWorker: "🪵",
  carpenter: "🛠️", miller: "⚙️", baker: "🍞", clayDigger: "🟤",
  stonecutter: "⛏️", potter: "🧱", stonemason: "🪨", tailor: "🧵",
  stockfarmer: "🐄",
};

const BUILDABLE = new Set<BuildableBuildingKind>([
  "farm", "sawmill", "carpenter", "mill", "bakery", "well", "pottery",
  "pottery2", "stonemason", "stonemason2", "tailor", "livestockBreeder", "school", "warehouse",
]);

const isBuildable = (kind: WikiBuildingKind): kind is BuildableBuildingKind =>
  BUILDABLE.has(kind as BuildableBuildingKind);

const sortedBuildings = (kinds: WikiBuildingKind[]): WikiBuildingKind[] =>
  [...kinds].sort((a, b) => BUILDING_WIKI_LABELS[a].localeCompare(BUILDING_WIKI_LABELS[b], "de"));

const goodButton = (good: Good): string =>
  `<button type="button" class="wiki-link wiki-chip" data-wiki-good="${good}"><span aria-hidden="true">${GOOD_ICONS[good]}</span>${GOODS[good]}</button>`;

const buildingButton = (kind: WikiBuildingKind): string =>
  `<button type="button" class="wiki-link wiki-card-link" data-wiki-building="${kind}">${buildingIcon(kind)}<span>${BUILDING_WIKI_LABELS[kind]}</span></button>`;

const professionButton = (profession: Profession): string =>
  `<button type="button" class="wiki-link wiki-chip" data-wiki-profession="${profession}"><span aria-hidden="true">${PROFESSION_ICONS[profession]}</span>${PROFESSION_LABELS[profession]}</button>`;

const animalButton = (kind: AnimalKind): string =>
  `<button type="button" class="wiki-link wiki-chip" data-wiki-animal="${kind}"><span aria-hidden="true">${ANIMAL_ICONS[kind]}</span>${ANIMAL_LABELS[kind]}</button>`;

const amountLinks = (amounts: GoodAmounts | undefined): string => {
  if (!amounts) return "—";
  const entries = (Object.entries(amounts) as [Good, number | undefined][])
    .filter((entry): entry is [Good, number] => Boolean(entry[1]))
    .sort((a, b) => GOODS[a[0]].localeCompare(GOODS[b[0]], "de"));
  return entries.length
    ? entries.map(([good, amount]) => `${amount} × ${goodButton(good)}`).join(" ")
    : "—";
};

const recipeInputs = (kind: BuildableBuildingKind): GoodAmounts => {
  const recipe = buildingKindDefinition(kind).recipe;
  if (!recipe) return {};
  if (recipe.inputs) return recipe.inputs;
  return recipe.input ? { [recipe.input]: recipe.amount } : {};
};

const recipeOutputs = (kind: BuildableBuildingKind): Good[] => {
  const definition = buildingKindDefinition(kind);
  const outputs = new Set<Good>();
  if (definition.recipe?.output) outputs.add(definition.recipe.output);
  for (const recipe of definition.availableRecipes ?? []) if (recipe.output) outputs.add(recipe.output);
  if (kind === "farm") outputs.add("wheat");
  if (kind === "well") outputs.add("water");
  return [...outputs];
};

export const buildingConsumersForGood = (good: Good): WikiBuildingKind[] =>
  sortedBuildings(WIKI_BUILDINGS.filter((kind) => {
    if (!isBuildable(kind)) return false;
    return (recipeInputs(kind)[good] ?? 0) > 0 ||
      (BUILDING_CONSTRUCTION_REQUIREMENTS[kind]?.[good] ?? 0) > 0;
  }));

export const buildingProducersForGood = (good: Good): WikiBuildingKind[] =>
  sortedBuildings(WIKI_BUILDINGS.filter((kind) => isBuildable(kind) && recipeOutputs(kind).includes(good)));

const BUILDING_INTRO: Record<WikiBuildingKind, string> = {
  hq: "Zentraler Sammelpunkt und erstes Lager der Siedlung.",
  house: "Bietet Bewohnern einen festen Schlafplatz.",
  farm: "Bewirtschaftet Felder und erzeugt Weizen.",
  sawmill: "Verarbeitet Holz zu Brettern.",
  carpenter: "Verarbeitet Bretter zu Holzwerkzeugen.",
  mill: "Mahlt Weizen zu Mehl.",
  bakery: "Backt aus Mehl und Wasser Brot.",
  well: "Stellt unbegrenzt Wasser bereit.",
  pottery: "Brennt aus Lehm und Holz Backsteine.",
  pottery2: "Produziert Backsteine oder Dachziegel.",
  stonemason: "Verarbeitet Bruchstein zu Steinquadern.",
  stonemason2: "Produziert Steinquader oder Marmor.",
  tailor: "Verarbeitet Leder zu Schuhen.",
  livestockBreeder: "Hält und züchtet eingefangene Kühe und Schafe.",
  school: "Ermöglicht Bewohnern, Berufe von anderen Bewohnern zu erlernen.",
  warehouse: "Lagert Waren lokal und organisiert Träger und Händler.",
  palisade: "Blockiert nach Fertigstellung die Bewegung über ihre Kachel.",
};

const SPECIAL_BUILDING_HELP: Partial<Record<WikiBuildingKind, string>> = {
  school: "Wähle bei einem Bewohner „Beruf“, dann „Erlernen in …“, die Schule, den Zielberuf und einen passenden Lehrer. Beide gehen zur Schule; nach 60 simulierten Sekunden ist der Beruf dauerhaft erlernt.",
  livestockBreeder: "Fange Kühe oder Schafe ein und bringe sie in die Nähe der Viehzüchterei. Mit mindestens zwei erwachsenen Tieren derselben Art sowie Weizen und Wasser kann der Viehzüchter Nachwuchs erzeugen.",
  warehouse: "Träger sammeln Waren im lokalen Einzugsbereich. Händler transportieren eine ausgewählte Ware gezielt zu einem anderen Lager.",
};

const PROFESSION_INTRO: Record<Profession, string> = {
  woodcutter: "Fällt Holz in seinem Arbeitsbereich.",
  fisher: "Fängt Fisch an erreichbaren Ufern.",
  hunter: "Jagt Wild und sammelt dessen Beute ein.",
  scout: "Erkundet unabhängig vom Wegweisernetz und setzt neue Wegweiser.",
  builder: "Liefert Baustoffe und errichtet Gebäude.",
  carrier: "Sammelt und verteilt Waren für Lager und Hauptquartier.",
  merchant: "Transportiert eine gewählte Ware zwischen Lagern.",
  farmer: "Bewirtschaftet die Felder einer Farm.",
  sawmillWorker: "Verarbeitet Holz im Sägewerk zu Brettern.",
  carpenter: "Verarbeitet Bretter in der Schreinerei zu Werkzeugen.",
  miller: "Mahlt Weizen in der Mühle zu Mehl.",
  baker: "Backt in der Bäckerei Brot.",
  clayDigger: "Baut Lehm in seinem Arbeitsbereich ab.",
  stonecutter: "Baut Bruchstein in seinem Arbeitsbereich ab.",
  potter: "Produziert in Töpfereien Backsteine und Dachziegel.",
  stonemason: "Produziert in Steinmetzhütten Steinquader und Marmor.",
  tailor: "Verarbeitet Leder in der Näherei zu Schuhen.",
  stockfarmer: "Züchtet Kühe und Schafe in der Viehzüchterei.",
};

const PROFESSION_BUILDINGS: Partial<Record<Profession, WikiBuildingKind[]>> = {
  carrier: ["hq", "warehouse"],
  merchant: ["warehouse"],
  farmer: ["farm"],
  sawmillWorker: ["sawmill"],
  carpenter: ["carpenter"],
  miller: ["mill"],
  baker: ["bakery"],
  potter: ["pottery", "pottery2"],
  stonemason: ["stonemason", "stonemason2"],
  tailor: ["tailor"],
  stockfarmer: ["livestockBreeder"],
};

const buildingProfessions = (kind: WikiBuildingKind): Profession[] => {
  const professions = new Set<Profession>();
  for (const [profession, workplaces] of Object.entries(PROFESSION_BUILDINGS) as [Profession, WikiBuildingKind[] | undefined][]) {
    if (workplaces?.includes(kind)) professions.add(profession);
  }
  if (isBuildable(kind)) {
    const definition = buildingKindDefinition(kind);
    if (definition.carriers > 0) professions.add("carrier");
    if (definition.merchants) professions.add("merchant");
  } else if (kind === "hq") {
    professions.add("carrier");
  }
  return [...professions].sort((a, b) => PROFESSION_LABELS[a].localeCompare(PROFESSION_LABELS[b], "de"));
};

const ANIMAL_DROPS: Record<AnimalKind, Good[]> = {
  hare: ["meat"],
  boar: ["meat", "leather"],
  cow: ["meat", "leather"],
  sheep: ["meat", "wool"],
};

const SPECIAL_GOOD_EFFECTS: Partial<Record<Good, string>> = {
  woodenTool: "Ausgerüstete Bewohner arbeiten etwas schneller.",
  shoes: "Ausgerüstete Bewohner laufen etwas schneller.",
};

const GOOD_SOURCE_PROFESSIONS: Partial<Record<Good, Profession[]>> = {
  wood: ["woodcutter"],
  clay: ["clayDigger"],
  rubble: ["stonecutter"],
  fish: ["fisher"],
  meat: ["hunter"],
  leather: ["hunter"],
  wool: ["hunter"],
};

const sourceAnimalsForGood = (good: Good): AnimalKind[] =>
  WIKI_ANIMALS.filter((kind) => ANIMAL_DROPS[kind].includes(good));

const recipeRowsForGood = (good: Good): string[] => {
  const rows: string[] = [];
  for (const kind of WIKI_BUILDINGS) {
    if (!isBuildable(kind)) continue;
    const definition = buildingKindDefinition(kind);
    const recipes = definition.availableRecipes?.length
      ? definition.availableRecipes
      : definition.recipe ? [definition.recipe] : [];
    for (const recipe of recipes) {
      if (recipe.output !== good) continue;
      const inputs = recipe.inputs ?? (recipe.input ? { [recipe.input]: recipe.amount } : {});
      rows.push(
        `<div class="wiki-recipe-row">${buildingButton(kind)}: ${amountLinks(inputs)} → ${recipe.outputAmount ?? 1} × ${goodButton(good)}</div>`,
      );
    }
  }
  return rows;
};

const professionUnlockTargets = (
  profession: Profession,
): { professions: Profession[]; buildings: WikiBuildingKind[] } => {
  const professions = (Object.entries(PROFESSION_XP_REQUIREMENTS) as [
    Profession,
    { profession: Profession; experience: number } | undefined,
  ][])
    .filter(([, requirement]) => requirement?.profession === profession)
    .map(([target]) => target)
    .sort((a, b) => PROFESSION_LABELS[a].localeCompare(PROFESSION_LABELS[b], "de"));

  const buildings = sortedBuildings(
    TECHNOLOGY_UNLOCK_RULES
      .filter((rule) => rule.profession === profession)
      .map((rule) => rule.technology as WikiBuildingKind),
  );

  return { professions, buildings };
};

const ANIMAL_INTRO: Record<AnimalKind, string> = {
  hare: "Wildtier, das bei der Jagd Fleisch liefert.",
  boar: "Wildtier, das bei der Jagd Fleisch und Leder liefert.",
  cow: "Kann gejagt oder eingefangen und als Vieh gezüchtet werden.",
  sheep: "Kann gejagt oder eingefangen und als Vieh gezüchtet werden.",
};

export const renderGoodsOverview = (): string => `
  <h1>Waren</h1>
  <div class="wiki-grid wiki-goods-grid">
    ${WIKI_GOODS.map((good) => `<button type="button" class="wiki-overview-card" data-wiki-good="${good}">
      <span class="wiki-overview-icon" aria-hidden="true">${GOOD_ICONS[good]}</span><strong>${GOODS[good]}</strong>
    </button>`).join("")}
  </div>`;

export const renderBuildingsOverview = (): string => `
  <h1>Gebäude</h1>
  <div class="wiki-grid">
    ${WIKI_BUILDINGS.map((kind) => `<button type="button" class="wiki-overview-card" data-wiki-building="${kind}">
      <span class="wiki-overview-icon" aria-hidden="true">${buildingIcon(kind)}</span><strong>${BUILDING_WIKI_LABELS[kind]}</strong>
    </button>`).join("")}
  </div>`;

export const renderAnimalsOverview = (): string => `
  <h1>Tiere</h1>
  <div class="wiki-grid">
    ${WIKI_ANIMALS.map((kind) => `<button type="button" class="wiki-overview-card" data-wiki-animal="${kind}">
      <span class="wiki-overview-icon" aria-hidden="true">${ANIMAL_ICONS[kind]}</span><strong>${ANIMAL_LABELS[kind]}</strong>
    </button>`).join("")}
  </div>`;

export const renderProfessionsOverview = (): string => `
  <h1>Berufe</h1>
  <div class="wiki-grid">
    ${WIKI_PROFESSIONS.map((profession) => `<button type="button" class="wiki-overview-card" data-wiki-profession="${profession}">
      <span class="wiki-overview-icon" aria-hidden="true">${PROFESSION_ICONS[profession]}</span><strong>${PROFESSION_LABELS[profession]}</strong>
    </button>`).join("")}
  </div>`;

export const renderGoodArticle = (good: Good): string => {
  const producers = buildingProducersForGood(good);
  const consumers = buildingConsumersForGood(good);
  const sourceProfessions = GOOD_SOURCE_PROFESSIONS[good] ?? [];
  const sourceAnimals = sourceAnimalsForGood(good);
  const recipeRows = recipeRowsForGood(good);
  const effect = SPECIAL_GOOD_EFFECTS[good];
  const hasSources = producers.length > 0 || sourceProfessions.length > 0 || sourceAnimals.length > 0;
  return `
    <div class="wiki-article-kicker">WARE</div>
    <h1><span aria-hidden="true">${GOOD_ICONS[good]}</span> ${GOODS[good]}</h1>
    <h2 id="handbook-section-1">Herstellung und Gewinnung</h2>
    ${hasSources ? `
      ${producers.length ? `<div class="wiki-link-list">${producers.map(buildingButton).join("")}</div>` : ""}
      ${sourceProfessions.length ? `<div class="wiki-link-list">${sourceProfessions.map(professionButton).join("")}</div>` : ""}
      ${sourceAnimals.length ? `<div class="wiki-link-list">${sourceAnimals.map(animalButton).join("")}</div>` : ""}
    ` : "<p>Für diese Ware ist aktuell keine direkte Quelle hinterlegt.</p>"}
    ${recipeRows.length ? `<h2 id="handbook-section-2">Rezept</h2><div class="wiki-recipe-list">${recipeRows.join("")}</div>` : ""}
    ${effect ? `<h2 id="handbook-section-${recipeRows.length ? 3 : 2}">Effekt</h2><p>${effect}</p>` : ""}
    <h2 id="handbook-section-${2 + (recipeRows.length ? 1 : 0) + (effect ? 1 : 0)}">Verwendung</h2>
    ${consumers.length ? `<div class="wiki-link-list">${consumers.map(buildingButton).join("")}</div>` :
      "<p>Aktuell ist keine Gebäudeproduktion oder Bauanforderung hinterlegt.</p>"}
    <p class="wiki-overview-return"><button type="button" class="wiki-link" data-handbook-page="goods">← Alle Waren</button></p>
  `;
};

const renderRecipes = (kind: BuildableBuildingKind): string => {
  const definition = buildingKindDefinition(kind);
  if (kind === "farm") return `<div class="wiki-recipe-row">Erzeugt ${goodButton("wheat")} durch Feldarbeit.</div>`;
  if (kind === "well") return `<div class="wiki-recipe-row">Stellt ${goodButton("water")} bereit.</div>`;
  if (kind === "livestockBreeder")
    return `<div class="wiki-recipe-row">4 × ${goodButton("wheat")} + 4 × ${goodButton("water")} → ${animalButton("cow")} oder ${animalButton("sheep")}</div>`;
  const recipes = definition.availableRecipes?.length ? definition.availableRecipes :
    definition.recipe ? [definition.recipe] : [];
  if (!recipes.length) return "<p>Keine Warenproduktion.</p>";
  return `<div class="wiki-recipe-list">${recipes.map((recipe) => {
    const inputs = recipe.inputs ?? (recipe.input ? { [recipe.input]: recipe.amount } : {});
    const output = recipe.output ? `${recipe.outputAmount ?? 1} × ${goodButton(recipe.output)}` : "Produktion";
    return `<div class="wiki-recipe-row">${amountLinks(inputs)} → ${output}</div>`;
  }).join("")}</div>`;
};

export const renderBuildingArticle = (kind: WikiBuildingKind): string => {
  const construction = kind === "palisade" ? ({ wood: 1 } satisfies GoodAmounts) :
    kind === "house" ? BUILDING_CONSTRUCTION_REQUIREMENTS.house :
    isBuildable(kind) ? BUILDING_CONSTRUCTION_REQUIREMENTS[kind] : undefined;

  let staffing = "Keine reguläre Produktionsbesetzung.";
  if (isBuildable(kind)) {
    const definition = buildingKindDefinition(kind);
    staffing = `${definition.workers} Arbeiter · ${definition.carriers} Träger${definition.merchants ? ` · ${definition.merchants} Händler` : ""}`;
  } else if (kind === "hq") staffing = "Zuweisbare Träger.";
  else if (kind === "house") staffing = "Kein Produktionspersonal.";
  else if (kind === "palisade") staffing = "Kein Personal.";

  const professions = buildingProfessions(kind);
  const upgrade = kind === "pottery" || kind === "stonemason" ? BUILDING_UPGRADE_RULES[kind] : undefined;
  const special = SPECIAL_BUILDING_HELP[kind];

  return `
    <div class="wiki-article-kicker">GEBÄUDE</div>
    <h1 class="building-heading">${buildingIcon(kind)}<span>${BUILDING_WIKI_LABELS[kind]}</span></h1>
    <p class="wiki-intro">${BUILDING_INTRO[kind]}</p>
    ${special ? `<h2 id="handbook-section-1">So funktioniert es</h2><p>${special}</p>` : ""}
    <h2 id="handbook-section-${special ? 2 : 1}">Baukosten</h2>
    <p class="wiki-inline-links">${construction ? amountLinks(construction) : kind === "hq" ? "Startgebäude" : "—"}</p>
    <h2 id="handbook-section-${special ? 3 : 2}">Produktion und Funktion</h2>
    ${isBuildable(kind) ? renderRecipes(kind) : "<p>Keine Warenproduktion.</p>"}
    <h2 id="handbook-section-${special ? 4 : 3}">Personal</h2>
    <p>${staffing}</p>
    ${professions.length ? `<div class="wiki-link-list">${professions.map(professionButton).join("")}</div>` : ""}
    ${upgrade ? `<h2 id="handbook-section-${special ? 5 : 4}">Ausbau</h2><p>Kann zu ${buildingButton(upgrade.to)} ausgebaut werden. Zusätzliche Materialien: ${amountLinks(upgrade.required)}</p>` : ""}
    <p class="wiki-overview-return"><button type="button" class="wiki-link" data-handbook-page="buildings">← Alle Gebäude</button></p>
  `;
};

export const renderAnimalArticle = (kind: AnimalKind): string => {
  const drops = [...ANIMAL_DROPS[kind]].sort((a, b) => GOODS[a].localeCompare(GOODS[b], "de"));
  const livestock = kind === "cow" || kind === "sheep";
  const professions: Profession[] = livestock ? ["hunter", "stockfarmer"] : ["hunter"];
  professions.sort((a, b) => PROFESSION_LABELS[a].localeCompare(PROFESSION_LABELS[b], "de"));
  return `
    <div class="wiki-article-kicker">TIER</div>
    <h1><span aria-hidden="true">${ANIMAL_ICONS[kind]}</span> ${ANIMAL_LABELS[kind]}</h1>
    <p class="wiki-intro">${ANIMAL_INTRO[kind]}</p>
    <h2 id="handbook-section-1">Waren</h2>
    <div class="wiki-link-list">${drops.map(goodButton).join("")}</div>
    ${livestock ? `<h2 id="handbook-section-2">Viehhaltung</h2><div class="wiki-link-list">${buildingButton("livestockBreeder")}</div>` : ""}
    <h2 id="handbook-section-${livestock ? 3 : 2}">Berufe</h2>
    <div class="wiki-link-list">${professions.map(professionButton).join("")}</div>
    <p class="wiki-overview-return"><button type="button" class="wiki-link" data-handbook-page="animals">← Alle Tiere</button></p>
  `;
};

export const renderProfessionArticle = (profession: Profession): string => {
  const workplaces = sortedBuildings(
    WIKI_BUILDINGS.filter((kind) => buildingProfessions(kind).includes(profession)),
  );
  const requirement = PROFESSION_XP_REQUIREMENTS[profession];
  const unlocks = professionUnlockTargets(profession);
  const hasUnlocks = unlocks.professions.length > 0 || unlocks.buildings.length > 0;
  return `
    <div class="wiki-article-kicker">BERUF</div>
    <h1><span aria-hidden="true">${PROFESSION_ICONS[profession]}</span> ${PROFESSION_LABELS[profession]}</h1>
    <p class="wiki-intro">${PROFESSION_INTRO[profession]}</p>
    <h2 id="handbook-section-1">Arbeitsplatz</h2>
    ${workplaces.length ? `<div class="wiki-link-list">${workplaces.map(buildingButton).join("")}</div>` :
      "<p>Dieser Beruf arbeitet ohne festes Produktionsgebäude.</p>"}
    <h2 id="handbook-section-2">Voraussetzung</h2>
    ${requirement
      ? `<p>Benötigt ${requirement.experience} Erfahrung als ${professionButton(requirement.profession)} oder kann über die ${buildingButton("school")} erlernt werden.</p>`
      : "<p>Keine Erfahrungs-Voraussetzung. Der Beruf kann direkt gewählt werden.</p>"}
    ${hasUnlocks ? `
      <h2 id="handbook-section-3">Schaltet frei</h2>
      <div class="wiki-link-list">
        ${unlocks.professions.map(professionButton).join("")}
        ${unlocks.buildings.map(buildingButton).join("")}
      </div>
    ` : ""}
    <p class="wiki-overview-return"><button type="button" class="wiki-link" data-handbook-page="professions">← Alle Berufe</button></p>
  `;
};
