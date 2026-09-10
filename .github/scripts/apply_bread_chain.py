from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, got {count}")
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, label: str) -> str:
    result, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one regex match, got {count}")
    return result


# --- shared model ---------------------------------------------------------
path = "src/simulation/model.ts"
text = read(path)
text = replace_once(
    text,
    'export type Good = "wood" | "plank" | "woodenTool" | "wheat";',
    'export type Good = "wood" | "plank" | "woodenTool" | "wheat" | "flour" | "water" | "bread";',
    "goods",
)
text = replace_once(
    text,
    'export type BuildingKind = "hq" | "forest" | "field" | "farm" | "sawmill" | "carpenter" | "warehouse";',
    'export type BuildingKind = "hq" | "forest" | "field" | "farm" | "sawmill" | "carpenter" | "mill" | "bakery" | "well" | "warehouse";',
    "building kinds",
)
text = replace_once(
    text,
    'export interface Recipe {\n  input?: Good;\n  amount: number;\n  output: Good;\n  duration: number;\n}',
    'export interface Recipe {\n  input?: Good;\n  inputs?: GoodAmounts;\n  amount: number;\n  output: Good;\n  duration: number;\n}',
    "recipe inputs",
)
text = replace_once(
    text,
    '  input: number;\n  output: number;\n  inventory?: Inventory;',
    '  input: number;\n  inputInventory?: Inventory;\n  output: number;\n  inventory?: Inventory;',
    "building input inventory",
)
write(path, text)


# --- placement and construction -----------------------------------------
path = "src/simulation/buildingPlacement.ts"
text = read(path)
text = replace_once(
    text,
    '  sawmill: constructionPlan({ wood: 6 }),\n  carpenter: constructionPlan({ plank: 4 }),',
    '  sawmill: constructionPlan({ wood: 6 }),\n  carpenter: constructionPlan({ plank: 4 }),\n  mill: constructionPlan({ wood: 4 }),\n  bakery: constructionPlan({ plank: 4 }),\n  well: constructionPlan({ wood: 4 }),',
    "construction plans",
)
shape_block = '''  carpenter: {
    cells: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: 1, r: 1 },
    ],
    anchor: { q: 0, r: 0 },
  },
};'''
shape_replacement = '''  carpenter: {
    cells: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: 1, r: 1 },
    ],
    anchor: { q: 0, r: 0 },
  },
  mill: {
    cells: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: 1, r: 1 },
    ],
    anchor: { q: 0, r: 0 },
  },
  bakery: {
    cells: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: 1, r: 1 },
    ],
    anchor: { q: 0, r: 0 },
  },
  well: {
    cells: [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: 1, r: 1 },
    ],
    anchor: { q: 0, r: 0 },
  },
};'''
text = replace_once(text, shape_block, shape_replacement, "placement shapes")
write(path, text)


# --- simulation ----------------------------------------------------------
path = "src/simulation/simulation.ts"
text = read(path)
text = replace_once(text, '  Good,\n  Hex,', '  Good,\n  GoodAmounts,\n  Hex,', "simulation GoodAmounts import")
anchor = '''export const totalWarehouseStock = (w: World, good: Good): number =>
  w.buildings
    .filter((b) => !b.retired && b.kind === "warehouse" && !isUnderConstruction(b))
    .reduce((sum, b) => sum + warehouseStock(b, good), 0);

'''
helpers = '''export const totalWarehouseStock = (w: World, good: Good): number =>
  w.buildings
    .filter((b) => !b.retired && b.kind === "warehouse" && !isUnderConstruction(b))
    .reduce((sum, b) => sum + warehouseStock(b, good), 0);

export const ALL_GOODS: Good[] = [
  "wood",
  "plank",
  "woodenTool",
  "wheat",
  "flour",
  "water",
  "bread",
];

const recipeRequirements = (b: Building): GoodAmounts => {
  if (!b.recipe) return {};
  if (b.recipe.inputs) return b.recipe.inputs;
  if (b.recipe.input) return { [b.recipe.input]: b.recipe.amount };
  return {};
};

const inputStock = (b: Building, good: Good): number => {
  if (b.recipe?.inputs) return b.inputInventory?.[good] ?? 0;
  return b.recipe?.input === good ? b.input : 0;
};

const inputHasSpace = (w: World, b: Building, good: Good): boolean =>
  inputStock(b, good) + incoming(w, b.id, good) < CONFIG.inputCapacity;

const hasRecipeInputs = (b: Building): boolean =>
  (Object.entries(recipeRequirements(b)) as [Good, number][]).every(
    ([good, amount]) => inputStock(b, good) >= amount,
  );

const consumeRecipeInputs = (b: Building): void => {
  for (const [good, amount] of Object.entries(recipeRequirements(b)) as [Good, number][]) {
    if (b.recipe?.inputs) {
      b.inputInventory ??= {};
      b.inputInventory[good] = (b.inputInventory[good] ?? 0) - amount;
    } else if (b.recipe?.input === good) {
      b.input -= amount;
    }
  }
};

const addProductionInput = (b: Building, good: Good): void => {
  if (b.recipe?.inputs) {
    b.inputInventory ??= {};
    b.inputInventory[good] = (b.inputInventory[good] ?? 0) + CONFIG.carryCapacity;
  } else {
    b.input += CONFIG.carryCapacity;
  }
};

'''
text = replace_once(text, anchor, helpers, "simulation helpers")
text = replace_once(
    text,
    '''const sourceStock = (b: Building, good: Good): number => {
  if (isUnderConstruction(b)) return 0;
  if (b.kind === "warehouse") return warehouseStock(b, good);
  if (b.kind === "farm" && good === "wheat") return b.output;
  return b.recipe?.output === good ? b.output : 0;
};''',
    '''const sourceStock = (b: Building, good: Good): number => {
  if (isUnderConstruction(b)) return 0;
  if (b.kind === "warehouse") return warehouseStock(b, good);
  if (b.kind === "well" && good === "water") return Number.MAX_SAFE_INTEGER;
  if (b.kind === "farm" && good === "wheat") return b.output;
  return b.recipe?.output === good ? b.output : 0;
};''',
    "well source stock",
)
text = replace_once(
    text,
    '''  const source = w.buildings.find((b) => b.id === p.trip!.source);
  if (!source) return;
  if (source.kind === "warehouse" && !isUnderConstruction(source)) {''',
    '''  const source = w.buildings.find((b) => b.id === p.trip!.source);
  if (!source || (source.kind === "well" && p.trip.good === "water")) return;
  if (source.kind === "warehouse" && !isUnderConstruction(source)) {''',
    "return infinite water",
)
request_input = '''function requestInput(w: World, p: Person, b: Building): void {
  const construction = isUnderConstruction(b) ? b.construction! : undefined;
  const isWarehouseCollection = b.kind === "warehouse" && !construction;
  const goods: Good[] = construction
    ? (Object.keys(construction.required) as Good[]).filter(
        (good) =>
          (construction.delivered[good] ?? 0) + incoming(w, b.id, good) <
          (construction.required[good] ?? 0),
      )
    : isWarehouseCollection
      ? ALL_GOODS
      : (Object.keys(recipeRequirements(b)) as Good[]).filter((good) =>
          inputHasSpace(w, b, good),
        );
  if (!goods.length) return;

  const sources: SourceCandidate[] = [];
  for (const good of goods) {
    if (isWarehouseCollection && !warehouseHasSpace(w, b, good)) continue;
    for (const source of w.buildings) {
      if (
        source.id === b.id ||
        (source.retired && source.output <= 0) ||
        available(w, source, good) <= 0 ||
        (isWarehouseCollection && source.kind === "warehouse")
      )
        continue;
      if (isWarehouseCollection) {
        const collectionPath = findPathBySteps(w.tiles, b.position, source.position);
        if (!collectionPath || collectionPath.length > CONFIG.warehouseCollectionRadius)
          continue;
      }
      const path = findPath(
        w.tiles,
        p.position,
        source.position,
        CONFIG.roadSpeedMultiplier,
      );
      if (path) sources.push({ source, good, path });
    }
  }
  sources.sort(
    (a, b) =>
      pathTravelCost(w.tiles, a.path, CONFIG.roadSpeedMultiplier) -
      pathTravelCost(w.tiles, b.path, CONFIG.roadSpeedMultiplier),
  );
  const source = sources[0];
  if (!source) return;
  p.trip = {
    source: source.source.id,
    target: b.id,
    good: source.good,
    picked: false,
  };
  p.path = source.path;
  p.movement = 0;
}

'''
text = regex_once(
    text,
    r'function requestInput\(w: World, p: Person, b: Building\): void \{.*?\n\}\n\n(?=function requestMerchantTransfer)',
    request_input,
    "requestInput",
)
building_definition = '''const buildingDefinition = (kind: BuildableBuildingKind): Omit<Building, "id" | "position" | "baseTerrain"> => {
  if (kind === "sawmill")
    return {
      kind,
      name: "Sägewerk",
      workers: 1,
      carriers: 2,
      input: 0,
      output: 0,
      recipe: { input: "wood", amount: 2, output: "plank", duration: CONFIG.duration },
    };
  if (kind === "carpenter")
    return {
      kind,
      name: "Schreinerei",
      workers: 1,
      carriers: 2,
      input: 0,
      output: 0,
      recipe: { input: "plank", amount: 2, output: "woodenTool", duration: CONFIG.duration },
    };
  if (kind === "mill")
    return {
      kind,
      name: "Mühle",
      workers: 1,
      carriers: 2,
      input: 0,
      output: 0,
      recipe: { input: "wheat", amount: 1, output: "flour", duration: CONFIG.duration },
    };
  if (kind === "bakery")
    return {
      kind,
      name: "Bäckerei",
      workers: 1,
      carriers: 2,
      input: 0,
      inputInventory: { flour: 0, water: 0 },
      output: 0,
      recipe: { inputs: { flour: 1, water: 1 }, amount: 1, output: "bread", duration: CONFIG.duration },
    };
  if (kind === "well")
    return {
      kind,
      name: "Brunnen",
      workers: 0,
      carriers: 0,
      input: 0,
      output: 0,
    };
  if (kind === "farm")
    return {
      kind,
      name: "Farm",
      workers: 1,
      carriers: 0,
      input: 0,
      output: 0,
    };
  return {
    kind,
    name: "Lager",
    workers: 0,
    carriers: 2,
    merchants: 2,
    input: 0,
    output: 0,
    inventory: {
      wood: 0,
      plank: 0,
      woodenTool: 0,
      wheat: 0,
      flour: 0,
      water: 0,
      bread: 0,
    },
  };
};

'''
text = regex_once(
    text,
    r'const buildingDefinition = \(kind: BuildableBuildingKind\): Omit<Building, "id" \| "position" \| "baseTerrain"> => \{.*?\n\};\n\n(?=export function buildAt)',
    building_definition,
    "building definitions",
)
text = replace_once(
    text,
    '''        if (source.kind === "warehouse" && !isUnderConstruction(source)) {
          source.inventory![p.trip.good] =
            (source.inventory![p.trip.good] ?? 0) - CONFIG.carryCapacity;
        } else {
          source.output -= CONFIG.carryCapacity;
        }''',
    '''        if (source.kind === "warehouse" && !isUnderConstruction(source)) {
          source.inventory![p.trip.good] =
            (source.inventory![p.trip.good] ?? 0) - CONFIG.carryCapacity;
        } else if (!(source.kind === "well" && p.trip.good === "water")) {
          source.output -= CONFIG.carryCapacity;
        }''',
    "pickup infinite water",
)
text = replace_once(
    text,
    '''        } else {
          target.input += CONFIG.carryCapacity;
        }''',
    '''        } else {
          addProductionInput(target, p.trip.good);
        }''',
    "multi input delivery",
)
text = replace_once(
    text,
    '''        b.input >= recipe.amount &&
        outputOccupied(w, b) < CONFIG.outputCapacity''',
    '''        hasRecipeInputs(b) &&
        outputOccupied(w, b) < CONFIG.outputCapacity''',
    "production input check",
)
text = replace_once(
    text,
    '''        b.input -= recipe.amount;
        b.output++;''',
    '''        consumeRecipeInputs(b);
        b.output++;''',
    "production input consumption",
)
old_worker_resupply = '''    const recipe = b.recipe;
    const workerNeedsResupply =
      p.assignment.role === "worker" &&
      recipe?.input &&
      b.input + incoming(w, b.id) < CONFIG.inputCapacity &&
      (b.input < recipe.amount || outputOccupied(w, b) >= CONFIG.outputCapacity);
    if (p.assignment.role === "carrier" || workerNeedsResupply)
      requestInput(w, p, b);'''
new_worker_resupply = '''    const recipe = b.recipe;
    const requirements = recipeRequirements(b);
    const recipeGoods = Object.keys(requirements) as Good[];
    const workerCanTopUp = recipeGoods.some((good) => inputHasSpace(w, b, good));
    const workerMissingInput = recipeGoods.some(
      (good) => inputStock(b, good) < (requirements[good] ?? 0),
    );
    const workerNeedsResupply =
      p.assignment.role === "worker" &&
      Boolean(recipe) &&
      workerCanTopUp &&
      (workerMissingInput || outputOccupied(w, b) >= CONFIG.outputCapacity);
    if (p.assignment.role === "carrier" || workerNeedsResupply)
      requestInput(w, p, b);'''
text = replace_once(text, old_worker_resupply, new_worker_resupply, "worker resupply")
text = replace_once(
    text,
    '''export const GOODS: Record<Good, string> = {
  wood: "Holz",
  plank: "Bretter",
  woodenTool: "Holzwerkzeuge",
  wheat: "Weizen",
};''',
    '''export const GOODS: Record<Good, string> = {
  wood: "Holz",
  plank: "Bretter",
  woodenTool: "Holzwerkzeuge",
  wheat: "Weizen",
  flour: "Mehl",
  water: "Wasser",
  bread: "Brot",
};''',
    "goods labels",
)
text = replace_once(
    text,
    '''  if (b.kind === "warehouse") {
    const carriers = assigned(w, b.id, "carrier").length;''',
    '''  if (b.kind === "well") return "Unerschöpfliche Wasserquelle";
  if (b.kind === "warehouse") {
    const carriers = assigned(w, b.id, "carrier").length;''',
    "well status",
)
text = replace_once(
    text,
    '''  if (b.recipe?.input && b.input < b.recipe.amount)
    return `Wartet auf ${GOODS[b.recipe.input]}`;
  return "Bereit zur Produktion";''',
    '''  const missing = (Object.entries(recipeRequirements(b)) as [Good, number][])
    .filter(([good, amount]) => inputStock(b, good) < amount)
    .map(([good]) => GOODS[good]);
  if (missing.length) return `Wartet auf ${missing.join(" + ")}`;
  return "Bereit zur Produktion";''',
    "generic waiting status",
)
write(path, text)


# --- shared presentation icons ------------------------------------------
icons = '''import type { BuildingKind, Good } from "./simulation/model";

export const GOOD_ICONS: Record<Good, string> = {
  wood: "🪵",
  plank: "🟫",
  woodenTool: "🛠️",
  wheat: "🌾",
  flour: "🥣",
  water: "💧",
  bread: "🍞",
};

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

export const BUILDING_SVG: Partial<Record<BuildingKind, string>> = {
  hq: svg('<path d="M4 20V9l8-5 8 5v11H4Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 20v-6h6v6M8 10h8" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
  warehouse: svg('<path d="M3 9h18v11H3V9Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m3 9 9-5 9 5M7 13h4v3H7v-3Zm6 0h4v3h-4v-3Z" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
  farm: svg('<path d="M4 20V9l8-5 8 5v11H4Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 20v-7h8v7M2 20h20" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 7c2 1 3 2 4 4M18 7c-2 1-3 2-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
  sawmill: svg('<path d="M3 20h18M5 20v-8h10v8M15 15h4v5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 8v8M6 12h8" stroke="currentColor" stroke-width="1.4"/>'),
  carpenter: svg('<path d="M4 19 16 7M8 5l11 11M5 8l3-3 11 11-3 3L5 8Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 19h6" stroke="currentColor" stroke-width="1.8"/>'),
  mill: svg('<path d="M8 20h8l-1-10H9L8 20Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 6V2M14 8h4M12 10v4M10 8H6" stroke="currentColor" stroke-width="1.6"/>'),
  bakery: svg('<path d="M4 20V9l8-5 8 5v11H4Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 20v-6c0-3 2-5 5-5s5 2 5 5v6M8 15h8" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
  well: svg('<path d="M5 9h14M7 9v11m10-11v11M4 20h16M8 9l4-5 4 5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 12h4v5h-4z" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
};

export const buildingIcon = (kind: BuildingKind): string =>
  BUILDING_SVG[kind] ? `<span class="building-icon">${BUILDING_SVG[kind]}</span>` : "";
'''
write("src/icons.ts", icons)


# --- DOM controls --------------------------------------------------------
path = "src/ui/controls.ts"
text = read(path)
text = replace_once(
    text,
    'import { same } from "../simulation/hex";\n',
    'import { same } from "../simulation/hex";\nimport { BUILDING_SVG, GOOD_ICONS, buildingIcon } from "../icons";\n',
    "controls icon import",
)
text = replace_once(
    text,
    '''const BUILDING_NAMES: Record<BuildableBuildingKind, string> = {
  warehouse: "Lager",
  farm: "Farm",
  sawmill: "Sägewerk",
  carpenter: "Schreinerei",
};''',
    '''const BUILDING_NAMES: Record<BuildableBuildingKind, string> = {
  warehouse: "Lager",
  farm: "Farm",
  sawmill: "Sägewerk",
  carpenter: "Schreinerei",
  mill: "Mühle",
  bakery: "Bäckerei",
  well: "Brunnen",
};''',
    "building names",
)
text = replace_once(
    text,
    '''  const roleLabel = (role: Role) =>
    role === "worker"
      ? "Arbeiter"
      : role === "carrier"
        ? "Träger"
        : role === "merchant"
          ? "Händler"
          : "Bauarbeiter";''',
    '''  const roleLabel = (role: Role) =>
    role === "worker"
      ? "Arbeiter"
      : role === "carrier"
        ? "Träger"
        : role === "merchant"
          ? "Händler"
          : "Bauarbeiter";
  const workerLabel = (b: Building) =>
    b.kind === "farm" ? "Farmer" : b.kind === "mill" ? "Müller" : b.kind === "bakery" ? "Bäcker" : "Arbeiter";
  const buildingHeading = (b: Building) => `${buildingIcon(b.kind)}<span>${b.name}</span>`;
  const goodLabel = (good: Good) => `<span class="good-label"><span aria-hidden="true">${GOOD_ICONS[good]}</span><span>${GOODS[good]}</span></span>`;
  const personIcon = (personId: number) => {
    const p = w.people.find((candidate) => candidate.id === personId);
    if (!p) return "👤";
    if (p.woodcutter) return "🪓";
    if (p.builder) return "🔨";
    if (p.assignment?.role === "merchant") return "🧭";
    if (p.assignment?.role === "carrier") return "📦";
    if (p.assignment?.role === "worker") {
      const workplace = w.buildings.find((candidate) => candidate.id === p.assignment!.building);
      if (workplace?.kind === "farm") return "🌾";
      if (workplace?.kind === "mill") return "⚙️";
      if (workplace?.kind === "bakery") return "🍞";
      if (workplace?.kind === "sawmill") return "🪵";
      if (workplace?.kind === "carpenter") return "🛠️";
    }
    return "👤";
  };''',
    "controls role helpers",
)
text = replace_once(
    text,
    '    const label = b.kind === "farm" && role === "worker" ? "Farmer" : roleLabel(role);',
    '    const label = role === "worker" ? workerLabel(b) : roleLabel(role);',
    "assignment worker label",
)
text = replace_once(
    text,
    'const goodOptions = (Object.keys(GOODS) as Good[]).map((good) => `<option value="${good}" ${p.merchantRoute?.good === good ? "selected" : ""}>${GOODS[good]}</option>`).join("");',
    'const goodOptions = (Object.keys(GOODS) as Good[]).map((good) => `<option value="${good}" ${p.merchantRoute?.good === good ? "selected" : ""}>${GOOD_ICONS[good]} ${GOODS[good]}</option>`).join("");',
    "merchant good icons",
)
text = replace_once(
    text,
    '''      setField("warehouse-wheat", `${warehouseStock(b, "wheat")}/${CONFIG.warehouseCapacityPerGood}`);
    } else {
      if (b.recipe?.input) setField("input", `${b.input}/${CONFIG.inputCapacity}`);
      setField("output", `${b.output}/${CONFIG.outputCapacity}`);
    }''',
    '''      setField("warehouse-wheat", `${warehouseStock(b, "wheat")}/${CONFIG.warehouseCapacityPerGood}`);
      setField("warehouse-flour", `${warehouseStock(b, "flour")}/${CONFIG.warehouseCapacityPerGood}`);
      setField("warehouse-water", `${warehouseStock(b, "water")}/${CONFIG.warehouseCapacityPerGood}`);
      setField("warehouse-bread", `${warehouseStock(b, "bread")}/${CONFIG.warehouseCapacityPerGood}`);
    } else {
      const recipeInputs = b.recipe?.inputs
        ? (Object.keys(b.recipe.inputs) as Good[])
        : b.recipe?.input
          ? [b.recipe.input]
          : [];
      for (const good of recipeInputs) {
        const amount = b.recipe?.inputs ? (b.inputInventory?.[good] ?? 0) : b.input;
        setField(`input-${good}`, `${amount}/${CONFIG.inputCapacity}`);
      }
      setField("output", `${b.output}/${CONFIG.outputCapacity}`);
    }''',
    "live inventories",
)
old_build_buttons = '''<div class="stepper"><button data-action="build" data-kind="warehouse">Lager</button><button data-action="build" data-kind="farm">Farm</button><button data-action="build" data-kind="sawmill">Sägewerk</button><button data-action="build" data-kind="carpenter">Schreinerei</button></div>'''
new_build_buttons = '''<div class="stepper build-choice-grid">${(Object.keys(BUILDING_NAMES) as BuildableBuildingKind[]).map((kind) => `<button class="icon-button" data-action="build" data-kind="${kind}">${buildingIcon(kind)}<span>${BUILDING_NAMES[kind]}</span></button>`).join("")}</div>'''
text = replace_once(text, old_build_buttons, new_build_buttons, "build menu icons")
text = text.replace('<h3>${b.name}</h3>', '<h3 class="building-heading">${buildingHeading(b)}</h3>')
text = replace_once(
    text,
    '.map((good) => `<div><span>${GOODS[good]}</span><strong data-field="construction-${good}"></strong></div>`)',
    '.map((good) => `<div><span>${goodLabel(good)}</span><strong data-field="construction-${good}"></strong></div>`)',
    "construction good icons",
)
recipe_pattern = r'''    const recipe = b\.forestRemaining !== undefined\n      \? `1 Holz / \$\{b\.recipe!\.duration / CONFIG\.simulationHz\} s bei 1× · Vorrat <span data-field="forest-remaining"></span>/\$\{CONFIG\.forestYield\}`\n      : b\.kind === "warehouse".*?    const merchantAssignment = b\.kind === "warehouse"\n      \? assignmentControl\(b, "merchant", b\.merchants \?\? 0\)\n      : "";'''
recipe_replacement = '''    const recipeInputs = b.recipe?.inputs
      ? (Object.entries(b.recipe.inputs) as [Good, number][])
      : b.recipe?.input
        ? [[b.recipe.input, b.recipe.amount] as [Good, number]]
        : [];
    const recipe = b.forestRemaining !== undefined
      ? `${GOOD_ICONS.wood} 1 Holz / ${b.recipe!.duration / CONFIG.simulationHz} s bei 1× · Vorrat <span data-field="forest-remaining"></span>/${CONFIG.forestYield}`
      : b.kind === "warehouse"
        ? "Lagert bis zu 20 Einheiten je Warentyp"
        : b.kind === "farm"
          ? `Ein Farmer bewirtschaftet bis zu ${CONFIG.farmMaxFields} zufällige Acker im Radius ${CONFIG.farmFieldRadius}. Säen und Ernten dauern je 10 s; nach der Ernte trägt der Farmer den Weizen zurück zur Farm.`
          : b.kind === "well"
            ? `${GOOD_ICONS.water} Unerschöpfliche Wasserquelle ohne zugewiesenen Arbeiter`
            : b.recipe
              ? `${recipeInputs.map(([good, amount]) => `${GOOD_ICONS[good]} ${amount} ${GOODS[good]}`).join(" + ")} → ${GOOD_ICONS[b.recipe.output]} 1 ${GOODS[b.recipe.output]}`
              : "Produktion";
    const inventory = b.forestRemaining !== undefined
      ? `<div><span>${goodLabel("wood")} · Output</span><strong data-field="output"></strong></div>`
      : b.kind === "warehouse"
        ? `${(["wood", "plank", "woodenTool", "wheat", "flour", "water", "bread"] as Good[]).map((good) => `<div><span>${goodLabel(good)}</span><strong data-field="warehouse-${good === "woodenTool" ? "tool" : good}"></strong></div>`).join("")}`
        : b.kind === "farm"
          ? `<div><span>${goodLabel("wheat")} · Output</span><strong data-field="output"></strong></div>`
          : b.kind === "well"
            ? `<div><span>${goodLabel("water")}</span><strong>∞</strong></div>`
            : `${recipeInputs.map(([good]) => `<div><span>${goodLabel(good)} · Input</span><strong data-field="input-${good}"></strong></div>`).join("")}${b.recipe ? `<div><span>${goodLabel(b.recipe.output)} · Output</span><strong data-field="output"></strong></div>` : ""}`;
    const merchantAssignment = b.kind === "warehouse"
      ? assignmentControl(b, "merchant", b.merchants ?? 0)
      : "";'''
text = regex_once(text, recipe_pattern, recipe_replacement, "generalized recipe UI")
text = replace_once(
    text,
    '''    document.querySelector("#metrics")!.innerHTML = `<div><small>BEV.</small><strong>${w.people.length}</strong></div><div><small>FREI</small><strong>${freePeople(w).length}</strong></div><div><small>WEIZEN</small><strong>${totalWarehouseStock(w, "wheat")}</strong></div><div><small>WERKZEUGE</small><strong>${totalWarehouseStock(w, "woodenTool")}</strong></div>`;''',
    '''    document.querySelector("#metrics")!.innerHTML = `<div><small>👥 BEV.</small><strong>${w.people.length}</strong></div><div><small>👤 FREI</small><strong>${freePeople(w).length}</strong></div><div><small>${GOOD_ICONS.wheat} WEIZEN</small><strong>${totalWarehouseStock(w, "wheat")}</strong></div><div><small>${GOOD_ICONS.bread} BROT</small><strong>${totalWarehouseStock(w, "bread")}</strong></div>`;''',
    "top metrics icons",
)
text = replace_once(
    text,
    '            ? `${building(w, p.assignment.building).name} · ${building(w, p.assignment.building).kind === "farm" && p.assignment.role === "worker" ? "Farmer" : roleLabel(p.assignment.role)}`',
    '            ? `${building(w, p.assignment.building).name} · ${p.assignment.role === "worker" ? workerLabel(building(w, p.assignment.building)) : roleLabel(p.assignment.role)}`',
    "debug worker label",
)
text = replace_once(
    text,
    '? `${p.trip.picked ? "Bringt" : "Holt"} ${GOODS[p.trip.good]} · ${building(w, p.trip.picked ? p.trip.target : p.trip.source).name}`',
    '? `${p.trip.picked ? "Bringt" : "Holt"} ${GOOD_ICONS[p.trip.good]} ${GOODS[p.trip.good]} · ${building(w, p.trip.picked ? p.trip.target : p.trip.source).name}`',
    "debug cargo icons",
)
text = replace_once(
    text,
    '      return `<tr><td>${p.id}</td><td>${assignment}</td><td>${state}</td></tr>`;',
    '      return `<tr><td><span class="person-id"><span aria-hidden="true">${personIcon(p.id)}</span><span>${p.id}</span></span></td><td>${assignment}</td><td>${state}</td></tr>`;',
    "debug person icons",
)
write(path, text)


# --- map presentation ----------------------------------------------------
path = "src/game/MainScene.ts"
text = read(path)
text = replace_once(text, '  Hex,\n  Tile,', '  Hex,\n  Person,\n  Tile,', "MainScene Person import")
text = replace_once(
    text,
    'import { CONFIG } from "../simulation/scenario";\n',
    'import { CONFIG } from "../simulation/scenario";\nimport { GOOD_ICONS } from "../icons";\n',
    "MainScene icon import",
)
text = replace_once(
    text,
    '''  woodenTool: 0xc8d8d0,
  wheat: 0xe3c766,
};''',
    '''  woodenTool: 0xc8d8d0,
  wheat: 0xe3c766,
  flour: 0xf0e4c8,
  water: 0x77b9d4,
  bread: 0xb8793d,
};''',
    "good colors",
)
text = replace_once(
    text,
    '''    if (b.kind === "carpenter") return `${prefix}SCHREINEREI`;
    if (b.kind === "warehouse") return `${prefix}LAGER`;''',
    '''    if (b.kind === "carpenter") return `${prefix}SCHREINEREI`;
    if (b.kind === "mill") return `${prefix}MÜHLE`;
    if (b.kind === "bakery") return `${prefix}BÄCKEREI`;
    if (b.kind === "well") return `${prefix}BRUNNEN`;
    if (b.kind === "warehouse") return `${prefix}LAGER`;''',
    "building labels",
)
method_anchor = '''  private drawMap(): void {'''
person_method = '''  private personMarker(p: Person): string {
    if (p.woodcutter) return "🪓";
    if (p.builder) return "🔨";
    if (p.assignment?.role === "merchant") return "🧭";
    if (p.assignment?.role === "carrier") return "📦";
    if (p.assignment?.role === "worker") {
      const workplace = this.world.buildings.find((b) => b.id === p.assignment!.building);
      if (workplace?.kind === "farm") return "🌾";
      if (workplace?.kind === "mill") return "⚙️";
      if (workplace?.kind === "bakery") return "🍞";
      if (workplace?.kind === "sawmill") return "🪵";
      if (workplace?.kind === "carpenter") return "🛠️";
    }
    return "👤";
  }

  private drawMap(): void {'''
text = replace_once(text, method_anchor, person_method, "person marker method")
old_person = '''      const label = this.add.text(x, y, String(p.id), {
        fontFamily: "system-ui",
        fontSize: "6px",
        color: "#ffffff",
      }).setResolution(TEXT_RESOLUTION).setOrigin(0.5);
      if (!p.assignment && !p.woodcutter && !p.builder) label.setColor("#24362b");
      this.markers.add([dot, label]);'''
new_person = '''      const label = this.add.text(x, y - 1, this.personMarker(p), {
        fontFamily: "system-ui",
        fontSize: "7px",
        color: "#ffffff",
      }).setResolution(TEXT_RESOLUTION).setOrigin(0.5);
      const idLabel = this.add.text(x + 4, y + 3, String(p.id), {
        fontFamily: "system-ui",
        fontSize: "4px",
        color: "#ffffff",
        backgroundColor: "#263c2d",
      }).setResolution(TEXT_RESOLUTION).setOrigin(0, 0.5);
      this.markers.add([dot, label, idLabel]);'''
text = replace_once(text, old_person, new_person, "map person icons")
text = replace_once(
    text,
    '''          { wood: "H", plank: "B", woodenTool: "W", wheat: "G" }[p.trip.good],''',
    '''          GOOD_ICONS[p.trip.good],''',
    "map cargo icons",
)
write(path, text)


# --- style ---------------------------------------------------------------
path = "src/style.css"
text = read(path)
text += '''

/* Shared icon language: SVG buildings, emoji goods and role markers. */
.building-heading {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.building-icon {
  display: inline-flex;
  width: 1.2em;
  height: 1.2em;
  flex: 0 0 auto;
  color: currentColor;
  vertical-align: -0.2em;
}

.building-icon svg {
  width: 100%;
  height: 100%;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
}

.build-choice-grid {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
}

.good-label,
.person-id {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

@media (max-width: 430px) {
  .build-choice-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .icon-button {
    min-width: 0;
  }
}
'''
write(path, text)


# --- docs ----------------------------------------------------------------
path = "concept.md"
text = read(path)
text = replace_once(
    text,
    '''- Sägewerk: 6 Kacheln,
- Schreinerei: 4 Kacheln.''',
    '''- Sägewerk: 6 Kacheln,
- Schreinerei: 4 Kacheln,
- Mühle: 4 Kacheln,
- Bäckerei: 4 Kacheln,
- Brunnen: 4 Kacheln.''',
    "concept footprints",
)
text = replace_once(
    text,
    '''- Sägewerk: 6 Holz,
- Schreinerei: 4 Bretter.''',
    '''- Sägewerk: 6 Holz,
- Schreinerei: 4 Bretter,
- Mühle: 4 Holz,
- Bäckerei: 4 Bretter,
- Brunnen: 4 Holz.''',
    "concept construction",
)
text = replace_once(
    text,
    '''- Farm: Farmer bewirtschaftet bis zu vier umliegende Acker und erzeugt nach der Ernte je Acker 1 Weizen.
- Lager: Träger sammeln verfügbare Waren aus nahe gelegenen Produktions- und Rohstofforten ein.''',
    '''- Farm: Farmer bewirtschaftet bis zu vier umliegende Acker und erzeugt nach der Ernte je Acker 1 Weizen.
- Mühle: 1 Weizen → 1 Mehl in ca. 4 Sekunden; ein Müller arbeitet dort.
- Bäckerei: 1 Mehl + 1 Wasser → 1 Brot in ca. 4 Sekunden; ein Bäcker arbeitet dort.
- Brunnen: unerschöpfliche Wasserquelle ohne zugewiesenen Arbeiter. Bäcker und Lager-Träger können dort Wasser holen.
- Lager: Träger sammeln verfügbare Waren aus nahe gelegenen Produktions- und Rohstofforten ein.''',
    "concept bread chain",
)
text = replace_once(
    text,
    '''- Holz,
- Bretter,
- Holzwerkzeuge,
- Weizen.''',
    '''- Holz,
- Bretter,
- Holzwerkzeuge,
- Weizen,
- Mehl,
- Wasser,
- Brot.''',
    "concept warehouse goods",
)
text = replace_once(
    text,
    'Frei baubar und abreißbar sind Lager, Farm, Sägewerk und Schreinerei, einschließlich unfertiger Baustellen.',
    'Frei baubar und abreißbar sind Lager, Farm, Sägewerk, Schreinerei, Mühle, Bäckerei und Brunnen, einschließlich unfertiger Baustellen.',
    "concept demolishable",
)
text = replace_once(
    text,
    '''- Debug-Personenliste zeigt Farmeraktionen wie Säen, Düngen und Ernten.''',
    '''- Debug-Personenliste zeigt Farmeraktionen wie Säen, Düngen und Ernten.
- Waren verwenden, wo sinnvoll, Emojis zusammen mit Zahl und Text; Gebäude verwenden ein einheitliches kleines SVG-Icon-Set.
- Personen werden auf der Karte zusätzlich über Rollen-Icons erkennbar und nicht mehr nur über ihre ID dargestellt.''',
    "concept icons",
)
write(path, text)

path = "architecture.md"
text = read(path)
text = replace_once(
    text,
    'Goods currently include wood, plank, woodenTool and wheat.',
    'Goods currently include wood, plank, woodenTool, wheat, flour, water and bread. Recipes support both the existing single-input representation and a multi-input map for chains such as flour + water → bread.',
    "architecture goods",
)
text = replace_once(
    text,
    'User-facing buildable kinds are warehouse, farm, sawmill and carpenter. The HQ is multi-tile in the initial scenario.',
    'User-facing buildable kinds are warehouse, farm, sawmill, carpenter, mill, bakery and well. The HQ is multi-tile in the initial scenario.',
    "architecture building kinds",
)
text = replace_once(
    text,
    '''Sawmill     6 tiles
Carpenter   4 tiles''',
    '''Sawmill     6 tiles
Carpenter   4 tiles
Mill        4 tiles
Bakery      4 tiles
Well        4 tiles''',
    "architecture footprint table",
)
text = replace_once(
    text,
    '''Sawmill     6 wood    → 15 s base build time
Carpenter   4 planks  → 11 s base build time''',
    '''Sawmill     6 wood    → 15 s base build time
Carpenter   4 planks  → 11 s base build time
Mill        4 wood    → 11 s base build time
Bakery      4 planks  → 11 s base build time
Well        4 wood    → 11 s base build time''',
    "architecture construction table",
)
text = replace_once(
    text,
    '''- carpenter: 2 plank → 1 wooden tool / ~4 seconds.''',
    '''- carpenter: 2 plank → 1 wooden tool / ~4 seconds.
- mill: 1 wheat → 1 flour / ~4 seconds.
- bakery: 1 flour + 1 water → 1 bread / ~4 seconds.
- well: infinite water source with no worker and no production timer.''',
    "architecture recipes",
)
text = replace_once(
    text,
    'Warehouses have local per-good inventory with capacity 20 for wood, planks, wooden tools and wheat.',
    'Warehouses have local per-good inventory with capacity 20 for wood, planks, wooden tools, wheat, flour, water and bread. Water can be collected from wells; wells themselves are not depleted by pickup.',
    "architecture warehouse goods",
)
text = replace_once(
    text,
    '''- farm is offered in the building choices,
- a finished farm exposes one worker slot labelled Farmer,''',
    '''- farm, mill, bakery and well are offered in the building choices,
- a finished farm exposes one worker slot labelled Farmer; mill and bakery expose Müller and Bäcker worker labels; well has no worker slot,''',
    "architecture DOM buildings",
)
text = replace_once(
    text,
    '''- merchant goods include wheat,
- top metrics include total wheat stored in completed warehouses,''',
    '''- merchant goods include wheat, flour, water and bread,
- top metrics include total wheat and bread stored in completed warehouses,
- goods use emoji markers alongside labels/counts where appropriate; building controls and headings use shared inline SVG icons; map people use role markers plus their numeric ID,''',
    "architecture icons",
)
write(path, text)


# --- tests ---------------------------------------------------------------
test_file = '''import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld } from "../src/simulation/scenario";
import {
  assigned,
  buildAt,
  changeAssignment,
  tick,
  warehouseStock,
} from "../src/simulation/simulation";

const activateWorker = (world: ReturnType<typeof createWorld>, buildingId: string) => {
  const worker = assigned(world, buildingId, "worker")[0]!;
  const workplace = world.buildings.find((b) => b.id === buildingId)!;
  worker.position = { ...workplace.position };
  worker.path = [];
  worker.movement = 0;
  worker.active = true;
  return worker;
};

test("mill and bakery turn wheat plus well water into bread", () => {
  const world = createWorld(4);
  const warehouse = buildAt(world, { q: 0, r: 0 }, "warehouse")!;
  const mill = buildAt(world, { q: 2, r: 0 }, "mill")!;
  const bakery = buildAt(world, { q: 4, r: 0 }, "bakery")!;
  const well = buildAt(world, { q: 6, r: 0 }, "well")!;
  warehouse.inventory!.wheat = 4;

  assert.equal(changeAssignment(world, mill.id, "worker", 1), true);
  assert.equal(changeAssignment(world, bakery.id, "worker", 1), true);
  activateWorker(world, mill.id);
  activateWorker(world, bakery.id);

  for (let i = 0; i < 6000 && bakery.output === 0; i++) tick(world);

  assert.ok(mill.output > 0 || bakery.inputInventory!.flour > 0 || bakery.output > 0);
  assert.ok((bakery.inputInventory?.water ?? 0) >= 0);
  assert.ok(bakery.output > 0, "expected bread to be produced");
  assert.equal(well.output, 0, "well water must not be depleted");
});

test("warehouse carriers can collect water from a well", () => {
  const world = createWorld(2);
  const warehouse = buildAt(world, { q: 0, r: 0 }, "warehouse")!;
  const well = buildAt(world, { q: 2, r: 0 }, "well")!;
  assert.equal(changeAssignment(world, warehouse.id, "carrier", 1), true);
  const carrier = assigned(world, warehouse.id, "carrier")[0]!;
  carrier.position = { ...warehouse.position };
  carrier.path = [];
  carrier.movement = 0;
  carrier.active = true;

  for (let i = 0; i < 1200 && warehouseStock(warehouse, "water") === 0; i++) tick(world);

  assert.ok(warehouseStock(warehouse, "water") > 0);
  assert.equal(well.output, 0);
});
'''
write("tests/bread-chain.test.ts", test_file)

# The workflow and script are temporary scaffolding; remove them in the generated commit.
(ROOT / ".github/workflows/apply-bread-chain.yml").unlink(missing_ok=True)
Path(__file__).unlink(missing_ok=True)
print("Bread-chain patch applied")
