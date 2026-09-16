import Phaser from "phaser";
import { MainScene } from "./MainScene";
import type { Building, Good, Person, Tile, World } from "../simulation/model";
import { CONFIG } from "../simulation/scenario";
import { personName } from "../simulation/personIdentity";
import { personActivityLabel, personProfessionLabel } from "../personPresentation";
import { GOOD_ICONS } from "../icons";
import { pixel } from "./mapGeometry";
import {
  PERSON_MARKER_RADIUS,
  personMarkerPositions,
} from "./personMarkerGeometry";

const TEXT_RESOLUTION = 3;
const PERSON_TEXT_RESOLUTION = 4;
const PERSON_NAME_SCALE = 0.34;
const PERSON_DETAIL_SCALE = 0.28;
const CARGO_SCALE = 0.28;

const terrainCodes: Record<Tile["terrain"], number> = {
  grass: 1,
  road: 2,
  forest: 3,
  field: 4,
  mountain: 5,
  river: 6,
  building: 7,
};

const underConstruction = (building: Building): boolean =>
  Boolean(building.construction && !building.construction.complete);

type MainSceneInternals = {
  markers?: Phaser.GameObjects.Container;
  selectedBuildingId?: string;
  selectedTile?: { q: number; r: number };
  merchantTargetSourceId?: string;
  buildKind?: string;
  buildHover?: { q: number; r: number };
  drawMap: () => void;
  drawSlots: (
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    count: number,
    capacity: number,
    good: Good,
    columns: number,
  ) => void;
  personMarker: (person: Person) => string;
  drawModalMapMode: () => void;
};

type PersonMarkerObjects = {
  dot: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  nameLabel: Phaser.GameObjects.Text;
  detailLabel: Phaser.GameObjects.Text;
  cargo: Phaser.GameObjects.Text;
};

/**
 * Keeps MainScene's input and drawing rules, but avoids rebuilding the complete
 * Phaser display tree on every presentation frame.
 */
export class IncrementalMainScene extends MainScene {
  private bushGraphics?: Phaser.GameObjects.Graphics;
  private inventoryGraphics?: Phaser.GameObjects.Graphics;
  private inventoryLabels?: Phaser.GameObjects.Container;
  private personLayer?: Phaser.GameObjects.Container;
  private personMarkers = new Map<number, PersonMarkerObjects>();
  private lastMapSignature = "";
  private lastBushSignature = "";
  private lastInventorySignature = "";
  private lastModalSignature = "";

  constructor(private readonly worldRef: World) {
    super(worldRef);
  }

  private internals(): MainSceneInternals {
    return this as unknown as MainSceneInternals;
  }

  private ensureLayers(): boolean {
    const markers = this.internals().markers;
    if (!markers) return false;
    if (this.inventoryGraphics) return true;

    this.bushGraphics = this.add.graphics();
    this.inventoryGraphics = this.add.graphics();
    this.inventoryLabels = this.add.container(0, 0);
    this.personLayer = this.add.container(0, 0);
    markers.add([this.bushGraphics, this.inventoryGraphics, this.inventoryLabels, this.personLayer]);
    return true;
  }

  private mapSignature(): string {
    let terrainHash = 2166136261;
    for (const tile of this.worldRef.tiles) {
      terrainHash ^= terrainCodes[tile.terrain];
      terrainHash = Math.imul(terrainHash, 16777619) >>> 0;
    }

    const buildings = this.worldRef.buildings
      .map((building) => [
        building.id,
        building.kind,
        building.position.q,
        building.position.r,
        building.retired ? 1 : 0,
        underConstruction(building) ? 1 : 0,
        building.fieldStage ?? "",
      ].join(":"))
      .join("|");
    const resources = this.worldRef.naturalResources
      .map((resource) => [resource.id, resource.kind, resource.position.q, resource.position.r, resource.remaining, resource.depleted ? 1 : 0].join(":"))
      .join("|");
    const internals = this.internals();

    return [
      terrainHash,
      buildings,
      resources,
      internals.selectedBuildingId ?? "",
      internals.selectedTile
        ? `${internals.selectedTile.q},${internals.selectedTile.r}`
        : "",
    ].join("#");
  }

  private bushSignature(): string {
    return this.worldRef.tiles
      .filter((tile) => tile.bush)
      .map((tile) => `${tile.q},${tile.r}:${tile.terrain}:${tile.bushAvailable === false ? 0 : 1}`)
      .join("|");
  }

  private inventorySignature(): string {
    const buildings = this.worldRef.buildings
      .filter(
        (building) =>
          (!building.retired || building.output > 0) &&
          !underConstruction(building),
      )
      .map((building) =>
        `${building.id}:${building.input}:${building.output}:${building.recipe?.input ?? ""}`,
      )
      .join("|");
    const resources = this.worldRef.naturalResources
      .map((resource) => `${resource.id}:${resource.output}`)
      .join("|");
    return `${buildings}#${resources}`;
  }

  private modalSignature(mapSignature: string): string {
    const internals = this.internals();
    return [
      internals.merchantTargetSourceId ?? "",
      internals.buildKind ?? "",
      internals.buildHover ? `${internals.buildHover.q},${internals.buildHover.r}` : "",
      mapSignature,
    ].join("#");
  }

  private drawBushMarkers(): void {
    if (!this.bushGraphics) return;
    const g = this.bushGraphics;
    g.clear();
    for (const tile of this.worldRef.tiles) {
      if (!tile.bush || tile.bushAvailable === false || tile.terrain !== "grass") continue;
      const { x, y } = pixel(tile);
      g.fillStyle(0x355b35, 0.95);
      g.fillCircle(x - 1.4, y + 0.5, 1.6);
      g.fillCircle(x + 1.2, y + 0.5, 1.5);
      g.fillCircle(x, y - 0.8, 1.5);
      g.fillStyle(0x9d3f4b, 0.95);
      g.fillCircle(x - 0.8, y, 0.45);
      g.fillCircle(x + 0.9, y + 0.2, 0.45);
    }
  }

  private drawInventoryMarkers(): void {
    if (!this.inventoryGraphics || !this.inventoryLabels) return;
    const internals = this.internals();
    const slots = this.inventoryGraphics;
    slots.clear();
    this.inventoryLabels.removeAll(true);

    for (const building of this.worldRef.buildings.filter(
      (candidate) =>
        (!candidate.retired || candidate.output > 0) &&
        !underConstruction(candidate),
    )) {
      const outputGood = building.kind === "farm" ? "wheat" : building.recipe?.output;
      if (!outputGood) continue;
      const { x, y } = pixel(building.position);

      if (building.recipe?.input) {
        internals.drawSlots(
          slots,
          x + 5,
          y - 4,
          building.input,
          CONFIG.inputCapacity,
          building.recipe.input,
          5,
        );
        this.inventoryLabels.add(this.add.text(x + 5, y - 9, "IN", {
          fontFamily: "system-ui",
          fontSize: "5px",
          color: "#21372a",
        }).setResolution(TEXT_RESOLUTION));
      }

      internals.drawSlots(
        slots,
        x + 5,
        building.recipe?.input ? y + 3 : y - 1,
        building.output,
        CONFIG.outputCapacity,
        outputGood,
        3,
      );
      this.inventoryLabels.add(this.add.text(
        x + 5,
        building.recipe?.input ? y + 7 : y + 3,
        "OUT",
        {
          fontFamily: "system-ui",
          fontSize: "5px",
          color: "#21372a",
        },
      ).setResolution(TEXT_RESOLUTION));
    }

    for (const resource of this.worldRef.naturalResources.filter((candidate) => candidate.output > 0)) {
      const { x, y } = pixel(resource.position);
      const good: Good = resource.kind === "forest" ? "wood" : resource.kind === "clay" ? "clay" : "rubble";
      internals.drawSlots(slots, x + 5, y - 1, resource.output, CONFIG.resourceOutputCapacity, good, 3);
      this.inventoryLabels.add(this.add.text(x + 5, y + 3, "OUT", {
        fontFamily: "system-ui",
        fontSize: "5px",
        color: "#21372a",
      }).setResolution(TEXT_RESOLUTION));
    }
  }

  private createPersonMarker(person: Person): PersonMarkerObjects {
    const dot = this.add.circle(0, 0, PERSON_MARKER_RADIUS, 0xdde5db).setStrokeStyle(0.5, 0xffffff);
    const label = this.add.text(0, 0, this.internals().personMarker(person), {
      fontFamily: "system-ui",
      fontSize: "4px",
      color: "#ffffff",
    }).setResolution(TEXT_RESOLUTION).setOrigin(0.5);
    const nameLabel = this.add.text(0, 0, personName(person.id), {
      fontFamily: "system-ui",
      fontSize: "10px",
      fontStyle: "bold",
      color: "#ffffff",
      backgroundColor: "#263c2d",
      padding: { x: 2, y: 0 },
    }).setResolution(PERSON_TEXT_RESOLUTION).setOrigin(0.5, 0).setScale(PERSON_NAME_SCALE);
    const detailLabel = this.add.text(
      0,
      0,
      `${personProfessionLabel(this.worldRef, person)} (${personActivityLabel(person)})`,
      {
        fontFamily: "system-ui",
        fontSize: "8px",
        color: "#dce6dd",
        backgroundColor: "#263c2d",
        padding: { x: 2, y: 0 },
      },
    ).setResolution(PERSON_TEXT_RESOLUTION).setOrigin(0.5, 0).setScale(PERSON_DETAIL_SCALE);
    const cargo = this.add.text(0, 0, "", {
      fontFamily: "system-ui",
      fontSize: "10px",
      color: "#fff2a3",
    }).setResolution(PERSON_TEXT_RESOLUTION).setOrigin(0.5).setScale(CARGO_SCALE).setVisible(false);

    this.personLayer?.add([dot, label, nameLabel, detailLabel, cargo]);
    return { dot, label, nameLabel, detailLabel, cargo };
  }

  private syncPersonMarkers(): void {
    if (!this.personLayer) return;
    const activeIds = new Set(this.worldRef.people.map((person) => person.id));
    for (const [id, marker] of this.personMarkers) {
      if (activeIds.has(id)) continue;
      marker.dot.destroy();
      marker.label.destroy();
      marker.nameLabel.destroy();
      marker.detailLabel.destroy();
      marker.cargo.destroy();
      this.personMarkers.delete(id);
    }

    for (const markerPosition of personMarkerPositions(this.worldRef)) {
      const { person, x, y, groundY } = markerPosition;
      const color = !person.assignment && !person.woodcutter && !person.extractor && !person.builder
        ? 0xdde5db
        : person.assignment?.role === "worker" || person.woodcutter
          ? 0x234636
          : 0x8b512e;

      const marker = this.personMarkers.get(person.id) ?? this.createPersonMarker(person);
      this.personMarkers.set(person.id, marker);
      marker.dot.setPosition(x, y).setFillStyle(color);
      marker.label.setPosition(x, y);
      const personLabel = this.internals().personMarker(person);
      if (marker.label.text !== personLabel) marker.label.setText(personLabel);

      const displayName = personName(person.id);
      if (marker.nameLabel.text !== displayName) marker.nameLabel.setText(displayName);
      marker.nameLabel.setPosition(x, groundY + 1.2);

      const detail = `${personProfessionLabel(this.worldRef, person)} (${personActivityLabel(person)})`;
      if (marker.detailLabel.text !== detail) marker.detailLabel.setText(detail);
      marker.detailLabel.setPosition(x, groundY + 4.6);

      if (person.trip?.picked) {
        marker.cargo.setPosition(
          x + PERSON_MARKER_RADIUS * 0.72,
          y - PERSON_MARKER_RADIUS * 0.72,
        );
        const cargoLabel = GOOD_ICONS[person.trip.good];
        if (marker.cargo.text !== cargoLabel) marker.cargo.setText(cargoLabel);
        marker.cargo.setVisible(true);
      } else {
        marker.cargo.setVisible(false);
      }
    }
  }

  override renderWorld(): void {
    if (!this.ensureLayers()) return;
    const internals = this.internals();

    const mapSignature = this.mapSignature();
    if (mapSignature !== this.lastMapSignature) {
      internals.drawMap();
      this.lastMapSignature = mapSignature;
      this.lastModalSignature = "";
    }

    const bushSignature = this.bushSignature();
    if (bushSignature !== this.lastBushSignature) {
      this.drawBushMarkers();
      this.lastBushSignature = bushSignature;
    }

    const inventorySignature = this.inventorySignature();
    if (inventorySignature !== this.lastInventorySignature) {
      this.drawInventoryMarkers();
      this.lastInventorySignature = inventorySignature;
    }

    this.syncPersonMarkers();

    const modalSignature = this.modalSignature(mapSignature);
    if (modalSignature !== this.lastModalSignature) {
      internals.drawModalMapMode();
      this.lastModalSignature = modalSignature;
    }
  }
}
