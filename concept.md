# Produktkonzept

Diese Datei ist der aktuelle Einstieg in das Produktkonzept. Ausführliche unveränderte Regeln bleiben in [`concept-detail.md`](./concept-detail.md) dokumentiert. Bei Widersprüchen beschreibt diese Datei den neueren Stand.

Der aktive Umbau wird in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md) geführt.

## PoC 1: personenbasierte Produktionslogistik

Ziel bleibt eine personenbasierte Produktions- und Logistiksimulation auf einem Hex-Grid. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte und räumliche Planung wirkt direkt auf Produktion, Versorgung und Transport. Hunger und Schlaf konkurrieren mit Arbeit um die Zeit einzelner Personen.

## Feineres Raumraster

Die Welt verwendet intern ein **5× feineres Raster pro Raumachse**: aus 41 × 25 werden 205 × 125 Mikrozellen. Die sichtbare Kartengröße bleibt ungefähr gleich.

Das Mikroraster ist kein sichtbarer Brettspiel-Look. Gebäude und Äcker behalten ungefähr ihre räumliche Größe und belegen entsprechend viele Mikrozellen. Bewohner bewegen sich weiterhin flüssig und bleiben visuell gut lesbar.

## Untergrund und Ressourcen sind getrennt

Terrain beschreibt nur den Untergrund der Welt. Bäume, Lehm, Stein und spätere natürliche Ressourcen sind eigenständige Ressourcenobjekte, die auf diesem Untergrund liegen.

Ein Baum erzeugt kein eigenes „Wald-Terrain“. Wald entsteht spielerisch durch viele Bäume in räumlicher Nähe, nicht durch eine besondere Bodenkategorie.

Footprint und Wegblockierung sind getrennte Eigenschaften einer Ressource. Aktueller verbindlicher Stand:

- **Baum:** 1 Mikrozelle, blockiert Bewegung, 3 Holz pro Baum.
- **Busch:** 1 Mikrozelle, blockiert nicht; die Grafik darf größer als die Zelle sein.
- **Pilze:** 1 Mikrozelle, blockieren nicht.
- **Lehm:** 4 kompakte Mikrozellen, blockiert nicht.
- **Stein:** 4 kompakte Mikrozellen, blockiert.
- **Erz:** Zielrichtung ebenfalls ungefähr 4 Mikrozellen und blockierend.

Ein dichter Wald besitzt bewusst Lücken zwischen einzelnen Bäumen. Personen dürfen durch diese Lücken laufen, aber normale Wege dürfen nicht durch einen Baumstamm führen. Lehm darf dagegen betreten werden, während Stein seine komplette belegte Fläche für normale Wege sperrt.

**Blockierende Ressourcen werden von einer begehbaren Nachbarzelle aus benutzt.** Ein Holzfäller läuft also bis neben den Baum statt auf dessen Stamm. Dasselbe Prinzip gilt für andere ausdrücklich angewählte blockierende Ziele.

Auch nicht-blockierende Ressourcen reservieren ihren Footprint gegen Gebäude und neue Warenhaufen.

## Physische Rohstoffhaufen

Ein loser Warenhaufen besitzt eine konkrete Mikrozelle, genau einen Warentyp und 1 bis maximal 3 physische Einheiten. Verschiedene lose Warentypen teilen sich aktuell keine Zelle.

**Lose Warenhaufen sind niemals Hindernisse.** Bewohner können immer darüberlaufen. Ein Haufen verändert weder Untergrund noch Wegfindung, Bewegungskosten oder Kollision.

Neue Haufen werden nicht direkt auf Wasser, Berg, einem Gebäude-Footprint oder einer aktiven natürlichen Ressourcenfläche angelegt. Reservierungen schützen konkrete Einheiten vor Doppelabholung.

Holz, Lehm und Bruchstein verwenden dasselbe physische Grundmodell:

**Ressource → Abbauer → Bodenhaufen → Abholung → Verarbeitung/Lagerung.**

Nach einer fertigen Abbauaktion entsteht genau eine physische Einheit in der Nähe der Ressource. Vorhandene passende Haufen mit freiem Platz werden zuerst aufgefüllt. Ein Haufen hält höchstens drei Einheiten. Wenn die Quelle verschwindet, bleiben bereits abgelegte Haufen erhalten.

## Holz, Lehm und Stein

Jeder Baum enthält genau **3 Holz**. Nach einer fertigen Fällaktion entsteht eine Einheit Holz auf dem Boden in der Nähe des Baums. Die Ablagesuche erfolgt bis maximal 5 Mikrozellen.

Lehm- und Steinvorkommen sind endlich mit aktuell 10 Einheiten pro Quelle. Beide belegen jeweils vier kompakte Mikrozellen. Lehm bleibt begehbar, Stein blockiert seine Fläche. Nach jeder fertigen Abbauaktion liegt eine Einheit Lehm bzw. Bruchstein als physischer Bodenhaufen in der Nähe des Vorkommens.

Töpferei und Steinmetzhütte beziehen diese Rohstoffe aus dem normalen physischen Warenfluss statt aus einem sichtbaren lokalen Lager der Rohstoffquelle.

## Arbeitsflaggen

Holzfäller, Lehmgräber, Steinbrecher und Träger besitzen einen **lokalen Arbeitsbereich**, dessen Mittelpunkt durch eine sichtbare Arbeitsflagge festgelegt wird. Der aktuelle Radius beträgt fünf Weltkacheln.

Die Flagge gehört zur einzelnen Person, nicht zum Gebäude. Zwei Träger desselben Lagers können deshalb unterschiedliche Bereiche abdecken.

- Bei einem neuen Holzfäller oder Abbauer erscheint die erste Flagge am ersten tatsächlich gewählten Rohstoffvorkommen.
- Bei einem neuen Träger erscheint sie zunächst am zugewiesenen Arbeitsplatz.
- Abbauer wählen nur passende freie Rohstoffquellen innerhalb ihrer eigenen Flagge. Ist dort nichts mehr verfügbar, warten sie; sie wandern nicht automatisch über die Karte zum nächsten Vorkommen.
- Träger holen nur Warenquellen innerhalb ihrer eigenen Flagge. Die Zielstätte ihrer Lieferung bleibt ihr Arbeitsplatz.
- Wird eine Flagge verschoben, wird ein noch nicht abgeholtes Ziel außerhalb des neuen Bereichs verworfen. Bereits getragene Ware wird noch ausgeliefert.
- Der Spieler versetzt die Flagge über die ausgewählte Person. Ein kurzer Klick oder Tap setzt den neuen Mittelpunkt; Ziehen verschiebt weiterhin die Karte.

Die Arbeitsflagge beantwortet bewusst nur **„Wo darf diese Person arbeiten beziehungsweise abholen?“**. Langstrecken-Navigation über Wegweiser ist ein separates späteres System.

Händler bleiben vom Arbeitsflaggen-System getrennt und sind weiterhin der Mechanismus für bewusst eingerichtete Lager-zu-Lager-Transporte. Produktionsarbeiter und Bauarbeiter behalten ihre eigenen bedarfsgetriebenen Beschaffungsregeln.

## Ressourcenverteilung und Darstellung

Waldregionen bestehen aus mehreren einzelnen Bäumen mit bewussten Lücken. Lehm- und Steinvorkommen behalten ihre vierzelligen logischen Footprints und werden deterministisch unregelmäßig verteilt.

Lehm und Stein werden über mehrere sichtbare Teilstücke ihres Footprints dargestellt. Bodenhaufen zeigen eine, zwei oder drei Einheiten als unterschiedlich angeordnete Stücke. Diese Darstellung ändert keine Kollisions- oder Wirtschaftsregeln.

## Büsche

Beerenbüsche bleiben regenerative Naturquellen und keine transportierbare Ware. Logisch belegt ein Busch eine Mikrozelle und blockiert Bewegung nicht. Die Darstellung darf größer als diese Zelle sein.

## Berufserfahrung

Erfahrung wird pro Person und Beruf von 0 bis 100 gespeichert und bleibt bei Berufswechsel erhalten. Jede erfolgreich abgeschlossene berufliche Tätigkeit gibt genau 1 Erfahrungspunkt; abgebrochene oder nur teilweise ausgeführte Tätigkeiten geben keinen Punkt.

Aktuelle Beispiele:

- Produktionsberuf: ein fertiger Produktionszyklus,
- Holzfäller: eine gewonnene und physisch abgelegte Holzeinheit,
- Lehmgräber/Steinbrecher: eine gewonnene und physisch abgelegte Rohstoffeinheit,
- Träger/Händler: eine erfolgreich zugestellte Ware,
- Farmer: fertige Aussaat, Düngung oder Ernte,
- Bauarbeiter: ein fertiger Bau-Arbeitszyklus.

## Technologie-Freischaltungen

Eine Technologie wird dauerhaft freigeschaltet, sobald irgendeine Person erstmals 10 XP im zugeordneten Beruf erreicht:

- Träger → Lager,
- Holzfäller → Sägewerk,
- Sägewerker → Schreinerei,
- Farmer → Mühle,
- Müller → Bäckerei,
- Abbauer Lehm → Töpferei,
- Abbauer Stein → Steinmetzhütte.

Wohnhaus, Farm und Brunnen sind von Anfang an freigeschaltet. Baumenü und Gebäudeplatzierung verwenden dieselbe autoritative Freischaltlogik.

## Ereignisbasierte Entscheidungen

Autonome Bewohner treffen teure Zielentscheidungen nicht laufend neu. Für Hunger, Schlaf und Arbeit gilt: Ziel einmal wählen, dorthin laufen und erst am Ziel, nach Abschluss einer Tätigkeit oder bei einem dort festgestellten Fehlschlag neu entscheiden. Während des Weges bleibt die Entscheidung bestehen.

Ist aktuell kein gültiges Ziel oder keine passende Arbeitsaufgabe verfügbar, sucht nur die betroffene Person höchstens einmal pro Sekunde erneut. Das gilt auch für einen leeren Arbeitsflaggen-Bereich. Bewegung, Bedürfnisabbau und laufende Arbeit bleiben Teil der 60-Hz-Simulation.

## Darstellung und Zoom

Bewohner-Marker bleiben größer als einzelne Mikrozellen, sind gegenüber dem frühen Fine-Grid-Stand aber kompakt. Die Karte lässt sich mit Mausrad und Pinch bis auf 10× vergrößern.

## Gebäudeplatzierung auf Desktop und Touch

Beim Start des Baumodus wird die Karte abgedunkelt, gültige Baupositionen werden gleichzeitig als helle Bereiche hervorgehoben. Der aktuelle Ghost zeigt zusätzlich grün oder rot, ob die konkrete Position gültig ist.

Der vollständige Footprint aktiver natürlicher Ressourcen reserviert Raum gegen Gebäudeplatzierung unabhängig davon, ob die Ressource für Bewegung blockiert.

- **Desktop:** Bau-Ghost folgt der Maus; kurzer Linksklick bestätigt eine gültige Position; Escape bricht ab.
- **Touch:** kurzes Tippen setzt den Ghost; Ziehen verschiebt die Karte; der Bauen-Button bestätigt.

Beide Wege verwenden dieselbe Platzierungslogik.

## Unveränderte Produktbereiche

Für den vollständigen aktuellen Stand gelten zusätzlich die Details in [`concept-detail.md`](./concept-detail.md), insbesondere:

- Startzustand mit 12 Personen und HQ,
- Hunger und Schlaf,
- Beerenregeneration,
- Bau- und Abrisslogik,
- 60 Simulationsschritte/s bei 1×,
- organisch entstehende Wege,
- Produktionsketten und Gebäudeinventare,
- Händler als Lager-zu-Lager-Mechanismus,
- Farmen und Felder,
- Personenansicht,
- Touch- und Desktop-Bedienung,
- Technologiebaum und Handbuch.

Alte Aussagen in `concept-detail.md` über 41 × 25 als aktuelles Raster, Wald als Terrain, 10 Holz pro Baum, lokale Lehm-/Stein-Ausgabelager, das Betreten blockierender Ressourcen, global wandernde Abbauer oder einen festen gebäudezentrierten Träger-Sammelradius sind durch diese Datei überholt.
