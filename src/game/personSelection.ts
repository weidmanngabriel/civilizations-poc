import Phaser from "phaser";
import type { Hex, Person, World } from "../simulation/model";
import { key } from "../simulation/hex";
import { personWorldPosition } from "../simulation/movement";

const HEX_X = 24;
const HEX_Y = 21;
const PERSON_HIT_RADIUS_PX = 30;
const PERSON_SELECTED_EVENT = "poc-person-selected";
const PERSON_CLEARED_EVENT = "poc-person-selection-cleared";
const PERSON_SELECTION_REQUESTED_EVENT = "poc-person-selection-requested";
const PERSON_SELECTION_CLEAR_REQUESTED_EVENT = "poc-person-selection-clear-requested";
const BUILDING_SELECTED_EVENT = "poc-building-selected";
const TILE_SELECTED_EVENT = "poc-tile-selected";
const BUILDING_SELECTION_REQUESTED_EVENT = "poc-building-selection-requested";
const BUILDING_SELECTION_CLEARED_EVENT = "poc-building-selection-cleared";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";
const BUILD_MODE_EVENT = "poc-build-mode";

type SelectableScene = Phaser.Scene & {
  create?: () => void;
  selectAtScreenPoint?: (screenX: number, screenY: number) => void;
};

type ModeDetail = { active: boolean };
type PersonSelectionDetail = { id: number; focus?: boolean };
type MarkerPosition = { person: Person; x: number; y: number };

const pixel = (h: Hex) => ({
  x: 34 + HEX_X * (h.q + h.r / 2),
  y: 34 + h.r * HEX_Y,
});

function markerPositions(world: World): MarkerPosition[] {
  const groups = new Map<string, number>();
  return world.people.map((person) => {
    const moving = person.path.length > 0;
    const positionKey = key(person.position);
    const groupIndex = groups.get(positionKey) ?? 0;
    groups.set(positionKey, groupIndex + 1);
    const position = pixel(personWorldPosition(world, person));
    return {
      person,
      x: position.x + (moving
        ? ((person.id % 3) - 1) * 2
        : ((groupIndex % 4) - 1.5) * 8),
      y: position.y + (moving ? 1 : 1 + Math.floor(groupIndex / 4) * 8),
    };
  });
}

function nearestPersonAtScreenPoint(
  scene: Phaser.Scene,
  world: World,
  screenX: number,
  screenY: number,
): Person | undefined {
  const camera = scene.cameras.main;
  const point = camera.getWorldPoint(screenX, screenY);
  const maxDistance = PERSON_HIT_RADIUS_PX / camera.zoom;
  return markerPositions(world)
    .map((candidate) => ({
      person: candidate.person,
      distance: Phaser.Math.Distance.Between(point.x, point.y, candidate.x, candidate.y),
    }))
    .filter((candidate) => candidate.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)[0]?.person;
}

export function installPersonSelection(scene: Phaser.Scene, world: World): void {
  const selectableScene = scene as SelectableScene;
  const originalCreate = selectableScene.create?.bind(scene);
  const originalSelectAtScreenPoint = selectableScene.selectAtScreenPoint?.bind(scene);
  let selectedPersonId: number | undefined;
  let buildModeActive = false;
  let merchantTargetModeActive = false;

  const clearPerson = (): void => {
    if (selectedPersonId === undefined) return;
    selectedPersonId = undefined;
    window.dispatchEvent(new CustomEvent(PERSON_CLEARED_EVENT));
  };

  const focusPerson = (personId: number): void => {
    const marker = markerPositions(world).find((candidate) => candidate.person.id === personId);
    if (!marker) return;
    const camera = scene.cameras.main;
    const mobile = window.matchMedia("(max-width: 700px)").matches;
    const targetScreenX = camera.width * (mobile ? 0.5 : 0.44);
    const targetScreenY = camera.height * (mobile ? 0.32 : 0.5);
    camera.scrollX = marker.x - targetScreenX / camera.zoom;
    camera.scrollY = marker.y - targetScreenY / camera.zoom;
  };

  const selectPerson = (personId: number, focus = false): void => {
    if (!world.people.some((person) => person.id === personId)) return;
    selectedPersonId = personId;
    if (focus) focusPerson(personId);
    window.dispatchEvent(new CustomEvent(PERSON_SELECTED_EVENT, {
      detail: { id: personId },
    }));
    window.dispatchEvent(new CustomEvent(BUILDING_SELECTION_CLEARED_EVENT));
  };

  if (originalSelectAtScreenPoint) {
    selectableScene.selectAtScreenPoint = (screenX: number, screenY: number): void => {
      if (buildModeActive || merchantTargetModeActive) {
        originalSelectAtScreenPoint(screenX, screenY);
        return;
      }
      const person = nearestPersonAtScreenPoint(scene, world, screenX, screenY);
      if (person) {
        selectPerson(person.id);
        return;
      }
      clearPerson();
      originalSelectAtScreenPoint(screenX, screenY);
    };
  }

  selectableScene.create = () => {
    originalCreate?.();

    const selectionRing = scene.add.graphics().setDepth(1900);

    const renderSelection = (): void => {
      selectionRing.clear();
      if (selectedPersonId === undefined) return;
      const marker = markerPositions(world).find(
        (candidate) => candidate.person.id === selectedPersonId,
      );
      if (!marker) {
        clearPerson();
        return;
      }
      const zoom = scene.cameras.main.zoom;
      selectionRing.lineStyle(2 / zoom, 0xf3d36a, 1);
      selectionRing.strokeCircle(marker.x, marker.y, 10 / zoom);
    };

    const onSelectionRequested = (event: Event): void => {
      const detail = (event as CustomEvent<PersonSelectionDetail>).detail;
      selectPerson(detail.id, detail.focus ?? true);
    };
    const onClearRequested = (): void => clearPerson();
    const onBuildingSelected = (): void => clearPerson();
    const onTileSelected = (): void => clearPerson();
    const onBuildingSelectionRequested = (): void => clearPerson();
    const onBuildMode = (event: Event): void => {
      buildModeActive = (event as CustomEvent<ModeDetail>).detail.active;
      if (buildModeActive) clearPerson();
    };
    const onMerchantTargetMode = (event: Event): void => {
      merchantTargetModeActive = (event as CustomEvent<ModeDetail>).detail.active;
      if (merchantTargetModeActive) clearPerson();
    };

    window.addEventListener(PERSON_SELECTION_REQUESTED_EVENT, onSelectionRequested);
    window.addEventListener(PERSON_SELECTION_CLEAR_REQUESTED_EVENT, onClearRequested);
    window.addEventListener(BUILDING_SELECTED_EVENT, onBuildingSelected);
    window.addEventListener(TILE_SELECTED_EVENT, onTileSelected);
    window.addEventListener(BUILDING_SELECTION_REQUESTED_EVENT, onBuildingSelectionRequested);
    window.addEventListener(BUILD_MODE_EVENT, onBuildMode);
    window.addEventListener(MERCHANT_TARGET_MODE_EVENT, onMerchantTargetMode);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, renderSelection);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(PERSON_SELECTION_REQUESTED_EVENT, onSelectionRequested);
      window.removeEventListener(PERSON_SELECTION_CLEAR_REQUESTED_EVENT, onClearRequested);
      window.removeEventListener(BUILDING_SELECTED_EVENT, onBuildingSelected);
      window.removeEventListener(TILE_SELECTED_EVENT, onTileSelected);
      window.removeEventListener(BUILDING_SELECTION_REQUESTED_EVENT, onBuildingSelectionRequested);
      window.removeEventListener(BUILD_MODE_EVENT, onBuildMode);
      window.removeEventListener(MERCHANT_TARGET_MODE_EVENT, onMerchantTargetMode);
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, renderSelection);
      selectionRing.destroy();
    });
  };
}
