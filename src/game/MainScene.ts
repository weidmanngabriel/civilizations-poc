import Phaser from "phaser";
import type { Building, BuildingId, Good, Hex, World } from "../simulation/model";
import { key, same } from "../simulation/hex";
import { CONFIG } from "../simulation/scenario";

const HEX_X = 44;
const HEX_Y = 39;
const HEX_RADIUS = 25;
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
const pixel = (h: Hex) => ({
  x: 48 + HEX_X * (h.q + h.r / 2),
  y: 48 + h.r * HEX_Y,
});
const colors = {
  grass: 0x526b42,
  road: 0xc0a375,
  forest: 0x3f623d,
  mountain: 0x727b72,
  river: 0x43879a,
  building: 0xe6ce94,
};
const goodColors: Record<Good, number> = {
  wood: 0x6f4a2d,
  plank: 0xd4a763,
  woodenTool: 0xc8d8d0,
};

type PointerPosition = { x: number; y: number };
type CameraSnapshot = { scrollX: number; scrollY: number; zoom: number };
type MerchantTargetModeDetail = { active: boolean; sourceId?: BuildingId };

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
    window.addEventListener(SELECTION_CLEARED_EVENT, clearSelection);
    window.addEventListener(BUILDING_SELECTION_REQUESTED_EVENT, selectRequestedBuilding);
    window.addEventListener(MERCHANT_TARGET_MODE_EVENT, setMerchantTargetMode);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(SELECTION_CLEARED_EVENT, clearSelection);
      window.removeEventListener(BUILDING_SELECTION_REQUESTED_EVENT, selectRequestedBuilding);
      window.removeEventListener(MERCHANT_TARGET_MODE_EVENT, setMerchantTargetMode);
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

  private selectAtScreenPoint(screenX: number, screenY: number): void {
    const worldPoint = this.cameras.main.getWorldPoint(screenX, screenY);
    const candidate = this.world.buildings
      .filter((building) => !building.retired)
      .map((building) => ({
        building,
        distance: Phaser.Math.Distance.Between(
          worldPoint.x,
          worldPoint.y,
          pixel(building.position).x,
          pixel(building.position).y,
        ),
      }))
      .filter(({ distance }) => distance <= HEX_RADIUS + 5)
      .sort((a, b) => a.distance - b.distance)[0];

    if (this.merchantTargetSourceId) {
      if (
        candidate?.building.kind === "warehouse" &&
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
      window.dispatchEvent(new CustomEvent(BUILDING_SELECTED_EVENT, { detail: { id: candidate.building.id } }));
      return;
    }

    const tileCandidate = this.world.tiles
      .map((tile) => ({
        tile,
        distance: Phaser.Math.Distance.Between(
          worldPoint.x,
          worldPoint.y,
          pixel(tile).x,
          pixel(tile).y,
        ),
      }))
      .filter(({ distance }) => distance <= HEX_RADIUS + 2)
      .sort((a, b) => a.distance - b.distance)[0];
    if (!tileCandidate) return;
    this.selectedBuildingId = undefined;
    this.selectedTile = { q: tileCandidate.tile.q, r: tileCandidate.tile.r };
    this.renderWorld();
    window.dispatchEvent(new CustomEvent(TILE_SELECTED_EVENT, { detail: { position: this.selectedTile } }));
  }

  private setupCameraControls(): void {
    this.input.addPointer(2);
    const canvas = this.game.canvas;
    const preventCanvasWheel = (event: WheelEvent) => event.preventDefault();
    canvas.addEventListener("wheel", preventCanvasWheel, { passive: false });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener("wheel", preventCanvasWheel);
    });

    this.input.on("wheel", (pointer: Phaser.Input.Pointer, _over: Phaser.GameObjects.GameObject[], _dx: number, deltaY: number) => {
      this.zoomAt(pointer.x, pointer.y, this.cameras.main.zoom * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY));
    });

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const position = { x: pointer.x, y: pointer.y };
      this.activePointers.set(pointer.id, position);
      this.pointerDown.set(pointer.id, position);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const previous = this.activePointers.get(pointer.id);
      if (!previous) return;
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
    });

    const releasePointer = (pointer: Phaser.Input.Pointer) => {
      const start = this.pointerDown.get(pointer.id);
      const wasSinglePointer = this.activePointers.size === 1;
      this.activePointers.delete(pointer.id);
      this.pointerDown.delete(pointer.id);
      if (start && wasSinglePointer && Phaser.Math.Distance.Between(start.x, start.y, pointer.x, pointer.y) <= TAP_MAX_DISTANCE)
        this.selectAtScreenPoint(pointer.x, pointer.y);
    };
    this.input.on("pointerup", releasePointer);
    this.input.on("pointerupoutside", releasePointer);
  }

  private drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number, alpha = 1): void {
    g.fillStyle(0x29452f, alpha);
    g.fillTriangle(x - 5, y + 5, x, y - 7, x + 5, y + 5);
    g.fillStyle(0x5b442d, alpha);
    g.fillRect(x - 1, y + 4, 2, 5);
  }

  private buildingLabel(b: Building): string {
    if (b.kind === "forest") return "WALD";
    if (b.kind === "hq") return "HQ";
    if (b.kind === "sawmill") return "SÄGEWERK";
    if (b.kind === "carpenter") return "SCHREINEREI";
    if (b.kind === "warehouse") return "LAGER";
    return b.name.toUpperCase();
  }

  private drawMap(): void {
    if (!this.mapGraphics || !this.mapLabels) return;
    const g = this.mapGraphics;
    g.clear();
    this.mapLabels.removeAll(true);
    for (const tile of this.world.tiles) {
      const { x, y } = pixel(tile);
      const points = Array.from({ length: 6 }, (_, i) => new Phaser.Math.Vector2(
        x + HEX_RADIUS * Math.cos(((60 * i - 30) * Math.PI) / 180),
        y + HEX_RADIUS * Math.sin(((60 * i - 30) * Math.PI) / 180),
      ));
      g.fillStyle(colors[tile.terrain]);
      g.fillPoints(points, true);
      g.lineStyle(1, 0x20392c, 0.45);
      g.strokePoints(points, true);
      if (this.selectedTile && same(tile, this.selectedTile)) {
        g.lineStyle(3, 0xf4e5a4, 0.95);
        g.strokePoints(points, true);
      }
      if (tile.terrain === "mountain") {
        g.fillStyle(0xb4bab0);
        g.fillTriangle(x - 9, y + 7, x, y - 9, x + 9, y + 7);
      }
      if (tile.terrain === "river") {
        g.lineStyle(2, 0xafd3d3, 0.6);
        g.lineBetween(x - 9, y + 1, x + 9, y - 1);
      }
      if (tile.terrain === "grass") {
        g.lineStyle(1, 0x93a76e, 0.35);
        g.lineBetween(x - 2, y + 2, x - 4, y - 3);
        g.lineBetween(x - 2, y + 2, x + 1, y - 3);
      }
      if (tile.terrain === "forest") {
        this.drawTree(g, x - 5, y + 1);
        this.drawTree(g, x + 5, y - 2);
      }
    }

    for (const b of this.world.buildings.filter((building) => !building.retired)) {
      const { x, y } = pixel(b.position);
      this.mapLabels.add(this.add.text(x, y - 9, this.buildingLabel(b), {
        fontFamily: "system-ui", fontSize: "8px", fontStyle: "bold", color: "#203226",
      }).setResolution(TEXT_RESOLUTION).setOrigin(0.5));
      if (b.forestRemaining !== undefined) {
        this.drawTree(g, x, y - 17, Math.max(MIN_FOREST_ALPHA, b.forestRemaining / CONFIG.forestYield));
      } else {
        g.fillStyle(0x785d3e);
        g.fillRect(x - 5, y - 20, 10, 6);
        g.fillTriangle(x - 7, y - 20, x, y - 26, x + 7, y - 20);
      }
      if (b.id === this.selectedBuildingId) {
        g.lineStyle(3, 0xf4e5a4, 0.95);
        g.strokeCircle(x, y, HEX_RADIUS - 2);
      }
    }
  }

  private drawSlots(g: Phaser.GameObjects.Graphics, x: number, y: number, count: number, capacity: number, good: Good, columns: number): void {
    const size = 3;
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

  private drawMerchantTargetMode(): void {
    if (!this.targetModeOverlay || !this.targetModeHighlights) return;
    this.targetModeOverlay.clear();
    this.targetModeHighlights.removeAll(true);
    if (!this.merchantTargetSourceId) return;

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
    for (const warehouse of this.world.buildings.filter(
      (b) => !b.retired && b.kind === "warehouse" && b.id !== this.merchantTargetSourceId,
    )) {
      const { x, y } = pixel(warehouse.position);
      highlights.fillStyle(0xf5e8b8, 0.18);
      highlights.fillCircle(x, y, HEX_RADIUS + 4);
      highlights.lineStyle(4, 0xfff1a8, 1);
      highlights.strokeCircle(x, y, HEX_RADIUS + 1);
      highlights.fillStyle(0x785d3e, 1);
      highlights.fillRect(x - 5, y - 20, 10, 6);
      highlights.fillTriangle(x - 7, y - 20, x, y - 26, x + 7, y - 20);
      this.targetModeHighlights.add(this.add.text(x, y - 9, "LAGER", {
        fontFamily: "system-ui",
        fontSize: "8px",
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
    for (const b of this.world.buildings.filter((building) => !building.retired || (building.forestRemaining === 0 && building.output > 0))) {
      if (!b.recipe) continue;
      const { x, y } = pixel(b.position);
      if (b.recipe.input) {
        this.drawSlots(slots, x + 7, y - 5, b.input, CONFIG.inputCapacity, b.recipe.input, 5);
        this.markers.add(this.add.text(x + 7, y - 10, "IN", { fontFamily: "system-ui", fontSize: "6px", color: "#21372a" }).setResolution(TEXT_RESOLUTION));
      }
      this.drawSlots(slots, x + 7, b.recipe.input ? y + 5 : y - 1, b.output, CONFIG.outputCapacity, b.recipe.output, 3);
      this.markers.add(this.add.text(x + 7, b.recipe.input ? y + 9 : y + 3, "OUT", { fontFamily: "system-ui", fontSize: "6px", color: "#21372a" }).setResolution(TEXT_RESOLUTION));
    }

    const groups = new Map<string, number>();
    for (const p of this.world.people) {
      const k = key(p.position);
      const i = groups.get(k) ?? 0;
      groups.set(k, i + 1);
      const pos = pixel(p.position);
      const x = pos.x + ((i % 4) - 1.5) * 11;
      const y = pos.y + 1 + Math.floor(i / 4) * 11;
      const color = !p.assignment && !p.woodcutter ? 0xdde5db : p.assignment?.role === "worker" || p.woodcutter ? 0x234636 : 0x8b512e;
      const dot = this.add.circle(x, y, 5, color).setStrokeStyle(1, 0xffffff);
      const label = this.add.text(x, y, String(p.id), { fontFamily: "system-ui", fontSize: "7px", color: "#ffffff" }).setResolution(TEXT_RESOLUTION).setOrigin(0.5);
      if (!p.assignment && !p.woodcutter) label.setColor("#24362b");
      this.markers.add([dot, label]);
      if (p.trip?.picked)
        this.markers.add(this.add.text(x + 4, y - 7, { wood: "H", plank: "B", woodenTool: "W" }[p.trip.good], {
          fontFamily: "system-ui", fontSize: "7px", color: "#fff2a3", backgroundColor: "#263c2d",
        }).setResolution(TEXT_RESOLUTION));
    }
    this.drawMerchantTargetMode();
  }
}
