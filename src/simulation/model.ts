export type Good = "wood" | "plank" | "woodenTool";
export type BuildingId =
  "hq" | "forest" | "sawmill" | "carpenter" | "warehouse";
export type Role = "worker" | "carrier";
export interface Hex {
  q: number;
  r: number;
}
export interface Tile extends Hex {
  terrain: "grass" | "road" | "mountain" | "river" | "building";
}
export interface Recipe {
  input?: Good;
  amount: number;
  output: Good;
  duration: number;
}
export interface Building {
  id: BuildingId;
  name: string;
  position: Hex;
  workers: number;
  carriers: number;
  recipe?: Recipe;
  input: number;
  output: number;
}
export interface Trip {
  source: BuildingId;
  target: BuildingId;
  good: Good;
  picked: boolean;
}
export interface Person {
  id: number;
  position: Hex;
  assignment?: { building: BuildingId; role: Role };
  active: boolean;
  progress: number;
  path: Hex[];
  trip?: Trip;
}
export interface World {
  round: number;
  nextId: number;
  people: Person[];
  buildings: Building[];
  tiles: Tile[];
}
