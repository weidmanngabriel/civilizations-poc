# Produktkonzept

Diese Datei ist der aktuelle Einstieg in das Produktkonzept. Ausführliche unveränderte Regeln bleiben in [`concept-detail.md`](./concept-detail.md) dokumentiert. Bei Widersprüchen beschreibt diese Datei den neueren Stand.

Der aktive Umbau wird in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md) geführt.

## PoC 1: personenbasierte Produktionslogistik

Ziel bleibt eine personenbasierte Produktions- und Logistiksimulation auf einem Hex-Grid. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte und räumliche Planung wirkt direkt auf Produktion, Versorgung und Transport. Hunger und Schlaf konkurrieren mit Arbeit um die Zeit einzelner Personen.

## Feineres Raumraster

Die Welt verwendet intern ein **5× feineres Raster pro Raumachse**: aus 41 × 25 werden 205 × 125 Mikrozellen. Die sichtbare Kartengröße bleibt ungefähr gleich. Gebäude und Äcker belegen viele Mikrozellen; Bewohner bewegen sich flüssig und bleiben visuell lesbar.

## Untergrund, Ressourcen und Waren

Terrain beschreibt nur den Untergrund. Bäume, Lehm, Stein und spätere natürliche Ressourcen sind eigenständige Weltobjekte. Wald entsteht durch viele einzelne Bäume, nicht durch einen besonderen Bodentyp.

Aktueller verbindlicher Stand:

- **Baum:** 1 Mikrozelle, blockierend, 3 Holz.
- **Busch:** 1 Mikrozelle, nicht blockierend.
- **Pilze:** 1 Mikrozelle, nicht blockierend.
- **Lehm:** 4 kompakte Mikrozellen, nicht blockierend.
- **Stein:** 4 kompakte Mikrozellen, blockierend.
- **Erz:** Zielrichtung ungefähr 4 Mikrozellen und blockierend.

Blockierende Ressourcen werden von einer begehbaren Nachbarzelle aus benutzt. Lose Warenhaufen enthalten einen Warentyp und 1–3 Einheiten, sind immer begehbar und bleiben nach dem Verschwinden ihrer Quelle erhalten.

Holz, Lehm und Bruchstein folgen dem physischen Grundmodell:

**Ressource → Abbauer → Bodenhaufen → Abholung → Verarbeitung/Lagerung.**

## Arbeitsflaggen

Holzfäller, Lehmgräber, Steinbrecher sowie **Lager- und HQ-Träger** besitzen einen lokalen Arbeitsbereich, dessen Mittelpunkt durch eine sichtbare persönliche Arbeitsflagge festgelegt wird. Der aktuelle Radius beträgt fünf Weltkacheln.

Die Flagge gehört zur einzelnen Person, nicht zum Gebäude. Zwei Träger desselben Lagers können deshalb unterschiedliche Bereiche abdecken.

- Bei einem neuen Holzfäller oder Abbauer erscheint die erste Flagge am ersten tatsächlich gewählten Rohstoffvorkommen.
- Bei einem neuen Lager-/HQ-Träger erscheint sie zunächst am zugewiesenen Lagergebäude.
- Abbauer wählen nur passende freie Rohstoffquellen innerhalb ihrer eigenen Flagge. Ist dort nichts mehr verfügbar, warten sie und wandern nicht automatisch über die Karte zum nächsten Vorkommen.
- Lager-/HQ-Träger holen nur Nicht-Lager-Quellen innerhalb ihrer Flagge. Lager-zu-Lager-Verteilung bleibt Händlersache.
- Wird eine Flagge verschoben, wird ein noch nicht abgeholtes Ziel außerhalb des neuen Bereichs verworfen. Bereits getragene Ware wird noch ausgeliefert.
- Der Spieler versetzt die Flagge über die ausgewählte Person. Ein kurzer Klick oder Tap setzt den neuen Mittelpunkt; Ziehen verschiebt weiterhin die Karte.

Produktions-Träger behalten in dieser ersten Stufe ihre bestehende bedarfsgetriebene Beschaffung. Damit ändern wir nicht gleichzeitig die Produktionskettenlogik; die Ausweitung auf weitere Berufe kann später bewusst entschieden werden.

Die Arbeitsflagge beantwortet **„Wo darf diese Person Ressourcen abbauen oder lokal einsammeln?“**. Langstrecken-Navigation über Wegweiser ist ein separates späteres System.

## Berufserfahrung und Technologien

Erfahrung wird pro Person und Beruf von 0 bis 100 gespeichert und bleibt bei Berufswechsel erhalten. Jede erfolgreich abgeschlossene berufliche Tätigkeit gibt genau 1 Erfahrungspunkt; abgebrochene Tätigkeiten geben keinen Punkt.

Eine Technologie wird dauerhaft freigeschaltet, sobald irgendeine Person erstmals 10 XP im zugeordneten Beruf erreicht. Wohnhaus, Farm und Brunnen sind von Anfang an verfügbar; weitere Gebäude werden über die bestehenden Berufsregeln freigeschaltet.

## Ereignisbasierte Entscheidungen

Autonome Bewohner treffen teure Zielentscheidungen nicht laufend neu. Ein Ziel bleibt während der Reise bestehen und wird an Aufgabenübergängen neu bewertet. Ist kein gültiges Ziel verfügbar, sucht nur die betroffene Person höchstens einmal pro Sekunde erneut. Das gilt auch für einen leeren Arbeitsflaggen-Bereich.

## Darstellung, Zoom und Eingabe

Bewohner bleiben größer als einzelne Mikrozellen. Die Karte lässt sich per Mausrad und Pinch bis 10× vergrößern.

Gebäudeplatzierung bleibt für Desktop und Touch getrennt bedienbar, verwendet aber dieselbe autoritative Platzierungslogik. Für Arbeitsflaggen gilt ebenfalls: kurzer Klick/Tap setzt die Flagge, Drag bleibt Kartenbewegung.

## Unveränderte Produktbereiche

Für den vollständigen aktuellen Stand gelten zusätzlich die Details in [`concept-detail.md`](./concept-detail.md), insbesondere Startzustand, Hunger/Schlaf, Beeren, Bau/Abriss, 60-Hz-Simulation, organische Wege, Produktionsketten, Händler, Farmen, Personenansicht, Technologiebaum und Handbuch.

Alte Aussagen in `concept-detail.md` über das grobe Raster, Wald als Terrain, alte Rohstofflagerung, direktes Betreten blockierender Ressourcen, global wandernde Abbauer oder einen festen gebäudezentrierten Lagerträger-Sammelradius sind durch diese Datei überholt.
