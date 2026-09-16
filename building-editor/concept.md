# Building Editor Concept

Der Gebäudeeditor ist ein internes Authoring-Werkzeug für neue Gebäudevisuals. Er ist als Unterseite öffentlich erreichbar, wird aber ausschließlich für Desktop-Bedienung optimiert.

## Zweck

Ein neues Gebäude soll ohne Codeänderung räumlich beschrieben werden können:

1. Sprite laden oder hineinziehen.
2. Gebäude-ID festlegen.
3. Sprite relativ zum feinen Spielraster ausrichten.
4. Zellen des Gebäudegrundrisses markieren.
5. Zellen innerhalb des Grundrisses als blockiert markieren.
6. Genau eine begehbare Eingangszelle wählen.
7. Definition exportieren oder lokal direkt ins Projekt speichern.

Der Editor definiert **nicht**, was ein Gebäude im Spiel tut. Produktion, Waren, Arbeiter, Baukosten, Technologie und andere Funktionalität bleiben im Hauptspiel.

## Räumliche Bedeutung

- `footprint`: Zellen, die zum Gebäude gehören.
- `blocked`: Teilmenge des Footprints, die nicht begehbar ist.
- begehbar: automatisch `footprint - blocked`.
- `entrance`: genau eine begehbare Footprint-Zelle als Navigations-/Interaktionsziel.
- `spriteAnchor`: Ausrichtung des Bildes gegenüber dem Raster.

## Bedienung

Desktop ist der Zielmodus. Die Seite darf auf Mobilgeräten geöffnet werden und zeigt dort einen Hinweis, wird aber nicht künstlich gesperrt.

Version 1 soll bewusst klein bleiben: Sprite-Import, Rasterbearbeitung, Anchor, Eingang, Validierung und Export. Gameplay-Editor, Animationen, mehrere Eingänge und komplexe Polygon-Hitboxen sind spätere Entscheidungen.
