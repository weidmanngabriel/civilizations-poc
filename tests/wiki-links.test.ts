import assert from "node:assert/strict";
import test from "node:test";
import { GOODS } from "../src/simulation/simulation";
import {
  WIKI_BUILDINGS,
  WIKI_GOODS,
  buildingConsumersForGood,
  buildingProducersForGood,
  renderBuildingArticle,
  renderGoodArticle,
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
      "hq",
      "farm",
      "sawmill",
      "carpenter",
      "mill",
      "bakery",
      "well",
      "pottery",
      "pottery2",
      "stonemason",
      "stonemason2",
      "tailor",
      "livestockBreeder",
      "warehouse",
      "house",
      "palisade",
    ].sort(),
  );
});

test("good articles link producers and consumers from simulation rules", () => {
  assert.ok(buildingProducersForGood("bread").includes("bakery"));
  assert.ok(buildingConsumersForGood("flour").includes("bakery"));
  const article = renderGoodArticle("flour");
  assert.match(article, /data-wiki-building="mill"/);
  assert.match(article, /data-wiki-building="bakery"/);
});

test("building articles expose linked construction and production goods", () => {
  const bakery = renderBuildingArticle("bakery");
  assert.match(bakery, /data-wiki-good="plank"/);
  assert.match(bakery, /data-wiki-good="brick"/);
  assert.match(bakery, /data-wiki-good="flour"/);
  assert.match(bakery, /data-wiki-good="water"/);
  assert.match(bakery, /data-wiki-good="bread"/);
});
