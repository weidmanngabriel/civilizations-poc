# Produktkonzept

Diese Datei ist der aktuelle Einstieg in das Produktkonzept. Ausführliche unveränderte Regeln bleiben in [`concept-detail.md`](./concept-detail.md) dokumentiert. Bei Widersprüchen beschreibt diese Datei den neueren Stand.

Der aktive Umbau wird in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md) geführt.

## PoC 1: personenbasierte Produktionslogistik

Ziel bleibt eine personenbasierte Produktions- und Logistiksimulation auf einem Hex-Grid. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte und räumliche Planung wirkt direkt auf Produktion, Versorgung und Transport. Hunger und Schlaf konkurrieren mit Arbeit um die Zeit einzelner Personen.

## Feineres Raumraster — Phase A abgeschlossen

Die Welt verwendet intern ein **5× feineres Raster pro Raumachse**: aus 41 × 25 werden 205 × 125 Mikrozellen. Die sichtbare Kartengröße bleibt ungefähr gleich.

Das Mikroraster ist kein sichtbarer Brettspiel-Look. Gebäude und Äcker behalten ungefähr ihre räumliche Größe und belegen entsprechend viele Mikrozellen. Bewohner bewegen sich weiterhin flüssig und bleiben visuell gut lesbar.

## Untergrund und Ressourcen sind getrennt

Terrain beschreibt nur den Untergrund der Welt. Bäume, Lehm, Stein und spätere natürliche Ressourcen sind eigenständige Ressourcenobjekte, die auf diesem Untergrund liegen.

Ein Baum erzeugt deshalb kein eigenes „Wald-Terrain“. Unter einem Baum kann beispielsweise Wiese liegen; später kann derselbe Ressourcentyp grundsätzlich auch auf anderem geeigneten Untergrund vorkommen. Wald entsteht spielerisch durch viele Bäume in räumlicher Nähe, nicht durch eine besondere Bodenkategorie.

Footprint und Wegblockierung sind getrennte Eigenschaften einer Ressource. Aktueller verbindlicher Stand:

- **Baum:** 1 Mikrozelle, blockiert Bewegung, 3 Holz pro Baum.
- **Busch:** 1 Mikrozelle, blockiert nicht; die Grafik darf größer als die Zelle sein.
- **Pilze:** 1 Mikrozelle, blockieren nicht.
- **Lehm:** 4 kompakte Mikrozellen, blockiert nicht.
- **Stein:** 4 kompakte Mikrozellen, blockiert.
- **Erz:** Zielrichtung ebenfalls ungefähr 4 Mikrozellen und blockierend.

Ein dichter Wald besitzt bewusst Lücken zwischen einzelnen Bäumen. Personen dürfen durch diese Lücken laufen, aber normale Wege dürfen nicht durch einen Baumstamm führen. Lehm darf dagegen betreten werden, während Stein seine komplette belegte Fläche für normale Wege sperrt.

Auch nicht-blockierende Ressourcen reservieren ihren Footprint gegen Gebäude und neue Warenhaufen. Ein Gebäude kann also nicht einfach auf einem Lehmvorkommen gebaut werden.

## Physische Rohstoffhaufen — Phasen B bis D abgeschlossen

Ein loser Warenhaufen besitzt eine konkrete Mikrozelle, genau einen Warentyp und 1 bis maximal 3 physische Einheiten. Mehrere Einheiten desselben Typs dürfen auf derselben Zelle bis zur Kapazität 3 gestapelt werden. Verschiedene lose Warentypen teilen sich aktuell keine Zelle.

**Lose Warenhaufen sind niemals Hindernisse.** Bewohner können immer darüberlaufen. Ein Haufen verändert weder Untergrund noch Wegfindung, Bewegungskosten oder Kollision.

Neue Haufen werden trotzdem nicht direkt auf Wasser, Berg, einem Gebäude-Footprint oder einer aktiven natürlichen Ressourcenfläche angelegt. Reservierungen schützen konkrete Einheiten vor Doppelabholung.

Holz, Lehm und Bruchstein verwenden jetzt dasselbe physische Grundmodell:

**Ressource → Abbauer → Bodenhaufen → Abholung → Verarbeitung/Lagerung.**

Nach einer fertigen Abbauaktion entsteht genau eine physische Einheit in der Nähe der Ressource. Vorhandene passende Haufen mit freiem Platz werden zuerst aufgefüllt. Ein Haufen hält höchstens drei Einheiten. Wenn die Quelle verschwindet, bleiben bereits abgelegte Haufen erhalten.

## Holz — Phase C abgeschlossen

Jeder Baum enthält genau **3 Holz**. Nach einer fertigen Fällaktion entsteht eine Einheit Holz auf dem Boden in der Nähe des Baums. Die Ablagesuche erfolgt aktuell bis maximal 5 Mikrozellen, also ungefähr innerhalb einer früheren großen Kachel.

Bäume sind eigenständige blockierende Ressourcenobjekte auf normalem Untergrund. Nach der Erschöpfung verschwindet nur das Ressourcenobjekt; der Untergrund darunter bleibt unverändert und die Zelle wird wieder frei begehbar.

## Lehm und Stein — Phase D abgeschlossen

Lehm- und Steinvorkommen bleiben endlich mit aktuell 10 Einheiten pro Quelle. Beide liegen als eigenständige Ressourcenobjekte auf normalem Untergrund und belegen jeweils vier kompakte Mikrozellen.

Lehm bleibt auf allen vier Zellen begehbar. Stein blockiert seine vier Zellen. Nach jeder fertigen Abbauaktion liegt eine Einheit Lehm bzw. Bruchstein als physischer Bodenhaufen in der Nähe des Vorkommens. Lehmgräber und Steinbrecher wechseln nach Erschöpfung automatisch zum nächsten passenden Vorkommen; bereits abgelegte Ware bleibt liegen.

Töpferei und Steinmetzhütte beziehen diese Rohstoffe aus dem normalen physischen Warenfluss statt aus einem sichtbaren lokalen Lager der Rohstoffquelle.

## Ressourcenverteilung und Darstellung — Phase E abgeschlossen

Die bisherigen Waldregionen bestehen jetzt aus deutlich mehr einzelnen Bäumen. Aus jedem historischen Waldpunkt entstehen mehrere versetzte Baumpositionen. Dadurch wirken Wälder dichter, behalten aber Lücken, durch die Bewohner laufen können.

Lehm- und Steinvorkommen behalten ihre vierzelligen logischen Footprints und ihre bisherigen Mengen. Ihre Positionen entlang von Flüssen und Bergen werden deterministisch unregelmäßiger verteilt, statt einfach der Karten-Scanreihenfolge zu folgen.

Lehm und Stein werden über mehrere sichtbare Teilstücke ihres Footprints dargestellt. Bodenhaufen zeigen eine, zwei oder drei Einheiten als unterschiedlich angeordnete Stücke; Holz, Lehm und Bruchstein sind optisch voneinander unterscheidbar. Diese Darstellung ändert keine Kollisions- oder Wirtschaftsregeln.

## Büsche

Beerenbüsche bleiben regenerative Naturquellen und keine transportierbare Ware. Logisch belegt ein Busch eine Mikrozelle und blockiert Bewegung nicht. Die Darstellung darf bewusst größer als diese Zelle sein, damit Büsche auch auf dem feinen Raster gut sichtbar bleiben.

Die Buschdarstellung verwendet dieselbe Kartenprojektion wie das restliche Fine Grid. Dadurch bleiben Position und Größe auch bei Zoom und auf mobilen Geräten korrekt.

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

## Gebäudeplatzierung auf Desktop und Touch

Beim Start des Baumodus wird die Karte abgedunkelt, gültige Baupositionen werden gleichzeitig als helle Bereiche hervorgehoben. Der aktuelle Ghost zeigt zusätzlich grün oder rot, ob die konkrete Position gültig ist.

Der vollständige Footprint aktiver natürlicher Ressourcen reserviert Raum gegen Gebäudeplatzierung unabhängig davon, ob die Ressource für Bewegung blockiert. Lehm kann also begehbar sein und trotzdem nicht einfach von einem Gebäude überbaut werden.

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
- HQ- und Lagerlogik,
- Händler als Lager-zu-Lager-Mechanismus,
- Farmen und Felder,
- Personenansicht,
- Touch- und Desktop-Bedienung,
- Technologiebaum und Handbuch.

Alte Aussagen in `concept-detail.md` über 41 × 25 als aktuelles Raster, Wald als Terrain, 10 Holz pro Baum oder lokale Lehm-/Stein-Ausgabelager sind durch diese Datei überholt.