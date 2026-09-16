# Building visual assets

Der Gebäudeeditor schreibt lokale Exporte in Unterordner nach folgendem Muster:

```text
src/assets/buildings/<building-id>/
  building.json
  sprite.png|webp
```

`building.json` folgt `BuildingVisualDefinition` aus `src/buildings/buildingVisualDefinition.ts`. Gameplay-Daten wie Rezepte, Arbeiter, Kosten oder Technologien gehören nicht in diesen Ordner.
