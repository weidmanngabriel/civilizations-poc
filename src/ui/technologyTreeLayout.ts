const NODE_WIDTH = 210;
const NODE_HEIGHT = 58;

type Point = { x: number; y: number };

type EdgeGeometry = {
  edge: SVGPathElement;
  from: string;
  to: string;
};

const LAYOUT: Record<string, Point> = {
  civil: { x: 60, y: 760 },

  wood: { x: 380, y: 60 },
  sawmill: { x: 720, y: 60 },
  sawmillWorker: { x: 1060, y: 60 },
  carp1: { x: 1400, y: 60 },
  carp2: { x: 1740, y: 60 },
  carp3: { x: 2080, y: 60 },

  clay: { x: 380, y: 200 },
  pot1: { x: 720, y: 200 },
  potter: { x: 1060, y: 200 },
  pot2: { x: 1400, y: 200 },
  pot3: { x: 1740, y: 200 },

  stone: { x: 380, y: 340 },
  mason1: { x: 720, y: 340 },
  mason: { x: 1060, y: 340 },
  mason2: { x: 1400, y: 340 },

  farmer: { x: 380, y: 500 },
  mill: { x: 720, y: 500 },
  miller: { x: 1060, y: 500 },
  bakery1: { x: 1400, y: 500 },
  baker: { x: 1740, y: 500 },
  bakery2: { x: 2080, y: 500 },
  brewer: { x: 2080, y: 610 },

  carrier: { x: 380, y: 700 },
  warehouse: { x: 720, y: 700 },
  merchant: { x: 1060, y: 700 },

  house: { x: 380, y: 860 },
  farmBuilding: { x: 720, y: 860 },
  well: { x: 1060, y: 860 },
  builder: { x: 1400, y: 860 },

  hunter: { x: 380, y: 1040 },
  tailor: { x: 720, y: 1040 },
  tailor1: { x: 1060, y: 1040 },
  tailor2: { x: 1400, y: 1040 },
  stockfarmer: { x: 720, y: 1150 },
  cattle: { x: 1060, y: 1150 },

  mushroom: { x: 380, y: 1290 },
  herb: { x: 720, y: 1290 },
  druid: { x: 1060, y: 1290 },
  alch1: { x: 1400, y: 1290 },
  alch2: { x: 1740, y: 1290 },
  temple: { x: 1400, y: 1400 },

  iron: { x: 380, y: 1460 },
  smith: { x: 720, y: 1460 },
  smith1: { x: 1060, y: 1460 },
  smith2: { x: 1400, y: 1460 },
  weaponHut: { x: 1740, y: 1460 },
  mintworker: { x: 1060, y: 1570 },
  gold: { x: 720, y: 1570 },
  mint: { x: 1400, y: 1570 },

  barracks: { x: 380, y: 1730 },
  soldier: { x: 720, y: 1730 },
  fisher: { x: 1060, y: 1730 },
  scout: { x: 1400, y: 1730 },
  school: { x: 1740, y: 1730 },

  carp4: { x: 2420, y: 60 },
  brewery: { x: 2420, y: 610 },
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