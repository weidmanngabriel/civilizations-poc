# Character Lab Architecture

## Abgrenzung

Das Character Lab ist eine eigenständige Vite-Seite unter `/character-lab/`. Es nutzt Three.js ausschließlich für die 3D-Vorschau. Das Hauptspiel und Phaser sind nicht beteiligt.

## Datenmodell

### Character Definition

`character.json` beschreibt die verfügbaren Körperteile, ihre Hierarchie und die erlaubten Bewegungsachsen samt Grenzen.

v1 besitzt:

- `head`: yaw und pitch
- `leftArm`, `rightArm`: pitch
- `leftLeg`, `rightLeg`: pitch
- `torso`: keine editierbare Rotation in v1

Winkel werden in Grad gespeichert. Sie sind absolute lokale Winkel relativ zum neutralen Parent-Transform.

### Animation

Animationsdateien verwenden:

```json
{
  "schema": "civilizations-character-animation",
  "version": 1,
  "id": "walk",
  "keyframes": [
    {
      "progress": 0,
      "pose": {
        "leftArm.pitch": -30
      }
    }
  ]
}
```

`progress` liegt immer zwischen 0 und 1. Zwischen benachbarten Keyframes wird linear interpoliert. Fehlende Tracks behalten ihren zuletzt bekannten Wert beziehungsweise die Neutralpose.

Die reale Dauer gehört nicht zur Animationsdatei. Ein späterer Consumer kann eine Animation auf eine beliebige Dauer abbilden.

## Rendering

Three.js rendert:

- orthografische Kamera,
- einfache Box-Geometrien,
- flache Standardmaterialien,
- Bodenraster zur Orientierung,
- einen Character-Root für die Drehung der gesamten Figur.

Arme und Beine rotieren an Schulter/Hüfte nur vorwärts/rückwärts. Der Kopf rotiert lokal um yaw/pitch. Die Gelenkgrenzen werden zentral geclamped.

## Steuerkern

Die UI benutzt dieselben Funktionen wie die Browser-API. Dadurch gibt es keinen separaten Automatisierungspfad.

`window.characterLab` stellt in v1 mindestens bereit:

- `getState()`
- `setProgress(value)`
- `setPartAngle(part, axis, degrees)`
- `setCharacterYaw(degrees)`
- `loadAnimation(animation)`
- `exportAnimation()`
- `setKeyframe(progress, pose?)`
- `deleteKeyframe(progress)`
- `play()`
- `pause()`

Alle Mutationen validieren und clampen Eingaben. Die API ist bewusst lokal und synchron/Promise-frei, soweit kein Dateidialog beteiligt ist.

## Dateien

```text
character-lab/
  index.html
  agents.md
  architecture.md
  concept.md
  src/
    main.ts
    style.css
```

v1 hält den Code bewusst kompakt. Erst wenn Modellvarianten oder weitere Assettypen hinzukommen, soll der Steuerkern in gemeinsame Module unter `src/characters/` ausgelagert werden.
