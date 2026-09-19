# Character Lab – Agent Instructions

## Zweck

Das Character Lab ist ein eigenständiges Browser-Tool zum Erstellen, Prüfen und Abspielen einfacher 3D-Charakterposen und -animationen. Es ist bewusst vom Hauptspiel getrennt und dient als experimentelle Produktions- und Testumgebung für spätere 3D-Bewohnerdarstellung.

## Leitlinien

- Halte das Tool klein, verständlich und datengetrieben.
- Animation und Gameplay bleiben getrennt. Das Tool kennt keine Berufe, Produktionszeiten oder Simulationsregeln.
- Animationen verwenden normierten Fortschritt von 0 bis 1 statt fester Sekunden.
- Keyframes speichern absolute lokale Gelenkwinkel, keine relativen Rotationsbefehle.
- Gelenkgrenzen sind Teil der Character-Definition und werden beim Bearbeiten, Laden und Abspielen immer erzwungen.
- Die Darstellung soll mit einer orthografischen isometrischen Kamera funktionieren.
- Der erste Referenzcharakter bleibt bewusst blockig und technisch simpel.
- Import und Export müssen menschenlesbares JSON verwenden.
- Kernfunktionen sollen zusätzlich programmatisch steuerbar sein, damit ein KI-Agent ohne Mausinteraktion Posen und Animationen erzeugen kann.
- Eine externe Netzwerk-/HTTP-API ist nicht Teil von v1. Stattdessen stellt die Seite eine stabile Browser-API über `window.characterLab` bereit.
- Desktop ist die primäre Oberfläche, Touch muss grundlegende Bedienung trotzdem erlauben.
- Änderungen an Datenformat, Architektur oder Produktumfang müssen in den lokalen `architecture.md` bzw. `concept.md` dokumentiert werden.

## Entwicklungsworkflow

Für Änderungen gelten zusätzlich die Workflow-Regeln aus der Root-`agents.md`: temporärer Branch, PR, Tests/Build und Squash-Merge auf `main`.

Vor jeder Implementierung in diesem Unterprojekt zuerst diese Datei und `architecture.md` lesen. Bei Änderungen am Funktionsumfang zusätzlich `concept.md` lesen.


## Animation review workflow

For meaningful animation changes, use the automated Character Lab review export instead of judging only from JSON. CI runs `npm run capture:character-lab -- woodcut 21` and uploads the resulting PNG sequence as a workflow artifact. Review representative and transition frames before considering animation work complete. Keep capture mode deterministic and free of editor overlays.
