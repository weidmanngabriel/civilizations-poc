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

Der Editor importiert die gemeinsame Kartenprojektion und Hex-Geometrie aus `src/game/mapProjection.ts`. Zellzentren, Hex-Ecken und damit die sichtbare Rasterform entsprechen der Spielansicht. Der Editor verwendet nur einen festen Vorschau-Zoom; Raster und Sprite werden mit demselben Faktor vergrößert. Dieser Vorschau-Zoom verändert keine exportierten Daten.

## Datenmodell

`BuildingVisualDefinition` Version 2 enthält ausschließlich:

- stabile `id`,
- Sprite-Dateiname,
- Sprite-Anchor in **Original-Sprite-Pixeln**,
- positive `spriteScale` als spätere Runtime-Skalierung,
- `footprint` als relative Hex-Zellen,
- `blocked` als Teilmenge des Footprints,
- genau eine nicht blockierte `entrance`-Zelle.

Der Anchor bleibt unabhängig von der Skalierung in Originalpixeln gespeichert. Begehbare Gebäudezellen ergeben sich aus `footprint - blocked`; sie werden nicht redundant gespeichert.

## Editor-Interaktion

Große Sprites werden beim ersten Laden passend in die Vorschau eingepasst. Dabei wird nur `spriteScale` gesetzt; die Originaldatei bleibt unverändert. Die Skalierung kann per Slider oder Zahlenfeld geändert werden.

Das Sprite kann über das Werkzeug **Sprite verschieben** direkt über dem Raster verschoben werden. Diese Drag-Bewegung verändert den `spriteAnchor`; das Raster selbst bleibt unverändert. q-/r-Achsen und Ursprung werden zusätzlich hervorgehoben.

## Export und Reimport

Im Produktionsbuild/GitHub Pages lädt **Export herunterladen** `building.json` und das unveränderte Sprite als lokale Dateien herunter.

Der Editor kann ein Exportpaar wieder importieren. `building.json` wird strukturell und über die gemeinsame Schema-Validierung geprüft. Anschließend muss unter den gleichzeitig ausgewählten Dateien genau das vom JSON referenzierte PNG/WebP vorhanden sein. Erst nach erfolgreicher Prüfung werden Editorzustand und Sprite ersetzt. Dasselbe funktioniert per gemeinsamer Dateiauswahl oder Drag & Drop beider Dateien.

Aktuell gibt es bewusst **keine Rückwärtskompatibilität** für ältere Editor-/Building-Visual-Schemata. Der aktuelle Schemastand ist verbindlich; alte Exporte dürfen abgelehnt werden. Migrationen oder Defaults werden erst ergänzt, wenn dies ausdrücklich als Produktanforderung festgelegt wird.

Im Vite-Entwicklungsserver ist zusätzlich **Ins Projekt speichern** verfügbar. Ein Development-only-Middleware-Endpunkt validiert ID und Bildtyp und schreibt nach `src/assets/buildings/<id>/`. Dieser Endpunkt existiert im statischen Produktionsbuild nicht und benötigt keine GitHub-Anmeldedaten.

## Build

Vite baut `index.html` und `building-editor/index.html` als Multi-Page-App. Die bestehende GitHub-Pages-Pipeline veröffentlicht beide Seiten gemeinsam.
