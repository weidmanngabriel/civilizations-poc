# Building visual assets

Für jeden `BuildingKind` existiert ein gleichnamiger Asset-Ordner:

```text
src/assets/buildings/<building-key>/
  building.json
  sprite.png|webp
```

Der Ordnername entspricht dem `BuildingKind`-Key, zum Beispiel `hq`, `mill`, `field`, `bakery` oder `warehouse`.

`building.json` folgt normalerweise `BuildingVisualDefinition` aus `src/buildings/buildingVisualDefinition.ts`. Gameplay-Daten wie Rezepte, Arbeiter, Kosten oder Technologien gehören nicht in diesen Ordner.

Noch nicht gestaltete Gebäudetypen verwenden bewusst einen kleinen Platzhalter:

```json
{
  "placeholder": true,
  "id": "<building-key>",
  "sprite": "sprite.png"
}
```

Solche Platzhalter werden von der Runtime nicht registriert und verändern das aktuelle Gameplay nicht. Um ein Gebäude auf den Editor-/Sprite-Pfad umzustellen, müssen nur `building.json` und das Sprite im bestehenden Ordner durch den echten Editor-Export ersetzt und committed werden. Nach dem nächsten Build verwendet die Runtime die echte Definition.

Bei jedem zukünftig neu eingeführten `BuildingKind` wird im selben Implementierungs-Run automatisch der gleichnamige Ordner mit `building.json` und Sprite-Platzhalter angelegt. Dafür gibt es bewusst keinen Build-Fehler als Erzwingungsmechanismus.
