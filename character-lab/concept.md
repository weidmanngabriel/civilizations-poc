# Character Lab Concept

## Ziel

Das Character Lab soll unabhängig vom Hauptspiel beweisen, dass einfache 3D-Bewohner in einer orthografisch-isometrischen Ansicht überzeugend funktionieren und sich Animationen datengetrieben erstellen lassen.

## v1-Charakter

Der Referenzcharakter ist bewusst blockig:

- ein quaderförmiger Kopf,
- ein quaderförmiger Torso,
- zwei quaderförmige Arme,
- zwei quaderförmige Beine.

Arme und Beine bewegen sich nur vorwärts/rückwärts. Der Kopf kann bis zu den in `character.json` definierten Grenzen nach links/rechts und oben/unten drehen.

## Posen und Animationen

Eine Pose besteht aus absoluten lokalen Gelenkwinkeln.

Animationen bestehen aus Keyframes zwischen 0 % und 100 % Fortschritt. Der Editor interpoliert die Zwischenzustände mit einer pro Animation wählbaren Kurve: linear, Ease In, Ease Out oder Ease In/Out. Ease In/Out ist der Standard für die Beispielanimationen und erzeugt weichere Richtungswechsel. Die Animationsdatei enthält keine reale Dauer und keine Gameplay-Events.

v1 liefert zwei Beispielanimationen:

- `idle`
- `walk`

## Bedienung

Die Website bietet:

- kompakte, beim Scrollen sticky bleibende 3D-Vorschau,
- 360°-Drehung des gesamten Charakters,
- feste acht Blickrichtungen,
- Zoom,
- Auswahl eines Körperteils,
- Slider für erlaubte Gelenkachsen,
- Fortschrittsregler von 0 bis 100 %,
- wählbare Interpolation (Linear, Ease In, Ease Out, Ease In/Out),
- Keyframe an aktueller Position setzen/löschen,
- Wiedergabe/Pause,
- Animation als JSON importieren,
- Animation als JSON exportieren,
- Reset auf Beispielanimationen,
- Hinweis „Neue Version verfügbar“ mit manuellem Neu-laden-Button, wenn ein neuer Deploy erkannt wurde.

## KI-Nutzbarkeit

Ein KI-Agent soll das Character Lab später ohne visuelle Maussteuerung bedienen können. v1 schafft dafür bereits eine Browser-API über `window.characterLab`, die dieselben validierten Kernoperationen wie die UI verwendet.

Eine externe API oder ein eigenes Agent-Protokoll ist bewusst v2. Das Datenformat und die Browser-API sollen so stabil und einfach bleiben, dass diese Schicht später ohne Umbau der Animationen ergänzt werden kann.

## Nicht Teil von v1

- Hauptspiel-/Phaser-Integration,
- komplexes Skeleton oder Skinning,
- IK,
- Kleidung,
- Haare,
- Werkzeuge,
- Rüstung,
- GLTF-Import,
- Asset-Export ins Hauptspiel,
- Netzwerk-API,
- Gameplay-Events in Animationen.
