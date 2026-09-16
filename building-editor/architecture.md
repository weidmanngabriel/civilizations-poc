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
- Sprite-Anchor in **Original-Sprite-Pixeln** relativ zur Editor-Projektion,
- optionale positive `spriteScale` für die Darstellungsgröße; fehlt sie in älteren Exporten, gilt `1`,
- `footprint` als relative Hex-Zellen,
- `blocked` als Teilmenge des Footprints,
- genau eine nicht blockierte `entrance`-Zelle.

Der Anchor bleibt unabhängig von der Skalierung in Originalpixeln gespeichert. Dadurch ändert ein späteres Resize nicht die Bedeutung des definierten Fußpunkts. Begehbare Gebäudezellen ergeben sich aus `footprint - blocked`; sie werden nicht redundant gespeichert.

## Editor-Interaktion

Große Sprites werden beim ersten Laden nur für die Editoransicht automatisch passend eingepasst; die Originaldatei wird nicht verändert. Die Skalierung kann anschließend per Slider oder Zahlenfeld geändert werden und wird als `spriteScale` exportiert.

Das Sprite kann direkt mit der Maus über dem Raster verschoben werden. Diese Drag-Bewegung verändert den `spriteAnchor`; das Raster selbst bleibt unverändert und verwendet weiterhin exakt die Spielprojektion. q-/r-Achsen und der Ursprung werden im Editor zusätzlich hervorgehoben, um die Projektion besser lesbar zu machen.

## Export und Reimport

Im Produktionsbuild/GitHub Pages lädt **Export herunterladen** `building.json` und das unveränderte Sprite als lokale Dateien herunter.

Der Editor kann genau dieses Dateipaar wieder importieren. `building.json` wird zunächst strukturell und über die gemeinsame Schema-Validierung geprüft. Anschließend muss unter den gleichzeitig ausgewählten Dateien genau das vom JSON referenzierte PNG/WebP vorhanden sein. Erst nach erfolgreicher Prüfung werden Editorzustand und Sprite ersetzt. Dasselbe funktioniert per gemeinsamer Dateiauswahl oder Drag & Drop beider Dateien. Exporte ohne `spriteScale` bleiben kompatibel und werden mit `1` geladen.

Im Vite-Entwicklungsserver ist zusätzlich **Ins Projekt speichern** verfügbar. Ein Development-only-Middleware-Endpunkt validiert ID und Bildtyp und schreibt nach `src/assets/buildings/<id>/`. Dieser Endpunkt existiert im statischen Produktionsbuild nicht und benötigt keine GitHub-Anmeldedaten.

## Build

Vite baut `index.html` und `building-editor/index.html` als Multi-Page-App. Die bestehende GitHub-Pages-Pipeline veröffentlicht beide Seiten gemeinsam.
