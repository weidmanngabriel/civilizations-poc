import Phaser from "phaser";
import type { Person, World } from "../simulation/model";
import {
  PERSON_MARKER_CENTER_OFFSET_Y,
  PERSON_MARKER_RADIUS,
  personMarkerPositions,
} from "./personMarkerGeometry";
import { personWorldPosition } from "../simulation/movement";
import { pixel } from "./mapGeometry";
import { personInsideBuilding } from "./personVisibility";

const PERSON_HIT_RADIUS_PX = 30;
const PERSON_SELECTED_EVENT = "poc-person-selected";
const PERSON_CLEARED_EVENT = "poc-person-selection-cleared";
const PERSON_SELECTION_REQUESTED_EVENT = "poc-person-selection-requested";
const PERSON_SELECTION_CLEAR_REQUESTED_EVENT = "poc-person-selection-clear-requested";
const PERSON_CONTEXT_OPEN_REQUESTED_EVENT = "poc-person-context-open-requested";
const BUILDING_SELECTED_EVENT = "poc-building-selected";
const BUILDING_SELECTION_REQUESTED_EVENT = "poc-building-selection-requested";
const BUILDING_SELECTION_CLEARED_EVENT = "poc-building-selection-cleared";
const MERCHANT_TARGET_MODE_EVENT = "poc-merchant-target-mode";
const BUILD_MODE_EVENT = "poc-build-mode";

type SelectableScene = Phaser.Scene & {
  create?: () => void;
  selectAtScreenPoint?: (screenX: number, screenY: number) => void;
  longPressPersonAtScreenPoint?: (screenX: number, screenY: number) => boolean;
};

type ModeDetail = { active: boolean };
type PersonSelectionDetail = { id: number; focus?: boolean };

function nearestPersonAtScreenPoint(
  scene: Phaser.Scene,
  world: World,
  screenX: number,
  screenY: number,
): Person | undefined {
  const camera = scene.cameras.main;
  const point = camera.getWorldPoint(screenX, screenY);
  const maxDistance = PERSON_HIT_RADIUS_PX / camera.zoom;
  return personMarkerPositions(world)
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

  const selectionPosition = (personId: number): { x: number; y: number } | undefined => {
    const marker = personMarkerPositions(world).find((candidate) => candidate.person.id === personId);
    if (marker) return marker;

    const person = world.people.find((candidate) => candidate.id === personId);
    if (!person || !personInsideBuilding(world, person)) return undefined;
    const position = pixel(personWorldPosition(world, person));
    return {
      x: position.x,
      y: position.y + PERSON_MARKER_CENTER_OFFSET_Y,
    };
  };

  const focusPerson = (personId: number): void => {
    const marker = selectionPosition(personId);
    if (!marker) return;
    const camera = scene.cameras.main;
    const mobile = window.matchMedia("(max-width: 700px)").matches;
    const targetScreenX = camera.x + camera.width * (mobile ? 0.5 : 0.44);
    const targetScreenY = camera.y + camera.height * (mobile ? 0.32 : 0.5);
    const targetWorld = camera.getWorldPoint(targetScreenX, targetScreenY);
    camera.scrollX += marker.x - targetWorld.x;
    camera.scrollY += marker.y - targetWorld.y;
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

  selectableScene.longPressPersonAtScreenPoint = (screenX: number, screenY: number): boolean => {
    if (buildModeActive || merchantTargetModeActive) return false;
    const person = nearestPersonAtScreenPoint(scene, world, screenX, screenY);
    if (!person) return false;
    selectPerson(person.id);
    window.dispatchEvent(new CustomEvent(PERSON_CONTEXT_OPEN_REQUESTED_EVENT));
    return true;
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
      const selectedPerson = world.people.find((person) => person.id === selectedPersonId);
      if (!selectedPerson) {
        clearPerson();
        return;
      }
      const marker = selectionPosition(selectedPersonId);
      if (!marker) return;
      const zoom = scene.cameras.main.zoom;
      selectionRing.lineStyle(1.5 / zoom, 0xf3d36a, 1);
      selectionRing.strokeCircle(
        marker.x,
        marker.y,
        PERSON_MARKER_RADIUS + 1.5 / zoom,
      );
    };

    const onSelectionRequested = (event: Event): void => {
      const detail = (event as CustomEvent<PersonSelectionDetail>).detail;
      selectPerson(detail.id, detail.focus ?? true);
    };
    const onClearRequested = (): void => clearPerson();
    const onBuildingSelected = (): void => clearPerson();
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
    window.addEventListener(BUILDING_SELECTION_REQUESTED_EVENT, onBuildingSelectionRequested);
    window.addEventListener(BUILD_MODE_EVENT, onBuildMode);
    window.addEventListener(MERCHANT_TARGET_MODE_EVENT, onMerchantTargetMode);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, renderSelection);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener(PERSON_SELECTION_REQUESTED_EVENT, onSelectionRequested);
      window.removeEventListener(PERSON_SELECTION_CLEAR_REQUESTED_EVENT, onClearRequested);
      window.removeEventListener(BUILDING_SELECTED_EVENT, onBuildingSelected);
      window.removeEventListener(BUILDING_SELECTION_REQUESTED_EVENT, onBuildingSelectionRequested);
      window.removeEventListener(BUILD_MODE_EVENT, onBuildMode);
      window.removeEventListener(MERCHANT_TARGET_MODE_EVENT, onMerchantTargetMode);
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, renderSelection);
      selectionRing.destroy();
    });
  };
}
