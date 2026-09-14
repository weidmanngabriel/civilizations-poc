const NODE_WIDTH = 210;
const NODE_HEIGHT = 58;

type Point = { x: number; y: number };

type EdgeGeometry = {
  edge: SVGPathElement;
  from: string;
  to: string;
};

const LAYOUT: Record<string, Point> = {
  civil: { x: 40, y: 720 },

  wood: { x: 360, y: 40 },
  sawmill: { x: 650, y: 40 },
  sawmillWorker: { x: 940, y: 40 },
  carp1: { x: 1230, y: 40 },
  carp2: { x: 1520, y: 40 },
  carp3: { x: 1810, y: 40 },
  carp4: { x: 2100, y: 40 },

  clay: { x: 360, y: 160 },
  pot1: { x: 650, y: 160 },
  potter: { x: 940, y: 160 },
  pot2: { x: 1230, y: 160 },
  pot3: { x: 1520, y: 160 },

  stone: { x: 360, y: 280 },
  mason1: { x: 650, y: 280 },
  mason: { x: 940, y: 280 },
  mason2: { x: 1230, y: 280 },

  farmer: { x: 360, y: 430 },
  mill: { x: 650, y: 430 },
  miller: { x: 940, y: 430 },
  bakery1: { x: 1230, y: 430 },
  baker: { x: 1520, y: 430 },
  bakery2: { x: 1810, y: 430 },
  brewer: { x: 1810, y: 520 },
  brewery: { x: 2100, y: 520 },

  carrier: { x: 360, y: 620 },
  warehouse: { x: 650, y: 620 },
  merchant: { x: 940, y: 620 },

  house: { x: 360, y: 790 },
  farmBuilding: { x: 650, y: 790 },
  well: { x: 940, y: 790 },
  builder: { x: 1230, y: 790 },

  hunter: { x: 360, y: 950 },
  tailor: { x: 650, y: 950 },
  tailor1: { x: 940, y: 950 },
  tailor2: { x: 1230, y: 950 },
  stockfarmer: { x: 650, y: 1040 },
  cattle: { x: 940, y: 1040 },

  mushroom: { x: 360, y: 1160 },
  herb: { x: 650, y: 1160 },
  druid: { x: 940, y: 1160 },
  alch1: { x: 1230, y: 1160 },
  alch2: { x: 1520, y: 1160 },
  temple: { x: 1230, y: 1250 },

  iron: { x: 360, y: 1310 },
  smith: { x: 650, y: 1310 },
  smith1: { x: 940, y: 1310 },
  smith2: { x: 1230, y: 1310 },
  weaponHut: { x: 1520, y: 1310 },
  gold: { x: 650, y: 1400 },
  mintworker: { x: 940, y: 1400 },
  mint: { x: 1230, y: 1400 },

  barracks: { x: 1520, y: 790 },
  soldier: { x: 1810, y: 790 },
  fisher: { x: 1520, y: 950 },
  scout: { x: 1810, y: 950 },
  school: { x: 2100, y: 950 },
};

const parsePathStart = (edge: SVGPathElement): Point | undefined => {
  const path = edge.getAttribute("d") ?? "";
  const match = path.match(/^M\s+([\d.-]+)\s+([\d.-]+)/);
  if (!match) return undefined;
  return { x: Number(match[1]), y: Number(match[2]) };
};

const currentNodePosition = (node: HTMLElement): Point => ({
  x: Number.parseFloat(node.style.left),
  y: Number.parseFloat(node.style.top),
});

const inferSourceNode = (
  edge: SVGPathElement,
  nodes: Map<string, HTMLElement>,
): string | undefined => {
  const start = parsePathStart(edge);
  if (!start) return undefined;
  let best: { id: string; distance: number } | undefined;
  nodes.forEach((node, id) => {
    const position = currentNodePosition(node);
    const x = position.x + NODE_WIDTH;
    const y = position.y + NODE_HEIGHT / 2;
    const distance = Math.hypot(start.x - x, start.y - y);
    if (!best || distance < best.distance) best = { id, distance };
  });
  return best?.distance !== undefined && best.distance < 3 ? best.id : undefined;
};

const edgePath = (from: Point, to: Point): string => {
  const x1 = from.x + NODE_WIDTH;
  const y1 = from.y + NODE_HEIGHT / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_HEIGHT / 2;
  const mid = x1 + Math.max(55, (x2 - x1) / 2);
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
};

export function applyTechnologyTreeLayout(): void {
  const canvas = document.querySelector<HTMLElement>(".technology-tree-canvas");
  if (!canvas) return;

  const nodes = new Map<string, HTMLElement>();
  canvas.querySelectorAll<HTMLElement>("[data-node]").forEach((node) => {
    const id = node.dataset.node;
    if (id) nodes.set(id, node);
  });

  const edgeGeometry: EdgeGeometry[] = [];
  canvas.querySelectorAll<SVGPathElement>("[data-tech-to]").forEach((edge) => {
    const to = edge.dataset.techTo;
    const from = inferSourceNode(edge, nodes);
    if (from && to) edgeGeometry.push({ edge, from, to });
  });

  nodes.forEach((node, id) => {
    const position = LAYOUT[id];
    if (!position) return;
    node.style.left = `${position.x}px`;
    node.style.top = `${position.y}px`;
  });

  for (const { edge, from, to } of edgeGeometry) {
    const fromPosition = LAYOUT[from];
    const toPosition = LAYOUT[to];
    if (!fromPosition || !toPosition) continue;
    edge.setAttribute("d", edgePath(fromPosition, toPosition));
  }
}