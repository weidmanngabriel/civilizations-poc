import type { BuildingKind, Good } from "./simulation/model";

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
  house: svg('<path d="M4 11 12 4l8 7v9H4v-9Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 20v-6h6v6M7 11h10" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
  farm: svg('<path d="M4 20V9l8-5 8 5v11H4Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 20v-7h8v7M2 20h20" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6 7c2 1 3 2 4 4M18 7c-2 1-3 2-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
  sawmill: svg('<path d="M3 20h18M5 20v-8h10v8M15 15h4v5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 8v8M6 12h8" stroke="currentColor" stroke-width="1.4"/>'),
  carpenter: svg('<path d="M4 19 16 7M8 5l11 11M5 8l3-3 11 11-3 3L5 8Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 19h6" stroke="currentColor" stroke-width="1.8"/>'),
  mill: svg('<path d="M8 20h8l-1-10H9L8 20Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 6V2M14 8h4M12 10v4M10 8H6" stroke="currentColor" stroke-width="1.6"/>'),
  bakery: svg('<path d="M4 20V9l8-5 8 5v11H4Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 20v-6c0-3 2-5 5-5s5 2 5 5v6M8 15h8" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
  well: svg('<path d="M5 9h14M7 9v11m10-11v11M4 20h16M8 9l4-5 4 5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 12h4v5h-4z" fill="none" stroke="currentColor" stroke-width="1.5"/>'),
};

export const buildingIcon = (kind: BuildingKind): string =>
  BUILDING_SVG[kind] ? `<span class="building-icon">${BUILDING_SVG[kind]}</span>` : "";
