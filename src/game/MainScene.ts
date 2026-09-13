import Phaser from "phaser";
import type {
  BuildableBuildingKind,
  Building,
  BuildingId,
  Good,
  Hex,
  Person,
  Tile,
  World,
} from "../simulation/model";
import { key, same } from "../simulation/hex";
import { personWorldPosition } from "../simulation/movement";
import { CONFIG } from "../simulation/scenario";
import { GOOD_ICONS } from "../icons";
import {
  buildingFootprint,
  footprintAt,
  footprintRing,
  validBuildingAnchors,
} from "../simulation/buildingPlacement";

const HEX_X = 24;
const HEX_Y = 21;
const HEX_RADIUS = 14;
const TEXT_RESOLUTION = 3;
const MIN_FOREST_ALPHA = 0.35;
const MIN_CAMERA_ZOOM = 0.7;
const MAX_CAMERA_ZOOM = 3.5;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const TAP_MAX_DISTANCE = 8;
const TARGET_MODE_DIM_ALPHA = 0.22;
const BUILDING_SELECTED_EVENT = "poc-building-selected";
const TILE_SELECTED_EVENT = "poc-tile-selected";
const BUILDING_SELECTION_REQUESTED_EVENT = "poc-building-selection-requested";
const SELECTION_CLEARED_EVENT = "poc-building-selection-cleared";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";
const BUILD_MODE_EVENT = "poc-build-mode";
const BUILD_POSITION_SELECTED_EVENT = "poc-build-position-selected";

const pixel = (h: Hex) => ({
  x: 34 + HEX_X * (h.q + h.r / 2),
  y: 34 + h.r * HEX_Y,
});

const colors = {
  grass: 0x526b42,
  road: 0xc0a375,
  forest: 0x3f623d,
  field: 0x8a6f3f,
  mountain: 0x727b72,
  river: 0x43879a,
  building: 0xe6ce94,
};
const goodColors: Record<Good, number> = {
  wood: 0x6f4a2d,
  plank: 0xd4a763,
  woodenTool: 0xc8d8d0,
  wheat: 0xe3c766,
  flour: 0xf0e4c8,
  water: 0x77b9d4,
  bread: 0xb8793d,
  clay: 0x9b6a4d,
  rubble: 0x8b8f8c,
  brick: 0xb55d42,
  stoneBlock: 0xc8c8bd,
};

type PointerPosition = { x: number; y: number };
type CameraSnapshot = { scrollX: number; scrollY: number; zoom: number };
type MerchantTargetModeDetail = { active: boolean; sourceId?: BuildingId };
type BuildModeDetail = { active: boolean; kind?: BuildableBuildingKind };

const underConstruction = (b: Building): boolean =>
  Boolean(b.construction && !b.construction.complete);

export class MainScene extends Phaser.Scene {
  private mapGraphics?: Phaser.GameObjects.Graphics;
  private mapLabels?: Phaser.GameObjects.Container;
  private markers?: Phaser.GameObjects.Container;
  private targetModeOverlay?: Phaser.GameObjects.Graphics;
  private targetModeHighlights?: Phaser.GameObjects.Container;
  private activePointers = new Map<number, PointerPosition>();
  private pointerDown = new Map<number, PointerPosition>();
  private selectedBuildingId?: BuildingId;
  private selectedTile?: Hex;
  private merchantTargetSourceId?: BuildingId;
  private cameraBeforeMerchantTarget?: CameraSnapshot;
  private buildKind?: BuildableBuildingKind;
  private buildHover?: Hex;
  private buildPositionChosen = false;

  constructor(private world: World) {
    super("main");
  }

  create(): void {
    this.mapGraphics = this.add.graphics();
    this.mapLabels = this.add.container(0, 0);
    this.markers = this.add.container(0, 0);
    this.targetModeOverlay = this.add.graphics();
    this.targetModeHighlights = this.add.container(0, 0);
    this.setupCameraControls();

    const clearSelection = () => {
      this.selectedBuildingId = undefined;
      this.selectedTile = undefined;
      this.renderWorld();
    };
    const selectRequestedBuilding = (event: Event) => {
      this.selectedBuildingId = (event as CustomEvent<{ id: BuildingId }>).detail.id;
      this.selectedTile = undefined;
      this.renderWorld();
    };
    const setMerchantTargetMode = (event: Event) => {
      const detail = (event as CustomEvent<MerchantTargetModeDetail>).detail;
      const camera = this.cameras.main;
      if (detail.active && detail.sourceId) {
        if (!this.merchantTargetSourceId) {
          this.cameraBeforeMerchantTarget = {
            scrollX: camera.scrollX,
            scrollY: camera.scrollY,
            zoom: camera.zoom,
          };
        }
        this.merchantTargetSourceId = detail.sourceId;
      } else {
        this.merchantTargetSourceId = undefined;
        if (this.cameraBeforeMerchantTarget) {
          camera.setZoom(this.cameraBeforeMerchantTarget.zoom);
          camera.setScroll(
            this.cameraBeforeMerchantTarget.scrollX,
            this.cameraBeforeMerchantTarget.scrollY,
          );
          this.cameraBeforeMerchantTarget = undefined;
        }
      }
      this.renderWorld();
    };
    const setBuildMode = (event: Event) => {
      const detail = (event as CustomEvent<BuildModeDetail>).detail;
      this.buildKind = detail.active ? detail.kind : undefined;
      this.buildHover = undefined;
      this.buildPositionChosen = false;
      this.selectedBuildingId = undefined;
      this.selectedTile = undefined;
      this.renderWorld();
    };

    window.addEventListener(SELECTION_CLEARED_EVENT, clearSelection);
    window.addEventListener(BUILDING_SELECTION_REQUESTED_EVENT, selectRequestedBuilding);
    window.addEventListener(MERCHANT_TARGET_MODE_EVENT, setMerchantTargetMode);
    window.addEventListener(BUILD_MODE_EVENT, setBuildMode);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(SELECTION_CLEARED_EVENT, clearSelection);
      window.removeEventListener(BUILDING_SELECTION_REQUESTED_EVENT, selectRequestedBuilding);
      window.removeEventListener(MERCHANT_TARGET_MODE_EVENT, setMerchantTargetMode);
      window.removeEventListener(BUILD_MODE_EVENT, setBuildMode);
    });
    this.renderWorld();
  }

  private clampZoom(zoom: number): number {
    return Phaser.Math.Clamp(zoom, MIN_CAMERA_ZOOM, MAX_CAMERA_ZOOM);
  }

  private zoomAt(screenX: number, screenY: number, zoom: number): void {
    const camera = this.cameras.main;
    const worldBefore = camera.getWorldPoint(screenX, screenY);
    camera.setZoom(this.clampZoom(zoom));
    const worldAfter = camera.getWorldPoint(screenX, screenY);
    camera.scrollX += worldBefore.x - worldAfter.x;
    camera.scrollY += worldBefore.y - worldAfter.y;
  }

  private hexPoints(position: Hex): Phaser.Math.Vector2[] {
    const { x, y } = pixel(position);
    return Array.from({ length: 6 }, (_, i) => new Phaser.Math.Vector2(
      x + HEX_RADIUS * Math.cos(((60 * i - 30) * Math.PI) / 180),
      y + HEX_RADIUS * Math.sin(((60 * i - 30) * Math.PI) / 180),
    ));
  }

  private nearestTileAtScreenPoint(screenX: number, screenY: number): Tile | undefined {
    const worldPoint = this.cameras.main.getWorldPoint(screenX, screenY);
    return this.world.tiles
      .map((tile) => ({
        tile,
        distance: Phaser.Math.Distance.Between(
          worldPoint.x,
          worldPoint.y,
          pixel(tile).x,
          pixel(tile).y,
        ),
      }))
      .filter(({ distance }) => distance <= HEX_RADIUS + 3)
      .sort((a, b) => a.distance - b.distance)[0]?.tile;
  }

  private emitBuildPosition(): void {
    if (!this.buildHover) return;
    window.dispatchEvent(new CustomEvent(BUILD_POSITION_SELECTED_EVENT, {
      detail: { position: { ...this.buildHover } },
    }));
  }

  private updateBuildHover(screenX: number, screenY: number, notify = false): void {
    if (!this.buildKind) return;
    const tile = this.nearestTileAtScreenPoint(screenX, screenY);
    const next = tile ? { q: tile.q, r: tile.r } : undefined;
    if ((!next && !this.buildHover) || (next && this.buildHover && same(next, this.buildHover))) return;
    this.buildHover = next;
    if (notify) this.emitBuildPosition();
    this.renderWorld();
  }

  private selectAtScreenPoint(screenX: number, screenY: number): void {
    if (this.buildKind) {
      this.buildPositionChosen = true;
      this.updateBuildHover(screenX, screenY, true);
      return;
    }

    const worldPoint = this.cameras.main.getWorldPoint(screenX, screenY);
    const candidate = this.world.buildings
      .filter((building) => !building.retired && building.kind !== "field")
      .map((building) => ({
        building,
        distance: Math.min(...buildingFootprint(building).map((position) =>
          Phaser.Math.Distance.Between(
            worldPoint.x,
            worldPoint.y,
            pixel(position).x,
            pixel(position).y,
          ),
        )),
      }))
      .filter(({ distance }) => distance <= HEX_RADIUS + 4)
      .sort((a, b) => a.distance - b.distance)[0];

    if (this.merchantTargetSourceId) {
      if (
        candidate?.building.kind === "warehouse" &&
        !underConstruction(candidate.building) &&
        candidate.building.id !== this.merchantTargetSourceId
      ) {
        window.dispatchEvent(new CustomEvent(BUILDING_SELECTED_EVENT, {
          detail: { id: candidate.building.id },
        }));
      }
      return;
    }

    if (candidate) {
      this.selectedBuildingId = candidate.building.id;
      this.selectedTile = undefined;
      this.renderWorld();
      window.dispatchEvent(new CustomEvent(BUILDING_SELECTED_EVENT, {
        detail: { id: candidate.building.id },
      }));
      return;
    }

    const tileCandidate = this.nearestTileAtScreenPoint(screenX, screenY);
    if (!tileCandidate) return;
    this.selectedBuildingId = undefined;
    this.selectedTile = { q: tileCandidate.q, r: tileCandidate.r };
    this.renderWorld();
    window.dispatchEvent(new CustomEvent(TILE_SELECTED_EVENT, {
      detail: { position: this.selectedTile },
    }));
  }

  private isTouch(pointer: Phaser.Input.Pointer): boolean {
    return typeof TouchEvent !== "undefined" && pointer.event instanceof TouchEvent;
  }

  private setupCameraControls(): void {
    this.input.addPointer(2);
    const canvas = this.game.canvas;
    const preventCanvasWheel = (event: WheelEvent) => event.preventDefault();
    canvas.addEventListener("wheel", preventCanvasWheel, { passive: false });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener("wheel", preventCanvasWheel);
    });

    this.input.on("wheel", (
      pointer: Phaser.Input.Pointer,
      _over: Phaser.GameObjects.GameObject[],
      _dx: number,
      deltaY: number,
    ) => {
      this.zoomAt(
        pointer.x,
        pointer.y,
        this.cameras.main.zoom * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY),
      );
      if (this.buildKind && this.buildPositionChosen)
        this.updateBuildHover(pointer.x, pointer.y, true);
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const position = { x: pointer.x, y: pointer.y };
      this.activePointers.set(pointer.id, position);
      this.pointerDown.set(pointer.id, position);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const previous = this.activePointers.get(pointer.id);
      if (!previous) {
        if (this.buildKind && this.buildPositionChosen && !this.isTouch(pointer))
          this.updateBuildHover(pointer.x, pointer.y, true);
        return;
      }
      const oldPositions = [...this.activePointers.values()];
      this.activePointers.set(pointer.id, { x: pointer.x, y: pointer.y });
      const newPositions = [...this.activePointers.values()];
      const camera = this.cameras.main;
      if (oldPositions.length >= 2 && newPositions.length >= 2) {
        const [oldA, oldB] = oldPositions;
        const [newA, newB] = newPositions;
        if (!oldA || !oldB || !newA || !newB) return;
        const oldDistance = Phaser.Math.Distance.Between(oldA.x, oldA.y, oldB.x, oldB.y);
        const newDistance = Phaser.Math.Distance.Between(newA.x, newA.y, newB.x, newB.y);
        if (oldDistance <= 0) return;
        const oldCenter = { x: (oldA.x + oldB.x) / 2, y: (oldA.y + oldB.y) / 2 };
        const newCenter = { x: (newA.x + newB.x) / 2, y: (newA.y + newB.y) / 2 };
        const anchorWorld = camera.getWorldPoint(oldCenter.x, oldCenter.y);
        camera.setZoom(this.clampZoom(camera.zoom * (newDistance / oldDistance)));
        const movedAnchorWorld = camera.getWorldPoint(newCenter.x, newCenter.y);
        camera.scrollX += anchorWorld.x - movedAnchorWorld.x;
        camera.scrollY += anchorWorld.y - movedAnchorWorld.y;
        return;
      }
      if (newPositions.length === 1) {
        camera.scrollX -= (pointer.x - previous.x) / camera.zoom;
        camera.scrollY -= (pointer.y - previous.y) / camera.zoom;
      }
      if (this.buildKind && this.buildPositionChosen && !this.isTouch(pointer))
        this.updateBuildHover(pointer.x, pointer.y, true);
    });

    const releasePointer = (pointer: Phaser.Input.Pointer) => {
      const start = this.pointerDown.get(pointer.id);
      const wasSinglePointer = this.activePointers.size === 1;
      this.activePointers.delete(pointer.id);
      this.pointerDown.delete(pointer.id);
      if (
        start &&
        wasSinglePointer &&
        Phaser.Math.Distance.Between(start.x, start.y, pointer.x, pointer.y) <= TAP_MAX_DISTANCE
      ) {
        this.selectAtScreenPoint(pointer.x, pointer.y);
      }
    };
    this.input.on("pointerup", releasePointer);
    this.input.on("pointerupoutside", releasePointer);
  }

  private drawTree(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    alpha = 1,
  ): void {
    g.fillStyle(0x29452f, alpha);
    g.fillTriangle(x - 4, y + 4, x, y - 6, x + 4, y + 4);
    g.fillStyle(0x5b442d, alpha);
    g.fillRect(x - 1, y + 3, 2, 4);
  }

  private drawField(g: Phaser.GameObjects.Graphics, tile: Tile, x: number, y: number): void {
    const field = this.world.buildings.find(
      (b) => b.kind === "field" && !b.retired && same(b.position, tile),
    );
    const stage = field?.fieldStage ?? 1;
    const stalks = stage;
    g.lineStyle(1, 0xe4cf77, 0.9);
    for (let i = 0; i < stalks; i += 1) {
      const ox = (i - (stalks - 1) / 2) * 3;
      g.lineBetween(x + ox, y + 5, x + ox, y - 2 - stage);
    }
  }

  private buildingLabel(b: Building): string {
    if (b.kind === "hq") return "HQ";
    const prefix = underConstruction(b) ? "BAU: " : "";
    if (b.kind === "farm") return `${prefix}FARM`;
    if (b.kind === "sawmill") return `${prefix}SÄGEWERK`;
    if (b.kind === "carpenter") return `${prefix}SCHREINEREI`;
    if (b.kind === "mill") return `${prefix}MÜHLE`;
    if (b.kind === "bakery") return `${prefix}BÄCKEREI`;
    if (b.kind === "well") return `${prefix}BRUNNEN`;
    if (b.kind === "warehouse") return `${prefix}LAGER`;
    return `${prefix}${b.name.toUpperCase()}`;
  }

  private personMarker(p: Person): string {
    if (p.woodcutter) return "🪓";
    if (p.extractor === "clay") return "🟤";
    if (p.extractor === "stone") return "⛏️";
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
      if (workplace?.kind === "pottery") return "🧱";
      if (workplace?.kind === "stonemason") return "🪨";
    }
    return "👤";
  }

  private drawMap(): void {
    if (!this.mapGraphics || !this.mapLabels) return;
    const g = this.mapGraphics;
    g.clear();
    this.mapLabels.removeAll(true);
    for (const tile of this.world.tiles) {
      const { x, y } = pixel(tile);
      const points = this.hexPoints(tile);
      g.fillStyle(colors[tile.terrain]);
      g.fillPoints(points, true);
      g.lineStyle(1, 0x20392c, 0.38);
      g.strokePoints(points, true);
      if (this.selectedTile && same(tile, this.selectedTile)) {
        g.lineStyle(2, 0xf4e5a4, 0.95);
        g.strokePoints(points, true);
      }
      if (tile.terrain === "mountain") {
        g.fillStyle(0xb4bab0);
        g.fillTriangle(x - 6, y + 5, x, y - 6, x + 6, y + 5);
      }
      if (tile.terrain === "river") {
        g.lineStyle(1, 0xafd3d3, 0.6);
        g.lineBetween(x - 6, y + 1, x + 6, y - 1);
      }
      if (tile.terrain === "grass") {
        g.lineStyle(1, 0x93a76e, 0.3);
        g.lineBetween(x - 2, y + 2, x - 3, y - 2);
      }
      if (tile.terrain === "forest") {
        const forest = this.world.naturalResources.find(
          (resource) => resource.kind === "forest" && !resource.depleted && same(resource.position, tile),
        );
        const alpha = forest
          ? Math.max(MIN_FOREST_ALPHA, forest.remaining / CONFIG.forestYield)
          : 1;
        this.drawTree(g, x - 3, y + 1, alpha);
        this.drawTree(g, x + 3, y - 1, alpha);
      }
      const resource = this.world.naturalResources.find(
        (candidate) => !candidate.depleted && candidate.kind !== "forest" && same(candidate.position, tile),
      );
      if (resource?.kind === "clay") {
        g.fillStyle(0x9b6a4d, 0.95);
        g.fillCircle(x - 3, y + 1, 4);
        g.fillCircle(x + 3, y + 2, 3);
      } else if (resource?.kind === "stone") {
        g.fillStyle(0xaeb3af, 0.95);
        g.fillTriangle(x - 6, y + 5, x - 1, y - 4, x + 3, y + 5);
        g.fillTriangle(x, y + 5, x + 5, y - 2, x + 7, y + 5);
      }
      if (tile.terrain === "field") this.drawField(g, tile, x, y);
    }

    for (const b of this.world.buildings.filter(
      (building) => !building.retired && building.kind !== "field",
    )) {
      const { x, y } = pixel(b.position);
      this.mapLabels.add(this.add.text(x, y - 7, this.buildingLabel(b), {
        fontFamily: "system-ui",
        fontSize: "7px",
        fontStyle: "bold",
        color: "#203226",
      }).setResolution(TEXT_RESOLUTION).setOrigin(0.5));
      if (underConstruction(b)) {
        g.lineStyle(2, 0x785d3e, 0.95);
        g.strokeRect(x - 6, y - 18, 12, 8);
        g.lineBetween(x - 6, y - 18, x + 6, y - 10);
        g.lineBetween(x + 6, y - 18, x - 6, y - 10);
      } else {
        g.fillStyle(0x785d3e);
        g.fillRect(x - 4, y - 14, 8, 5);
        g.fillTriangle(x - 6, y - 14, x, y - 19, x + 6, y - 14);
      }
      if (b.id === this.selectedBuildingId) {
        for (const occupied of buildingFootprint(b)) {
          g.lineStyle(2, 0xf4e5a4, 0.95);
          g.strokePoints(this.hexPoints(occupied), true);
        }
      }
    }
  }

  private drawSlots(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    count: number,
    capacity: number,
    good: Good,
    columns: number,
  ): void {
    const size = 2;
    const gap = 1;
    for (let i = 0; i < capacity; i += 1) {
      const sx = x + (i % columns) * (size + gap);
      const sy = y + Math.floor(i / columns) * (size + gap);
      if (i < count) {
        g.fillStyle(goodColors[good], 1);
        g.fillRect(sx, sy, size, size);
      }
      g.lineStyle(1, 0x21372a, 0.8);
      g.strokeRect(sx, sy, size, size);
    }
  }

  private drawModalMapMode(): void {
    if (!this.targetModeOverlay || !this.targetModeHighlights) return;
    this.targetModeOverlay.clear();
    this.targetModeHighlights.removeAll(true);
    if (!this.merchantTargetSourceId && !this.buildKind) return;

    const xs = this.world.tiles.map((tile) => pixel(tile).x);
    const ys = this.world.tiles.map((tile) => pixel(tile).y);
    const minX = Math.min(...xs) - HEX_RADIUS * 2;
    const maxX = Math.max(...xs) + HEX_RADIUS * 2;
    const minY = Math.min(...ys) - HEX_RADIUS * 2;
    const maxY = Math.max(...ys) + HEX_RADIUS * 2;
    this.targetModeOverlay.fillStyle(0x102018, TARGET_MODE_DIM_ALPHA);
    this.targetModeOverlay.fillRect(minX, minY, maxX - minX, maxY - minY);

    const highlights = this.add.graphics();
    this.targetModeHighlights.add(highlights);

    if (this.buildKind) {
      const validAnchors = validBuildingAnchors(this.world, this.buildKind);
      const validAnchorKeys = new Set(validAnchors.map(key));
      for (const anchorPosition of validAnchors) {
        const tile = this.world.tiles.find((candidate) => same(candidate, anchorPosition));
        if (!tile) continue;
        const points = this.hexPoints(anchorPosition);
        highlights.fillStyle(colors[tile.terrain], 1);
        highlights.fillPoints(points, true);
        highlights.lineStyle(1, 0x20392c, 0.38);
        highlights.strokePoints(points, true);
        if (tile.terrain === "grass") {
          const { x, y } = pixel(tile);
          highlights.lineStyle(1, 0x93a76e, 0.3);
          highlights.lineBetween(x - 2, y + 2, x - 3, y - 2);
        }
      }

      if (!this.buildHover) return;
      const valid = validAnchorKeys.has(key(this.buildHover));
      const footprint = footprintAt(this.buildKind, this.buildHover);
      for (const position of footprint) {
        highlights.fillStyle(valid ? 0xb8e69f : 0xe18b7d, 0.48);
        highlights.fillPoints(this.hexPoints(position), true);
        highlights.lineStyle(2, valid ? 0xdfffcf : 0xffb0a5, 1);
        highlights.strokePoints(this.hexPoints(position), true);
      }
      for (const position of footprintRing(footprint)) {
        highlights.lineStyle(1, valid ? 0xf8e8aa : 0xe18b7d, 0.65);
        highlights.strokePoints(this.hexPoints(position), true);
      }
      const anchor = pixel(this.buildHover);
      highlights.fillStyle(0x785d3e, 0.8);
      highlights.fillRect(anchor.x - 5, anchor.y - 14, 10, 5);
      highlights.fillTriangle(
        anchor.x - 7,
        anchor.y - 14,
        anchor.x,
        anchor.y - 21,
        anchor.x + 7,
        anchor.y - 14,
      );
      return;
    }

    for (const warehouse of this.world.buildings.filter(
      (b) =>
        !b.retired &&
        b.kind === "warehouse" &&
        !underConstruction(b) &&
        b.id !== this.merchantTargetSourceId,
    )) {
      for (const occupied of buildingFootprint(warehouse)) {
        highlights.fillStyle(0xf5e8b8, 0.18);
        highlights.fillPoints(this.hexPoints(occupied), true);
        highlights.lineStyle(2, 0xfff1a8, 1);
        highlights.strokePoints(this.hexPoints(occupied), true);
      }
      const { x, y } = pixel(warehouse.position);
      this.targetModeHighlights.add(this.add.text(x, y - 7, "LAGER", {
        fontFamily: "system-ui",
        fontSize: "7px",
        fontStyle: "bold",
        color: "#fff4bf",
        backgroundColor: "#314333",
      }).setResolution(TEXT_RESOLUTION).setOrigin(0.5));
    }
  }

  renderWorld(): void {
    if (!this.markers) return;
    this.drawMap();
    this.markers.removeAll(true);
    const slots = this.add.graphics();
    this.markers.add(slots);
    for (const b of this.world.buildings.filter(
      (building) =>
        (!building.retired || building.output > 0) &&
        !underConstruction(building),
    )) {
      const outputGood = b.kind === "farm" ? "wheat" : b.recipe?.output;
      if (!outputGood) continue;
      const { x, y } = pixel(b.position);
      if (b.recipe?.input) {
        this.drawSlots(slots, x + 5, y - 4, b.input, CONFIG.inputCapacity, b.recipe.input, 5);
        this.markers.add(this.add.text(x + 5, y - 9, "IN", {
          fontFamily: "system-ui",
          fontSize: "5px",
          color: "#21372a",
        }).setResolution(TEXT_RESOLUTION));
      }
      this.drawSlots(
        slots,
        x + 5,
        b.recipe?.input ? y + 3 : y - 1,
        b.output,
        CONFIG.outputCapacity,
        outputGood,
        3,
      );
      this.markers.add(this.add.text(x + 5, b.recipe?.input ? y + 7 : y + 3, "OUT", {
        fontFamily: "system-ui",
        fontSize: "5px",
        color: "#21372a",
      }).setResolution(TEXT_RESOLUTION));
    }

    for (const resource of this.world.naturalResources.filter((candidate) => candidate.output > 0)) {
      const { x, y } = pixel(resource.position);
      const good: Good = resource.kind === "forest" ? "wood" : resource.kind === "clay" ? "clay" : "rubble";
      this.drawSlots(slots, x + 5, y - 1, resource.output, CONFIG.resourceOutputCapacity, good, 3);
      this.markers.add(this.add.text(x + 5, y + 3, "OUT", {
        fontFamily: "system-ui",
        fontSize: "5px",
        color: "#21372a",
      }).setResolution(TEXT_RESOLUTION));
    }

    const groups = new Map<string, number>();
    for (const p of this.world.people) {
      const moving = p.path.length > 0;
      const k = key(p.position);
      const i = groups.get(k) ?? 0;
      groups.set(k, i + 1);
      const pos = pixel(personWorldPosition(this.world, p));
      const x = pos.x + (moving ? ((p.id % 3) - 1) * 2 : ((i % 4) - 1.5) * 8);
      const y = pos.y + (moving ? 1 : 1 + Math.floor(i / 4) * 8);
      const color = !p.assignment && !p.woodcutter && !p.extractor && !p.builder
        ? 0xdde5db
        : p.assignment?.role === "worker" || p.woodcutter
          ? 0x234636
          : 0x8b512e;
      const dot = this.add.circle(x, y, 4, color).setStrokeStyle(1, 0xffffff);
      const label = this.add.text(x, y - 1, this.personMarker(p), {
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
      this.markers.add([dot, label, idLabel]);
      if (p.trip?.picked)
        this.markers.add(this.add.text(
          x + 3,
          y - 6,
          GOOD_ICONS[p.trip.good],
          {
            fontFamily: "system-ui",
            fontSize: "6px",
            color: "#fff2a3",
            backgroundColor: "#263c2d",
          },
        ).setResolution(TEXT_RESOLUTION));
    }
    this.drawModalMapMode();
  }
}
