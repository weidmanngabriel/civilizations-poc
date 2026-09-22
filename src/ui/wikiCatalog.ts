import type { BuildableBuildingKind, Good, GoodAmounts } from "../simulation/model";
import { ALL_GOODS, GOODS, buildingKindDefinition } from "../simulation/simulation";
import { BUILDING_CONSTRUCTION_REQUIREMENTS } from "../simulation/constructionRules";
import { BUILDING_UPGRADE_RULES } from "../simulation/buildingUpgradeRules";
import { GOOD_ICONS, buildingIcon } from "../icons";
import { BUILDING_WIKI_LABELS, type WikiBuildingKind } from "./wikiLinks";

export const WIKI_BUILDINGS: WikiBuildingKind[] = [
  "hq", "house", "farm", "sawmill", "carpenter", "mill", "bakery", "well",
  "pottery", "pottery2", "stonemason", "stonemason2", "tailor",
  "livestockBreeder", "warehouse", "palisade",
];

const BUILDABLE = new Set<BuildableBuildingKind>([
  "farm", "sawmill", "carpenter", "mill", "bakery", "well", "pottery",
  "pottery2", "stonemason", "stonemason2", "tailor", "livestockBreeder", "warehouse",
]);

const isBuildable = (kind: WikiBuildingKind): kind is BuildableBuildingKind =>
  BUILDABLE.has(kind as BuildableBuildingKind);

const goodButton = (good: Good, prefix = ""): string =>
  `<button type="button" class="wiki-link wiki-chip" data-wiki-good="${good}"><span aria-hidden="true">${GOOD_ICONS[good]}</span>${prefix}${GOODS[good]}</button>`;

const buildingButton = (kind: WikiBuildingKind): string =>
  `<button type="button" class="wiki-link wiki-card-link" data-wiki-building="${kind}">${buildingIcon(kind)}<span>${BUILDING_WIKI_LABELS[kind]}</span></button>`;

const amountLinks = (amounts: GoodAmounts | undefined): string => {
  if (!amounts) return "—";
  const entries = (Object.entries(amounts) as [Good, number | undefined][])
    .filter((entry): entry is [Good, number] => Boolean(entry[1]));
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
  for (const recipe of definition.availableRecipes ?? []) {
    if (recipe.output) outputs.add(recipe.output);
  }
  if (kind === "farm") outputs.add("wheat");
  if (kind === "well") outputs.add("water");
  return [...outputs];
};

export const buildingConsumersForGood = (good: Good): WikiBuildingKind[] =>
  WIKI_BUILDINGS.filter((kind) => {
    if (!isBuildable(kind)) return false;
    return (recipeInputs(kind)[good] ?? 0) > 0 ||
      (BUILDING_CONSTRUCTION_REQUIREMENTS[kind]?.[good] ?? 0) > 0;
  });

export const buildingProducersForGood = (good: Good): WikiBuildingKind[] =>
  WIKI_BUILDINGS.filter((kind) => isBuildable(kind) && recipeOutputs(kind).includes(good));

export const renderGoodsOverview = (): string => `
  <h1>Waren</h1>
  <p>Alle aktuell im Prototyp verwendeten Waren. Ein Klick öffnet die Detailseite.</p>
  <div class="wiki-grid wiki-goods-grid">
    ${ALL_GOODS
      .map((good) => `<button type="button" class="wiki-overview-card" data-wiki-good="${good}">
        <span class="wiki-overview-icon" aria-hidden="true">${GOOD_ICONS[good]}</span>
        <strong>${GOODS[good]}</strong>
      </button>`)
      .join("")}
  </div>`;

export const renderBuildingsOverview = (): string => `
  <h1>Gebäude</h1>
  <p>Gebäudetypen und Infrastruktur des aktuellen Prototyps. Konkrete Gebäude in der Welt werden weiterhin über die Weltansicht ausgewählt.</p>
  <div class="wiki-grid">
    ${WIKI_BUILDINGS.map((kind) => `<button type="button" class="wiki-overview-card" data-wiki-building="${kind}">
      <span class="wiki-overview-icon" aria-hidden="true">${buildingIcon(kind)}</span>
      <strong>${BUILDING_WIKI_LABELS[kind]}</strong>
    </button>`).join("")}
  </div>`;

export const renderGoodArticle = (good: Good): string => {
  const producers = buildingProducersForGood(good);
  const consumers = buildingConsumersForGood(good);
  return `
    <div class="wiki-article-kicker">WARE</div>
    <h1><span aria-hidden="true">${GOOD_ICONS[good]}</span> ${GOODS[good]}</h1>
    <p>Diese Seite zeigt, wo die Ware im aktuellen Prototyp entsteht und wo sie verwendet wird.</p>
    <h2 id="handbook-section-1">Herstellung und Gewinnung</h2>
    ${producers.length
      ? `<div class="wiki-link-list">${producers.map(buildingButton).join("")}</div>`
      : "<p>Keine Produktionsstätte erzeugt diese Ware direkt. Sie stammt aus direkter Gewinnung, Jagd, Tierhaltung oder einer anderen Weltaktivität.</p>"}
    <h2 id="handbook-section-2">Verwendung</h2>
    ${consumers.length
      ? `<div class="wiki-link-list">${consumers.map(buildingButton).join("")}</div>`
      : "<p>Aktuell ist keine Gebäudeproduktion oder Bauanforderung für diese Ware hinterlegt.</p>"}
    <p class="wiki-overview-return"><button type="button" class="wiki-link" data-handbook-page="goods">← Alle Waren</button></p>
  `;
};

export const renderBuildingArticle = (kind: WikiBuildingKind): string => {
  const construction = kind === "palisade"
    ? ({ wood: 1 } satisfies GoodAmounts)
    : kind === "house"
      ? BUILDING_CONSTRUCTION_REQUIREMENTS.house
      : isBuildable(kind)
        ? BUILDING_CONSTRUCTION_REQUIREMENTS[kind]
        : undefined;

  let production = "Dieses Gebäude hat aktuell keine Warenproduktion.";
  let staffing = "Keine reguläre Produktionsbesetzung.";
  if (isBuildable(kind)) {
    const definition = buildingKindDefinition(kind);
    const recipes = definition.availableRecipes?.length ? definition.availableRecipes : definition.recipe ? [definition.recipe] : [];
    if (kind === "farm") production = `Erzeugt ${goodButton("wheat")} durch Feldarbeit.`;
    else if (kind === "well") production = `Stellt ${goodButton("water")} als unerschöpfliche Quelle bereit.`;
    else if (kind === "livestockBreeder") production = `Benötigt 4 × ${goodButton("wheat")} und 4 × ${goodButton("water")} für die Tierzucht.`;
    else if (recipes.length) {
      production = recipes.map((recipe) => {
        const inputs = recipe.inputs ?? (recipe.input ? { [recipe.input]: recipe.amount } : {});
        const output = recipe.output ? `${recipe.outputAmount ?? 1} × ${goodButton(recipe.output)}` : "Tiernachwuchs";
        return `${amountLinks(inputs)} → ${output}`;
      }).join("<br>");
    }
    staffing = `${definition.workers} Arbeiter · ${definition.carriers} Träger${definition.merchants ? ` · ${definition.merchants} Händler` : ""}`;
  } else if (kind === "hq") {
    staffing = "Zentraler Sammel- und Lagerpunkt mit zuweisbaren Trägern.";
  } else if (kind === "house") {
    staffing = "Wohngebäude ohne Produktionspersonal.";
  } else if (kind === "palisade") {
    staffing = "Infrastruktur ohne Personal.";
  }

  const upgrade = kind === "pottery" || kind === "stonemason" ? BUILDING_UPGRADE_RULES[kind] : undefined;

  return `
    <div class="wiki-article-kicker">GEBÄUDE</div>
    <h1 class="building-heading">${buildingIcon(kind)}<span>${BUILDING_WIKI_LABELS[kind]}</span></h1>
    <h2 id="handbook-section-1">Baukosten</h2>
    <p class="wiki-inline-links">${construction ? amountLinks(construction) : kind === "hq" ? "Startgebäude" : "—"}</p>
    <h2 id="handbook-section-2">Produktion und Funktion</h2>
    <p class="wiki-inline-links">${production}</p>
    <h2 id="handbook-section-3">Personal</h2>
    <p>${staffing}</p>
    ${upgrade ? `<h2 id="handbook-section-4">Ausbau</h2><p>Kann zu ${buildingButton(upgrade.to)} ausgebaut werden. Zusätzliche Materialien: ${amountLinks(upgrade.required)}</p>` : ""}
    <p class="wiki-overview-return"><button type="button" class="wiki-link" data-handbook-page="buildings">← Alle Gebäude</button></p>
  `;
};
