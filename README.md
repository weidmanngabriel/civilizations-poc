# Civilizations PoC 1

Browserbasierter Wirtschafts- und Logistikprototyp mit TypeScript, Vite und Phaser 4.

## Lokal starten

Node.js 24 und npm verwenden:

```sh
npm ci
npm run dev
```

Die ausgegebene lokale Adresse mit `/civilizations-poc/` öffnen.

Für Prüfung und Produktionsbuild:

```sh
npm test
npm run build
npm run preview
```

## Aktueller Spielkern

Acht freie Personen starten am Hauptquartier. Zu Beginn gibt es keine Wege. Wiese und Wald sind begehbar; Wasser und Berge blockieren Bewegung.

Die Produktionskette lautet:

```text
Wald → Holz → Sägewerk → Bretter → Schreinerei → Holzwerkzeuge → Lager
```

Lager, Sägewerke und Schreinereien werden direkt auf der Karte gebaut. Personen werden über das jeweilige Gebäude beziehungsweise global am HQ zugewiesen. Waren bleiben physisch an ihrem Ort und müssen sichtbar transportiert werden.

Die Simulation läuft intern mit einem festen 60-Hz-Takt. Unten kann das gesamte Spiel mit **0,5× / 1× / 2× / 3×** beschleunigt oder pausiert werden. Rendering und Simulation sind voneinander getrennt.

Personen laufen auf normalen Kacheln mit Grundtempo. Wege sind **30 % schneller**. Wenn eine Wiesen-Kachel innerhalb von acht Simulationssekunden achtmal überquert wird, entsteht dort automatisch ein dauerhafter Weg. Wege können im PoC zusätzlich weiterhin manuell gebaut oder entfernt werden.

## Dokumentation und Deployment

`agents.md`, `architecture.md`, `concept.md` und `POC1_IMPLEMENTATION_PLAN.md` beschreiben Regeln und Umfang. `concept.md` und `architecture.md` bilden den aktuellen Produkt- und Technikstand ab.

Der GitHub-Actions-Workflow testet und baut Änderungen auf `main` und veröffentlicht anschließend auf GitHub Pages.
