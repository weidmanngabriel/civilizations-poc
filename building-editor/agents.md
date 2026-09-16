# Building Editor Agent Rules

Die Root-`agents.md` gilt weiterhin vollständig. Diese Datei ergänzt Regeln nur für `building-editor/`.

- Der Editor ist ein internes Werkzeug und bleibt von Gameplay-Logik getrennt.
- Die Seite ist öffentlich erreichbar, aber Desktop-first. Mobile Nutzung darf nicht absichtlich gesperrt werden; eine eigene mobile Optimierung ist nicht erforderlich.
- Räumliche Daten müssen dasselbe feine Hex-Raster und dieselbe Projektion wie das Hauptspiel verwenden. Gemeinsame Geometrie nicht duplizieren.
- Der Editor bearbeitet nur visuelle/räumliche Gebäudedaten: Sprite, Sprite-Anchor, Grundriss, blockierte Zellen und Eingang.
- Produktionsregeln, Arbeiter, Inventare, Kosten, Rezepte, Technologien und andere Gameplay-Funktionen gehören nicht in dieses Tool.
- Exportierte Runtime-Daten liegen unter `src/assets/buildings/<id>/`, nicht im Editor-Verzeichnis.
- Lokal darf der Vite-Entwicklungsserver Dateien in diesen Asset-Ordner schreiben. Der veröffentlichte statische Editor bietet nur Datei-Downloads an und benötigt keine GitHub-Zugangsdaten.
- Änderungen am Building-Visual-Schema müssen mit Root-`architecture.md` und Root-`concept.md` abgeglichen werden.
- **Aktuell ist keine Rückwärtskompatibilität erforderlich.** Der jeweils aktuelle Editor-/Building-Visual-Schemastand ist verbindlich. Alte Exporte dürfen bei Schemaänderungen abgelehnt werden; keine stillen Defaults, Migrationen oder Kompatibilitätsschichten ergänzen. Rückwärtskompatibilität erst implementieren, wenn der Nutzer sie ausdrücklich anfordert.
