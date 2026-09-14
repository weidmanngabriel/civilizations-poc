# Produktkonzept

Diese Datei ist der aktuelle Einstieg in das Produktkonzept. Ausführliche unveränderte Regeln bleiben in [`concept-detail.md`](./concept-detail.md) dokumentiert. Bei Widersprüchen beschreibt diese Datei den neueren Stand.

Der aktive Umbau wird in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md) geführt.

## PoC 1: personenbasierte Produktionslogistik

Ziel bleibt eine personenbasierte Produktions- und Logistiksimulation auf einem Hex-Grid. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte und räumliche Planung wirkt direkt auf Produktion, Versorgung und Transport. Hunger und Schlaf konkurrieren mit Arbeit um die Zeit einzelner Personen.

## Feineres Raumraster — Phase A abgeschlossen

Die Welt verwendet intern ein **5× feineres Raster pro Raumachse**: aus 41 × 25 werden 205 × 125 Mikrozellen. Die sichtbare Kartengröße bleibt ungefähr gleich.

Das Mikroraster ist kein sichtbarer Brettspiel-Look. Gebäude und Äcker behalten ungefähr ihre räumliche Größe und belegen entsprechend viele Mikrozellen. Auch der freie Abstand um Gebäude bleibt im Weltmaßstab erhalten.

Bewohner bewegen sich weiterhin flüssig. Laufgeschwindigkeit und räumliche Reichweiten wurden auf das feinere Raster umgerechnet; die Bewohnerdarstellung bleibt bewusst gut lesbar und ist nicht auf Mikrozellengröße geschrumpft.

## Physische Rohstoffhaufen — Phase B

Phase B führt die technische Grundlage für echte lose Waren auf der Karte ein, ohne die bestehende Holz-/Lehm-/Steinwirtschaft bereits vollständig umzuschalten.

Ein loser Warenhaufen besitzt:

- eine konkrete Mikrozelle,
- genau einen Warentyp,
- 1 bis maximal 3 physische Einheiten.

Mehrere Einheiten desselben Typs dürfen auf derselben Zelle bis zur Kapazität 3 gestapelt werden. Verschiedene lose Warentypen teilen sich aktuell keine Zelle. Wird die letzte Einheit abgeholt, verschwindet der Haufen.

### Verbindliche Bewegungsregel

**Lose Warenhaufen sind niemals Hindernisse.** Bewohner können immer darüberlaufen. Ein Haufen verändert weder Untergrund noch Wegfindung, Bewegungskosten oder Kollision.

Für die Ablage gilt trotzdem eine eigene Platzregel: Ein neuer Haufen wird nicht direkt auf Wasser, Berg, einem Gebäude-Footprint oder einer noch aktiven natürlichen Ressourcenquelle erzeugt. Diese Ablageregel macht den Haufen selbst danach nicht blockierend.

### Reservierungen

Wenn eine zukünftige Transportperson eine physische Einheit einplant, wird genau diese Menge am konkreten Haufen reserviert. Die Ware bleibt bis zur tatsächlichen Abholung sichtbar und physisch vorhanden. Dadurch können mehrere Personen nicht dieselbe Einheit gleichzeitig einplanen.

### Ablagewahl

Die neue Ablagelogik ist deterministisch:

1. zuerst wird innerhalb der erlaubten Suchreichweite ein bereits vorhandener Haufen desselben Typs mit weniger als 3 Einheiten gesucht,
2. sonst wird die nächstgelegene gültige freie Zelle gewählt,
3. bei Gleichstand entscheidet eine feste Koordinaten-/ID-Reihenfolge.

Die genaue maximale Suchreichweite wird erst mit der Holz-End-to-End-Umstellung in Phase C als Balancingwert festgelegt.

### Übergangsphase

Wald, Lehm und Stein verwenden im aktuell spielbaren Wirtschaftskreislauf noch den bisherigen lokalen Ressourcen-Output. `NaturalResource.output` ist ab Phase B nur noch ein Übergangsmechanismus.

Phase C stellt zuerst Holz vollständig um:

**Baum → Abbauer Holz → physischer Holzhaufen → Abholung → Sägewerk.**

Erst danach werden Lehm und Stein migriert.

## Berufserfahrung

Erfahrung wird pro Person und Beruf von 0 bis 100 gespeichert und bleibt bei Berufswechsel erhalten. Jede erfolgreich abgeschlossene berufliche Tätigkeit gibt genau 1 Erfahrungspunkt; abgebrochene oder nur teilweise ausgeführte Tätigkeiten geben keinen Punkt.

Aktuelle Beispiele:

- Produktionsberuf: ein fertiger Produktionszyklus,
- Abbauer: eine vollständig gewonnene Rohstoffeinheit,
- Träger/Händler: eine erfolgreich zugestellte Ware,
- Farmer: fertige Aussaat, Düngung oder Ernte,
- Bauarbeiter: ein fertiger Bau-Arbeitszyklus.

Mit Phase C wird bei Abbauarbeit der erfolgreiche Abschluss künftig erst nach der physischen Ablage der gewonnenen Einheit zählen.

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

Die dort beschriebene alte 41 × 25-Kartengröße und die langfristige Annahme, dass gewonnene Rohstoffe am Ressourcenobjekt selbst als lokaler Output liegen, werden durch Phase A bzw. Phase B/folgende Phasen überschrieben.
