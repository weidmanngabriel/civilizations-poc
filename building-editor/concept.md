# Building Editor Concept

Der Gebäudeeditor ist ein internes Authoring-Werkzeug für neue Gebäudevisuals. Er ist als Unterseite öffentlich erreichbar, wird aber ausschließlich für Desktop-Bedienung optimiert.

## Zweck

Ein neues Gebäude soll ohne Codeänderung räumlich beschrieben werden können:

1. Sprite laden oder hineinziehen.
2. Gebäude-ID festlegen.
3. Sprite passend skalieren und relativ zum feinen Spielraster ausrichten.
4. Zellen des Gebäudegrundrisses markieren.
5. Zellen innerhalb des Grundrisses als blockiert markieren.
6. Genau eine begehbare Eingangszelle wählen.
7. Definition exportieren oder lokal direkt ins Projekt speichern.
8. Einen aktuellen Export aus `building.json` plus zugehörigem Sprite wieder vollständig importieren und weiterbearbeiten.

Der Editor definiert **nicht**, was ein Gebäude im Spiel tut. Produktion, Waren, Arbeiter, Baukosten, Technologie und andere Funktionalität bleiben im Hauptspiel.

## Räumliche Bedeutung

- `footprint`: Zellen, die zum Gebäude gehören.
- `blocked`: Teilmenge des Footprints, die nicht begehbar ist.
- begehbar: automatisch `footprint - blocked`.
- `entrance`: genau eine begehbare Footprint-Zelle als Navigations-/Interaktionsziel.
- `spriteAnchor`: Ausrichtung des Bildes gegenüber dem Raster, gespeichert in Original-Sprite-Pixeln.
- `spriteScale`: positive Darstellungs-Skalierung des unveränderten Original-Sprites in der späteren Runtime.

## Bedienung und Vorschau

Desktop ist der Zielmodus. Die Seite darf auf Mobilgeräten geöffnet werden und zeigt dort einen Hinweis, wird aber nicht künstlich gesperrt.

Die Arbeitsfläche ist eine WYSIWYG-Vorschau der Spielprojektion: Rasterzentren und sichtbare Hex-Geometrie stammen aus derselben gemeinsamen Projektion wie im Spiel. Der Editor vergrößert diese Weltansicht nur mit einem festen Vorschau-Zoom. Sprite und Raster erhalten denselben Vorschau-Zoom, sodass ihre Größenrelation der späteren Runtime entspricht.

Große Sprites werden beim Laden zunächst durch Anpassen von `spriteScale` passend in den Arbeitsbereich eingepasst. Danach lässt sich die Runtime-Skalierung per Slider oder Prozentfeld ändern. Das Sprite kann mit **Sprite verschieben** direkt über dem Raster positioniert werden; dadurch wird der Anchor automatisch angepasst.

Ein Export kann über **Export importieren** geladen werden. Dabei werden `building.json` und das darin referenzierte PNG/WebP gemeinsam ausgewählt. Alternativ können beide Dateien zusammen auf die Sprite-Fläche gezogen werden. Der aktuelle Editorzustand wird nur ersetzt, wenn Schema, Rasterdaten und Sprite vollständig zusammenpassen.

Aktuell wird **keine Rückwärtskompatibilität** gepflegt. Nur der aktuelle Editor-/Building-Visual-Schemastand muss funktionieren; ältere Exporte dürfen bei Schemaänderungen abgelehnt werden. Rückwärtskompatibilität wird erst ergänzt, wenn sie ausdrücklich angefordert wird.

Version 2 soll bewusst klein bleiben: Sprite-Import, Skalierung und Positionierung, Export-Reimport, Rasterbearbeitung, Anchor, Eingang, Validierung und Export. Gameplay-Editor, Animationen, mehrere Eingänge und komplexe Polygon-Hitboxen sind spätere Entscheidungen.
