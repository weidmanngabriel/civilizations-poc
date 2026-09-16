# Building Editor Architecture

Der Gebäudeeditor ist eine eigene Vite-Multi-Page-Unterseite unter `/civilizations-poc/building-editor/`. Er läuft im selben Repository und Build wie das Spiel, startet aber keinen Phaser-Spielzustand und enthält keine Simulationslogik.

## Grenzen

```text
building-editor/
  index.html
  src/             Editor-UI und Interaktion

src/buildings/
  buildingVisualDefinition.ts   gemeinsames Datenformat

src/assets/buildings/
  <building-id>/
    building.json
    sprite.png|webp
```

Der Editor importiert die gemeinsame Kartenprojektion aus `src/game/mapProjection.ts`. Damit stimmen Zellpositionen mit dem Hauptspiel überein, ohne `mapGeometry.ts` oder Phaser-spezifische Teile zu laden.

## Datenmodell

`BuildingVisualDefinition` Version 1 enthält ausschließlich:

- stabile `id`,
- Sprite-Dateiname,
- Sprite-Anchor in Pixeln relativ zur Editor-Projektion,
- `footprint` als relative Hex-Zellen,
- `blocked` als Teilmenge des Footprints,
- genau eine nicht blockierte `entrance`-Zelle.

Begehbare Gebäudezellen ergeben sich aus `footprint - blocked`; sie werden nicht redundant gespeichert.

## Export

Im Produktionsbuild/GitHub Pages lädt **Export herunterladen** `building.json` und das unveränderte Sprite als lokale Dateien herunter.

Im Vite-Entwicklungsserver ist zusätzlich **Ins Projekt speichern** verfügbar. Ein Development-only-Middleware-Endpunkt validiert ID und Bildtyp und schreibt nach `src/assets/buildings/<id>/`. Dieser Endpunkt existiert im statischen Produktionsbuild nicht und benötigt keine GitHub-Anmeldedaten.

## Build

Vite baut `index.html` und `building-editor/index.html` als Multi-Page-App. Die bestehende GitHub-Pages-Pipeline veröffentlicht beide Seiten gemeinsam.
