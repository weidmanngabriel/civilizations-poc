# Produktkonzept

Diese Datei ist der aktuelle Einstieg in das Produktkonzept. Die bisherige ausführliche Beschreibung bleibt in [`concept-detail.md`](./concept-detail.md) erhalten und gilt für alle unveränderten Bereiche weiter. Vor größeren Produktänderungen bitte beide Dateien lesen. Bei Widersprüchen beschreibt diese Datei den neueren Stand.

## PoC 1: personenbasierte Produktionslogistik

Ziel bleibt eine personenbasierte Produktions- und Logistiksimulation auf einem Hex-Grid. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte und räumliche Planung wirkt direkt auf Produktion, Versorgung und Transport. Hunger und Schlaf konkurrieren mit Arbeit um die Zeit jeder einzelnen Person.

Die bestehende Welt, Gebäude, Produktionsketten, Bedürfnisse, Lagerlogik, Händler, Felder, natürliche Ressourcen, organischen Wege und die mobile Bedienung bleiben unverändert wie in [`concept-detail.md`](./concept-detail.md) beschrieben.

## Berufserfahrung

Erfahrung wird pro Person und Beruf von 0 bis 100 gespeichert und bleibt bei Berufswechsel erhalten.

Die Progression ist jetzt vollständig aktionsbasiert:

- jede erfolgreich abgeschlossene berufliche Tätigkeit gibt **genau 1 Erfahrungspunkt**,
- nach **100 abgeschlossenen Tätigkeiten** sind **100 % Erfahrung** erreicht,
- Erfahrung wird bei 100 gedeckelt,
- abgebrochene oder nur teilweise ausgeführte Tätigkeiten geben keine Erfahrung.

Als abgeschlossene Tätigkeit zählt aktuell:

- Produktionsberufe: ein vollständig beendeter Produktionszyklus,
- Holzfäller, Lehmgräber und Steinbrecher: eine vollständig gewonnene Rohstoffeinheit,
- Träger und Händler: eine erfolgreich zugestellte Ware,
- Farmer: eine erfolgreich beendete Aussaat, Düngung oder Ernte,
- Bauarbeiter: ein vollständig abgearbeiteter Bau-Arbeitszyklus.

Damit misst Erfahrung Wiederholung erfolgreicher Arbeit und nicht mehr die verstrichene Arbeitszeit. Schnelle Tätigkeiten können deshalb schneller Erfahrung aufbauen als langsame Tätigkeiten. Das ist beabsichtigt.

Die bestehenden Effekte der Erfahrung bleiben gleich:

- normale Produktionsberufe steigern ihren Output linear bis auf 2×,
- Bauarbeiter steigern ihre Bauleistung bis auf 2×,
- Holzfäller sowie andere Abbauer behalten den festen Ertrag je Tätigkeit und werden bis zu 50 % schneller,
- Träger und Händler behalten eine Traglast von genau 1 Einheit und werden bis zu 50 % schneller.

## Spielerkommunikation

Die Personenansicht zeigt weiterhin die aktuelle Berufserfahrung. Das In-App-Handbuch erklärt, dass jede erfolgreich abgeschlossene Tätigkeit einen Punkt bringt und dass 100 Tätigkeiten 100 % Erfahrung ergeben.

## Unveränderte Produktbereiche

Für den vollständigen aktuellen Stand gelten zusätzlich die Details in [`concept-detail.md`](./concept-detail.md), insbesondere:

- Startzustand mit 12 Personen und HQ,
- 41 × 25 Karte mit Bergen, Wasser, Wäldern und Beerenbüschen,
- Hunger und Schlaf mit Unterbrechung und Wiederaufnahme von Arbeit,
- Gebäude-Footprints mit freiem Ring,
- Bau- und Abrisslogik,
- feste Simulationsgeschwindigkeit bei 60 Ticks pro Sekunde auf 1×,
- organisch entstehende Wege,
- natürliche Holz-, Lehm- und Steinvorkommen,
- Produktionsketten und lokale Outputs,
- HQ- und Lagerinventare,
- Händler als einziger automatischer Lager-zu-Lager-Transport,
- Farmen und Felder,
- Personenliste und Personeninspektor,
- Touch- und Desktop-Bedienung,
- In-App-Handbuch und Technologiebaum.
