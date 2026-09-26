# Building Editor Concept

Der Gebäudeeditor ist ein internes Authoring-Werkzeug für neue Gebäudevisuals. Er ist als Unterseite öffentlich erreichbar, wird aber ausschließlich für Desktop-Bedienung optimiert.

## Zweck

Ein neues Gebäude soll ohne Codeänderung räumlich beschrieben werden können:

1. Optional ein vorhandenes Projektgebäude aus der alphabetisch sortierten Liste laden; Placeholder sind ebenfalls auswählbar und liefern mindestens ihre ID.
2. Sprite laden oder hineinziehen.
3. Gebäude-ID festlegen.
4. Sprite passend skalieren und relativ zum feinen Spielraster ausrichten.
5. Zellen des Gebäudegrundrisses markieren.
6. Zellen innerhalb des Grundrisses als blockiert markieren.
7. Genau eine begehbare Eingangszelle wählen.
8. Definition exportieren oder lokal direkt ins Projekt speichern.
9. Einen aktuellen Export aus `building.json` plus zugehörigem Sprite wieder vollständig importieren und weiterbearbeiten.

Der Editor definiert **nicht**, was ein Gebäude im Spiel tut. Produktion, Waren, Arbeiter, Baukosten, Technologie und andere Funktionalität bleiben im Hauptspiel.

## Räumliche Bedeutung

- `footprint`: Zellen, die zum Gebäude gehören.
- `blocked`: Teilmenge des Footprints, die nicht begehbar ist.
- begehbar: automatisch `footprint - blocked`.
- `entrance`: genau eine begehbare Footprint-Zelle als Navigations-/Interaktionsziel.
- `spriteAnchor`: Ausrichtung des Bildes gegenüber dem Raster als normalisierte x/y-Position innerhalb des Sprites.
- `spriteWorldWidth`: positive sichtbare Breite des unveränderten Sprites in Weltpixeln.

Das aktuelle Building-Visual-Schema ist Version 3. Sprite-Größe und Anchor bleiben dadurch unabhängig von der Pixelauflösung der Quelldatei.

## Bedienung und Vorschau

Desktop ist der Zielmodus. Die Seite darf auf Mobilgeräten geöffnet werden und zeigt dort einen Hinweis, wird aber nicht künstlich gesperrt.

Die Arbeitsfläche ist eine WYSIWYG-Vorschau der Spielprojektion: Rasterzentren und sichtbare Hex-Geometrie stammen aus derselben gemeinsamen Projektion wie im Spiel. Der Editor vergrößert diese Weltansicht nur mit einem festen Vorschau-Zoom. Sprite und Raster erhalten denselben Vorschau-Zoom, sodass ihre Größenrelation der späteren Runtime entspricht.

Große Sprites werden beim Laden zunächst durch Anpassen von `spriteWorldWidth` passend in den Arbeitsbereich eingepasst. Danach lässt sich die Breite in Weltpixeln per Slider oder Zahlenfeld ändern. Das Sprite kann mit **Sprite verschieben** direkt über dem Raster positioniert werden; dadurch wird der relative Anchor automatisch angepasst.

Während Grundriss, blockierte Zellen oder Eingang bearbeitet werden, werden markierte Zellen bewusst kontrastreich über dem Sprite dargestellt: kräftige Füllung, deutliche Kontur und Glow. Der Eingang ist am stärksten hervorgehoben. Das Sprite wird in diesen Rasterwerkzeugen leicht abgedunkelt; im Werkzeug **Sprite verschieben** bleibt es unverändert hell. Die Stärke dieser Markierungs-Overlays kann im Editor per Slider verändert werden; diese reine Vorschau-Einstellung wird nicht exportiert.

Rasterbearbeitung folgt einem Paint-Verhalten: Ein einzelner Klick toggelt die angeklickte Zelle. Wird die Maustaste gehalten und über weitere Zellen gezogen, bestimmt das Ergebnis der ersten Zelle den gesamten Drag: wurde sie gesetzt, werden alle erstmals überfahrenen Zellen gesetzt; wurde sie entfernt, werden alle erstmals überfahrenen Zellen entfernt. `Shift + Klick` beziehungsweise `Shift + Drag` erzwingt das Entfernen unabhängig vom Ausgangszustand. Jede Zelle wird innerhalb eines Drags höchstens einmal verarbeitet.

Beim Werkzeug **Blockierte Zellen** wird eine leere Zelle beim Setzen automatisch Teil des Grundrisses. Wird diese rote Zelle erneut getoggelt oder mit `Shift` zurückgesetzt, wird sie vollständig entfernt und nicht als grüne Grundrisszelle stehen gelassen.

Vorhandene Projektgebäude können über **Vorhandenes Gebäude** geladen werden. Die Einträge zeigen ihre deutschen Gebäudenamen und sind alphabetisch sortiert. Für bereits konfigurierte Slots werden Sprite und alle visuellen/räumlichen Werte geladen. Placeholder bleiben sichtbar; bei ihrer Auswahl wird die vorhandene ID übernommen und ausdrücklich angezeigt, dass noch keine Konfiguration existiert.

Ein Export kann über **Gebäudedefinition öffnen** geladen werden. Dabei werden `building.json` und das darin referenzierte PNG/WebP gemeinsam ausgewählt. Alternativ können beide Dateien zusammen auf die Sprite-Fläche gezogen werden. Der aktuelle Editorzustand wird nur ersetzt, wenn Schema, Rasterdaten und Sprite vollständig zusammenpassen.

Aktuell wird **keine Rückwärtskompatibilität** gepflegt. Nur der aktuelle Editor-/Building-Visual-Schemastand muss funktionieren; ältere Exporte dürfen bei Schemaänderungen abgelehnt werden. Rückwärtskompatibilität wird erst ergänzt, wenn sie ausdrücklich angefordert wird.

Version 3 soll bewusst klein bleiben: Sprite-Import, Weltbreite und Positionierung, Export-Reimport, Rasterbearbeitung inklusive Paint-Drag und Overlay-Stärke, Anchor, Eingang, Validierung und Export. Gameplay-Editor, Animationen, mehrere Eingänge und komplexe Polygon-Hitboxen sind spätere Entscheidungen.
