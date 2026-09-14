# Produktkonzept

Diese Datei ist der aktuelle Einstieg in das Produktkonzept. Ausführliche unveränderte Regeln bleiben in [`concept-detail.md`](./concept-detail.md) dokumentiert. Bei Widersprüchen beschreibt diese Datei den neueren Stand.

Der aktive Umbau wird in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md) geführt.

## PoC 1: personenbasierte Produktionslogistik

Ziel bleibt eine personenbasierte Produktions- und Logistiksimulation auf einem Hex-Grid. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte und räumliche Planung wirkt direkt auf Produktion, Versorgung und Transport. Hunger und Schlaf konkurrieren mit Arbeit um die Zeit einzelner Personen.

## Feineres Raumraster — Phase A abgeschlossen

Die Welt verwendet intern ein **5× feineres Raster pro Raumachse**: aus 41 × 25 werden 205 × 125 Mikrozellen. Die sichtbare Kartengröße bleibt ungefähr gleich.

Das Mikroraster ist kein sichtbarer Brettspiel-Look. Gebäude und Äcker behalten ungefähr ihre räumliche Größe und belegen entsprechend viele Mikrozellen. Auch der freie Abstand um Gebäude bleibt im Weltmaßstab erhalten.

Bewohner bewegen sich weiterhin flüssig. Laufgeschwindigkeit und räumliche Reichweiten wurden auf das feinere Raster umgerechnet; die Bewohnerdarstellung bleibt bewusst gut lesbar und ist nicht auf Mikrozellengröße geschrumpft.

## Physische Rohstoffhaufen — Phase B abgeschlossen

Ein loser Warenhaufen besitzt:

- eine konkrete Mikrozelle,
- genau einen Warentyp,
- 1 bis maximal 3 physische Einheiten.

Mehrere Einheiten desselben Typs dürfen auf derselben Zelle bis zur Kapazität 3 gestapelt werden. Verschiedene lose Warentypen teilen sich aktuell keine Zelle. Wird die letzte Einheit abgeholt, verschwindet der Haufen.

### Verbindliche Bewegungsregel

**Lose Warenhaufen sind niemals Hindernisse.** Bewohner können immer darüberlaufen. Ein Haufen verändert weder Untergrund noch Wegfindung, Bewegungskosten oder Kollision.

Für die Ablage gilt trotzdem eine eigene Platzregel: Ein neuer Haufen wird nicht direkt auf Wasser, Berg, einem Gebäude-Footprint oder einer noch aktiven natürlichen Ressourcenquelle erzeugt. Diese Ablageregel macht den Haufen selbst danach nicht blockierend.

### Reservierungen

Wenn eine Transportperson eine physische Einheit einplant, wird genau diese Menge am konkreten Haufen reserviert. Die Ware bleibt bis zur tatsächlichen Abholung sichtbar und physisch vorhanden. Dadurch können mehrere Personen nicht dieselbe Einheit gleichzeitig einplanen.

### Ablagewahl

Die Ablagelogik ist deterministisch:

1. zuerst wird innerhalb der erlaubten Suchreichweite ein bereits vorhandener Haufen desselben Typs mit weniger als 3 Einheiten gesucht,
2. sonst wird die nächstgelegene gültige freie Zelle gewählt,
3. bei Gleichstand entscheidet eine feste Koordinaten-/ID-Reihenfolge.

## Holz als erste vollständige physische Rohstoffkette — Phase C abgeschlossen

Holz verwendet jetzt die physischen Haufen tatsächlich im spielbaren Wirtschaftskreislauf:

**Baum → Abbauer Holz → Holzhaufen → Abholung → Sägewerk.**

Ein Holzfäller arbeitet weiterhin an einem konkreten Baum. Nach einer fertigen Fällaktion entsteht genau **eine Einheit Holz auf dem Boden** in der Nähe des Baums. Die Suche erfolgt aktuell bis maximal **5 Mikrozellen**, also ungefähr innerhalb einer früheren großen Kachel.

Vorhandene Holzhaufen mit freiem Platz werden zuerst aufgefüllt. Ein einzelner Haufen hält höchstens drei Holz. Ist er voll, darf der Holzfäller trotzdem weiterarbeiten und einen weiteren geeigneten Haufen in der Nähe beginnen. Die Zahl 3 ist damit eine **Haufenkapazität, keine Waldkapazität**.

Das Holz liegt nicht mehr unsichtbar im Baum. Sägewerker, Sägewerk-Träger und HQ-Träger planen ihre Abholung gegen die konkreten Holzhaufen. Reservierungen verhindern Doppelabholung. Wird die letzte Einheit abgeholt, verschwindet der Haufen.

Wenn ein Baum nach seiner letzten Einheit verschwindet, bleiben bereits abgelegte Holzhaufen erhalten und können weiterhin eingesammelt werden. Der Holzfäller sucht sich anschließend den nächsten freien Baum.

Lehm und Stein sind noch nicht vollständig auf dieses Verhalten umgestellt. Sie folgen in **Phase D** und verwenden bis dahin weiterhin den bisherigen lokalen Ressourcen-Output als Übergangsmechanismus.

## Berufserfahrung

Erfahrung wird pro Person und Beruf von 0 bis 100 gespeichert und bleibt bei Berufswechsel erhalten. Jede erfolgreich abgeschlossene berufliche Tätigkeit gibt genau 1 Erfahrungspunkt; abgebrochene oder nur teilweise ausgeführte Tätigkeiten geben keinen Punkt.

Aktuelle Beispiele:

- Produktionsberuf: ein fertiger Produktionszyklus,
- Abbauer Holz: eine gewonnene und physisch abgelegte Holzeinheit,
- Abbauer Lehm/Stein: derzeit noch eine vollständig gewonnene Rohstoffeinheit im Übergangsmodell,
- Träger/Händler: eine erfolgreich zugestellte Ware,
- Farmer: fertige Aussaat, Düngung oder Ernte,
- Bauarbeiter: ein fertiger Bau-Arbeitszyklus.

## Technologie-Freischaltungen

Eine Technologie wird dauerhaft freigeschaltet, sobald irgendeine Person erstmals 10 XP im zugeordneten Beruf erreicht:

- Träger → Lager,
- Abbauer Holz → Sägewerk,
- Sägewerker → Schreinerei,
- Farmer → Mühle,
- Müller → Bäckerei,
- Abbauer Lehm → Töpferei,
- Abbauer Stein → Steinmetzhütte.

Wohnhaus, Farm und Brunnen sind von Anfang an freigeschaltet. Baumenü und Gebäudeplatzierung verwenden dieselbe autoritative Freischaltlogik.

## Gebäudeplatzierung auf Desktop und Touch

Beim Start des Baumodus wird die Karte abgedunkelt, gültige Baupositionen werden aber gleichzeitig als helle Bereiche hervorgehoben. Der aktuelle Ghost zeigt zusätzlich grün oder rot, ob die konkrete Position gültig ist.

- **Desktop:** Bau-Ghost folgt der Maus; kurzer Linksklick bestätigt eine gültige Position; Escape bricht ab.
- **Touch:** kurzes Tippen setzt den Ghost; Ziehen verschiebt die Karte; der Bauen-Button bestätigt.

Beide Wege verwenden dieselbe Platzierungslogik.

## Unveränderte Produktbereiche

Für den vollständigen aktuellen Stand gelten zusätzlich die Details in [`concept-detail.md`](./concept-detail.md), insbesondere:

- Startzustand mit 12 Personen und HQ,
- Hunger und Schlaf,
- Beerenbüsche,
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

Die dort beschriebene alte 41 × 25-Kartengröße wird durch Phase A überschrieben. Aussagen über Wald-Output als lokalen Speicher sind seit Phase C überholt; für Holz sind Bodenhaufen autoritativ. Lehm und Stein bleiben bis Phase D noch auf dem alten Übergangsmodell.
