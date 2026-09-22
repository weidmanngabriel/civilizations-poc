import assert from "node:assert/strict";
import test from "node:test";
import { GOODS } from "../src/simulation/simulation";
import { PROFESSION_LABELS } from "../src/simulation/experience";
import {
  ANIMAL_LABELS,
  WIKI_ANIMALS,
  WIKI_BUILDINGS,
  WIKI_GOODS,
  WIKI_PROFESSIONS,
  buildingConsumersForGood,
  buildingProducersForGood,
  renderAnimalArticle,
  renderBuildingArticle,
  renderGoodArticle,
  renderProfessionArticle,
} from "../src/ui/wikiCatalog";

test("wiki covers every current good", () => {
  assert.deepEqual(
    [...WIKI_GOODS].sort(),
    (Object.keys(GOODS) as Array<keyof typeof GOODS>).sort(),
  );
});

test("wiki covers all current managed building types plus palisade", () => {
  assert.deepEqual(
    [...WIKI_BUILDINGS].sort(),
    [
      "hq", "farm", "sawmill", "carpenter", "mill", "bakery", "well",
      "pottery", "pottery2", "stonemason", "stonemason2", "tailor",
      "livestockBreeder", "school", "warehouse", "house", "palisade",
    ].sort(),
  );
});

test("wiki covers every current animal and profession", () => {
  assert.deepEqual([...WIKI_ANIMALS].sort(), (Object.keys(ANIMAL_LABELS) as Array<keyof typeof ANIMAL_LABELS>).sort());
  assert.deepEqual([...WIKI_PROFESSIONS].sort(), (Object.keys(PROFESSION_LABELS) as Array<keyof typeof PROFESSION_LABELS>).sort());
});

test("overview collections are alphabetically sorted by displayed German labels", () => {
  assert.deepEqual(WIKI_GOODS.map((good) => GOODS[good]), [...WIKI_GOODS.map((good) => GOODS[good])].sort((a, b) => a.localeCompare(b, "de")));
  assert.deepEqual(WIKI_PROFESSIONS.map((profession) => PROFESSION_LABELS[profession]), [...WIKI_PROFESSIONS.map((profession) => PROFESSION_LABELS[profession])].sort((a, b) => a.localeCompare(b, "de")));
});

test("good articles link producers and consumers from simulation rules", () => {
  assert.ok(buildingProducersForGood("bread").includes("bakery"));
  assert.ok(buildingConsumersForGood("flour").includes("bakery"));
  const article = renderGoodArticle("flour");
  assert.doesNotMatch(article, /Diese Seite zeigt/);
  assert.match(article, /data-wiki-building="mill"/);
  assert.match(article, /data-wiki-building="bakery"/);
});

test("special equipment goods explain their gameplay effect", () => {\n  const tool = renderGoodArticle("woodenTool");\n  assert.match(tool, /Effekt/);\n  assert.match(tool, /arbeiten etwas schneller/);\n\n  const shoes = renderGoodArticle("shoes");\n  assert.match(shoes, /Effekt/);\n  assert.match(shoes, /laufen etwas schneller/);\n\n  const clay = renderGoodArticle("clay");\n  assert.doesNotMatch(clay, />Effekt<\\/h2>/);\n});\n\ntest("professions without experience requirements are documented as directly available only", () => {\n  const hunter = renderProfessionArticle("hunter");\n  assert.match(hunter, /Keine Erfahrungs-Voraussetzung\\. Der Beruf kann direkt gewählt werden\\./);\n  assert.doesNotMatch(hunter, /Keine Erfahrungs-Voraussetzung[^<]*Schule/);\n});\n\ntest("good articles show production recipes and non-building sources", () => {
  const shoes = renderGoodArticle("shoes");
  assert.match(shoes, /Rezept/);
  assert.match(shoes, /data-wiki-building="tailor"/);
  assert.match(shoes, /data-wiki-good="leather"/);
  assert.match(shoes, /data-wiki-good="shoes"/);

  const leather = renderGoodArticle("leather");
  assert.match(leather, /data-wiki-profession="hunter"/);
  assert.match(leather, /data-wiki-animal="boar"/);
  assert.match(leather, /data-wiki-animal="cow"/);

  const wood = renderGoodArticle("wood");
  assert.match(wood, /data-wiki-profession="woodcutter"/);

  const fish = renderGoodArticle("fish");
  assert.match(fish, /data-wiki-profession="fisher"/);
});

test("building articles expose linked construction, recipes and concise help", () => {
  const bakery = renderBuildingArticle("bakery");
  assert.match(bakery, /data-wiki-good="plank"/);
  assert.match(bakery, /data-wiki-good="brick"/);
  assert.match(bakery, /data-wiki-good="flour"/);
  assert.match(bakery, /data-wiki-good="water"/);
  assert.match(bakery, /data-wiki-good="bread"/);

  const pottery2 = renderBuildingArticle("pottery2");
  assert.equal((pottery2.match(/wiki-recipe-row/g) ?? []).length, 2);

  const school = renderBuildingArticle("school");
  assert.match(school, /So funktioniert es/);
  assert.match(school, /60 simulierten Sekunden/);
  assert.doesNotMatch(school, /Essen|Schlafen|Pause/);
});

test("animal and profession articles cross-link related game knowledge", () => {
  const sheep = renderAnimalArticle("sheep");
  assert.match(sheep, /data-wiki-good="wool"/);
  assert.match(sheep, /data-wiki-building="livestockBreeder"/);
  assert.match(sheep, /data-wiki-profession="stockfarmer"/);

  const baker = renderProfessionArticle("baker");
  assert.match(baker, /data-wiki-building="bakery"/);
  assert.match(baker, /data-wiki-profession="miller"/);
  assert.match(baker, /data-wiki-building="school"/);
});

test("profession articles show progression unlocked by experience", () => {
  const hunter = renderProfessionArticle("hunter");
  assert.match(hunter, /Schaltet frei/);
  assert.match(hunter, /data-wiki-profession="tailor"/);
  assert.match(hunter, /data-wiki-profession="stockfarmer"/);
  assert.match(hunter, /data-wiki-building="tailor"/);
  assert.match(hunter, /data-wiki-building="livestockBreeder"/);

  const woodcutter = renderProfessionArticle("woodcutter");
  assert.match(woodcutter, /data-wiki-profession="sawmillWorker"/);
  assert.match(woodcutter, /data-wiki-building="sawmill"/);
});
