# Civilizations PoC 1

Ein rundenbasierter Wirtschaftsprototyp mit TypeScript, Vite und Phaser 4.

## Lokal starten

Node.js 24 und npm verwenden:

```sh
npm ci
npm run dev
```

Die ausgegebene lokale Adresse mit `/civilizations-poc/` öffnen.

```sh
npm test
npm run build
npm run preview
```

## Spielen

Acht freie Personen starten am Hauptquartier. Für eine vollständige Kette:

1. Zwei Arbeiter dem Wald zuweisen.
2. Je einen Arbeiter und einen Träger Sägewerk und Schreinerei zuweisen.
3. Zwei Träger dem Lager zuweisen.
4. Mit **Nächste Runde** bewegen und produzieren lassen.

Wald → Holz → Sägewerk → Bretter → Schreinerei → Holzwerkzeuge → Lager.
Eine Kante benötigt eine Runde; Produktion benötigt fünf Arbeitsrunden. Jede Person trägt eine Einheit. Arbeiter holen fehlende Rohstoffe auch selbst. Wiesen, Berge und Fluss sind nicht begehbar.

Besetzung lässt sich jederzeit ändern. Freigesetzte Personen laufen zum HQ und können unterwegs neu zugewiesen werden. Die Debug-Steuerung unter der Karte fügt freie Personen hinzu oder entfernt freie Personen am HQ. Neuladen setzt das Spiel zurück; Savegames und automatischer Rundenlauf sind nicht Teil dieses PoC.

## Dokumentation und Deployment

`agents.md`, `architecture.md`, `concept.md` und `POC1_IMPLEMENTATION_PLAN.md` beschreiben Regeln und Umfang.

Der Workflow testet, baut und veröffentlicht ausschließlich bei Änderungen auf `main` (oder manuellem Start). Unter **Settings → Pages → Source** muss **GitHub Actions** ausgewählt sein. Ziel: https://weidmanngabriel.github.io/civilizations-poc/
