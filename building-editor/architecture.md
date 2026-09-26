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
    sprite*.png|webp
```

Der Editor importiert die gemeinsame Kartenprojektion und Hex-Geometrie aus `src/game/mapProjection.ts`. Zellzentren, Hex-Ecken und damit die sichtbare Rasterform entsprechen der Spielansicht. Der Editor verwendet nur einen festen Vorschau-Zoom; Raster und Sprite werden mit demselben Faktor vergrößert. Dieser Vorschau-Zoom verändert keine exportierten Daten.

## Datenmodell

`BuildingVisualDefinition` Version 4 enthält eine stabile `id` und eine lückenlose Liste von `levels`, beginnend bei Stufe 1. Jede Stufe besitzt vollständig eigene visuelle/räumliche Daten:

- Sprite-Dateiname,
- `spriteAnchor` als normalisierte x/y-Position relativ zur Bildgröße,
- positive `spriteWorldWidth` als sichtbare Breite in Weltpixeln,
- `footprint` als relative Hex-Zellen,
- `blocked` als Teilmenge des Footprints,
- genau eine nicht blockierte `entrance`-Zelle.

Sprite-Ausrichtung und Weltgröße sind dadurch unabhängig von der Quellauflösung. Begehbare Gebäudezellen ergeben sich aus `footprint - blocked`; sie werden nicht redundant gespeichert. Unterschiedliche Stufen dürfen unterschiedliche Grundrisse, Eingänge und Sprites besitzen.

## Editor-Interaktion

Große Sprites werden beim ersten Laden passend in die Vorschau eingepasst. Dabei wird nur `spriteWorldWidth` gesetzt; die Originaldatei bleibt unverändert. Die Weltbreite kann per Slider oder Zahlenfeld geändert werden.

Das Sprite kann über das Werkzeug **Sprite verschieben** direkt über dem Raster verschoben werden. Diese Drag-Bewegung verändert den relativen `spriteAnchor`; das Raster selbst bleibt unverändert. q-/r-Achsen und Ursprung werden zusätzlich hervorgehoben.

Rasterwerkzeuge arbeiten als Paint-Interaktion. Ein einzelner Klick toggelt die erste Zelle. Bei gehaltenem Pointer wird daraus für den gesamten Drag ein fester Setz- oder Löschmodus; jede danach erstmals überfahrene Zelle erhält dasselbe Ergebnis. `Shift` erzwingt für Klick und Drag den Löschmodus. Eine Zelle wird innerhalb desselben Drags nur einmal verarbeitet, damit wiederholte Pointer-Events das Ergebnis nicht zurücktoggeln.

Beim Werkzeug **Blockierte Zellen** erzeugt das Setzen zugleich die dafür notwendige Footprint-Zelle. Wird dieselbe blockierte Zelle wieder entfernt – per Toggle oder `Shift` – werden Blockierung und diese Footprint-Zelle gemeinsam zurückgesetzt, sodass die Zelle wieder unmarkiert ist.

Die Overlay-Stärke der markierten Rasterzellen ist eine reine Editor-Vorschau-Einstellung. Sie beeinflusst weder `BuildingVisualDefinition` noch exportierte Dateien.

## Projektgebäude laden

Der Editor liest die vorhandenen Visual-Asset-Slots unter `src/assets/buildings/<kind>/` direkt über Vite-Module ein. Das Dropdown verwendet die zentralen deutschen Gebäudenamen des Spiels und sortiert sie mit deutscher Sortierung alphabetisch. Verwaltete Gebäude und `field` werden angeboten; Infrastruktur wie Palisaden bleibt außerhalb dieses generischen Editors.

Nicht-placeholder `building.json`-Dateien werden mit demselben aktuellen Schema validiert wie manuelle Reimporte. Bei Auswahl werden Definition und alle referenzierten Stufen-Sprites vollständig in den Editorzustand geladen. Der Editor hält den Zustand jeder Stufe separat; beim Stufenwechsel werden Sprite, Anchor, Weltbreite, Grundriss, Blockierung und Eingang gewechselt. Neue Stufen werden lückenlos am Ende angefügt und übernehmen als Startpunkt die räumliche Konfiguration der vorherigen Stufe, aber keinen Sprite. Placeholder-Slots bleiben ebenfalls auswählbar: der Editor übernimmt ihre ID, leert den räumlich-visuellen Bearbeitungszustand und weist darauf hin, dass noch keine Konfiguration existiert.

Beim lokalen direkten Speichern bleiben Definition-ID und Asset-Slot getrennt. Wurde ein vorhandenes Projektgebäude aus dem Dropdown geladen, schreibt der Development-Endpunkt zurück in genau dessen bestehenden Slot, auch wenn dessen `BuildingVisualDefinition.id` davon abweicht.

## Export und Reimport

Im Produktionsbuild/GitHub Pages lädt **Dateien herunterladen** `building.json` und alle unveränderten Stufen-Sprites als lokale Dateien herunter.

Der Editor kann einen Export aus `building.json` plus allen darin referenzierten Stufen-Sprites wieder importieren. `building.json` wird strukturell und über die gemeinsame Schema-Validierung geprüft. Anschließend muss unter den gleichzeitig ausgewählten Dateien genau das vom JSON referenzierte PNG/WebP vorhanden sein. Erst nach erfolgreicher Prüfung werden Editorzustand und Sprite ersetzt. Dasselbe funktioniert per gemeinsamer Dateiauswahl oder Drag & Drop beider Dateien.

Aktuell gibt es bewusst **keine Rückwärtskompatibilität** für ältere Editor-/Building-Visual-Schemata. Der aktuelle Schemastand ist verbindlich; alte Exporte dürfen abgelehnt werden. Migrationen oder Defaults werden erst ergänzt, wenn dies ausdrücklich als Produktanforderung festgelegt wird.

Im Vite-Entwicklungsserver ist zusätzlich **Direkt ins Projekt speichern** verfügbar. Ein Development-only-Middleware-Endpunkt validiert ID und Bildtyp und schreibt `building.json` plus alle referenzierten Stufen-Sprites nach `src/assets/buildings/<id>/`. Dieser Endpunkt existiert im statischen Produktionsbuild nicht und benötigt keine GitHub-Anmeldedaten.

## Build

Vite baut `index.html` und `building-editor/index.html` als Multi-Page-App. Die bestehende GitHub-Pages-Pipeline veröffentlicht beide Seiten gemeinsam.
