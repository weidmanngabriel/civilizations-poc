# Produktkonzept

Diese Datei ist der aktuelle Einstieg in das Produktkonzept. Die bisherige ausführliche Beschreibung bleibt in [`concept-detail.md`](./concept-detail.md) erhalten und gilt für alle unveränderten Bereiche weiter. Vor größeren Produktänderungen bitte beide Dateien lesen. Bei Widersprüchen beschreibt diese Datei den neueren Stand.

## PoC 1: personenbasierte Produktionslogistik

Ziel bleibt eine personenbasierte Produktions- und Logistiksimulation auf einem Hex-Grid. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte und räumliche Planung wirkt direkt auf Produktion, Versorgung und Transport. Hunger und Schlaf konkurrieren mit Arbeit um die Zeit jeder einzelnen Person.

Die bestehende Welt, Gebäude, Produktionsketten, Bedürfnisse, Lagerlogik, Händler, Felder, natürliche Ressourcen, organischen Wege und die mobile Bedienung bleiben unverändert wie in [`concept-detail.md`](./concept-detail.md) beschrieben, soweit sie nicht unten ausdrücklich überschrieben werden.

## Feineres Raumraster — Phase A

Der aktive Umbau ist in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md) beschrieben. Die Welt verwendet jetzt ein **5× feineres Raster pro Raumachse**: aus der bisherigen 41 × 25-Struktur wird intern eine 205 × 125-Mikrozellenwelt. Die sichtbare Ausdehnung der Karte bleibt ungefähr gleich.

Das feinere Raster ist kein neuer Brettspiel-Look. Die Mikrozellen dienen vor allem Platzierung, Wegfindung, Ressourcen und späteren physischen Warenablagen; im normalen Spiel soll die Landschaft weiterhin zusammenhängend wirken.

Gebäude behalten ungefähr ihre bisherige Bildschirmgröße und belegen dafür deutlich mehr Mikrozellen. Auch Äcker behalten ungefähr ihre bisherige räumliche Größe. Der vorgeschriebene freie Abstand um Gebäude bleibt in Weltmaßstab erhalten und wird entsprechend in mehr Zellen ausgedrückt.

Bewohner bewegen sich weiterhin flüssig und nicht sichtbar zellenweise. Ihre Laufgeschwindigkeit und räumliche Reichweiten werden auf das feinere Raster umgerechnet, damit sich Entfernungen im Spiel nicht plötzlich verfünffachen. Die Bewohnerdarstellung ist leicht größer als zuvor, damit Figuren trotz des feineren Rasters gut lesbar bleiben.

Die Rohstoffwirtschaft bleibt während Phase A absichtlich noch im bisherigen Übergangsmodell: Wald-, Lehm- und Steinvorkommen besitzen weiterhin ihren bisherigen lokalen Output. Einzelne Bäume und physische Rohstoffhaufen mit maximal drei Einheiten werden erst in den folgenden Phasen eingeführt.

## Berufserfahrung

Erfahrung wird pro Person und Beruf von 0 bis 100 gespeichert und bleibt bei Berufswechsel erhalten.

Die Progression ist vollständig aktionsbasiert:

- jede erfolgreich abgeschlossene berufliche Tätigkeit gibt **genau 1 Erfahrungspunkt**,
- nach **100 abgeschlossenen Tätigkeiten** sind **100 % Erfahrung** erreicht,
- Erfahrung wird bei 100 gedeckelt,
- abgebrochene oder nur teilweise ausgeführte Tätigkeiten geben keine Erfahrung.

Als abgeschlossene Tätigkeit zählt aktuell:

- Produktionsberufe: ein vollständig beendeter Produktionszyklus,
- Abbauer Holz, Abbauer Lehm und Abbauer Stein: eine vollständig gewonnene Rohstoffeinheit,
- Träger und Händler: eine erfolgreich zugestellte Ware,
- Farmer: eine erfolgreich beendete Aussaat, Düngung oder Ernte,
- Bauarbeiter: ein vollständig abgearbeiteter Bau-Arbeitszyklus.

Damit misst Erfahrung Wiederholung erfolgreicher Arbeit und nicht mehr die verstrichene Arbeitszeit. Schnelle Tätigkeiten können deshalb schneller Erfahrung aufbauen als langsame Tätigkeiten. Das ist beabsichtigt.

Die bestehenden Effekte der Erfahrung bleiben gleich:

- normale Produktionsberufe steigern ihren Output linear bis auf 2×,
- Bauarbeiter steigern ihre Bauleistung bis auf 2×,
- Abbauer behalten den festen Ertrag je Tätigkeit und werden bis zu 50 % schneller,
- Träger und Händler behalten eine Traglast von genau 1 Einheit und werden bis zu 50 % schneller.

## Technologie-Freischaltungen

Der Technologiebaum steuert die Verfügbarkeit der bereits implementierten Gebäude. Eine Technologie wird dauerhaft freigeschaltet, sobald **irgendeine Person erstmals 10 Erfahrungspunkte** im zugeordneten Beruf erreicht. Die Freischaltung bleibt bestehen, auch wenn diese Person später den Beruf wechselt oder die Siedlung verlässt.

Aktuelle Freischaltungen:

- Träger 10 XP → Lager,
- Abbauer Holz 10 XP → Sägewerk,
- Sägewerker 10 XP → Schreinerei,
- Farmer 10 XP → Mühle,
- Müller 10 XP → Bäckerei,
- Abbauer Lehm 10 XP → Töpferei,
- Abbauer Stein 10 XP → Steinmetzhütte.

Wohnhaus, Farm und Brunnen sind von Anfang an freigeschaltet. Bereits vorhandene Berufe ohne implementierte Folgetechnologie sammeln weiterhin Erfahrung, lösen aktuell aber keine zusätzliche Freischaltung aus.

Nicht implementierte Zweige wie Militär, Jäger oder Fischer bleiben im Technologiebaum als geplante Struktur sichtbar, besitzen aber noch keine erfundene Spielregel. Die Freischaltlogik ist datengetrieben aufgebaut, sodass spätere Berufe und Technologien durch neue Zuordnungen ergänzt werden können.

Der Technologiebaum zeigt den aktuellen Zustand live an. Abbau-Berufe werden nach dem Muster **Abbauer + Ressource** benannt. Aktuell implementiert sind **Abbauer Holz**, **Abbauer Lehm** und **Abbauer Stein**; geplante Zweige folgen derselben Konvention, z. B. **Abbauer Pilz** und **Abbauer Gold**. Die sichtbaren Ketten folgen der tatsächlichen Spiellogik, zum Beispiel **Abbauer Holz → Sägewerk → Sägewerker → Schreinerei**. Zusammengehörige Ketten liegen in eigenen horizontalen Spuren mit mehr Abstand, damit Verbindungen möglichst innerhalb ihrer Kette bleiben und sich weniger mit fremden Nodes vermischen. Freigeschaltete Knoten sind hervorgehoben; gesperrte oder noch nicht implementierte Knoten werden nur ausgegraut und nicht geblurt, damit Beschriftungen und Voraussetzungen klar lesbar bleiben.

Das Baumenü verwendet dieselbe autoritative Freischaltlogik und zeigt nur Gebäude, die bereits freigeschaltet sind. Gesperrte Gebäude bleiben ausschließlich im Technologiebaum sichtbar. Die eigentliche Gebäudeplatzierung verweigert weiterhin gesperrte Technologien, sodass die Sperre nicht über einen alternativen UI-Weg umgangen werden kann.

## Gebäudeplatzierung auf Desktop und Touch

Die Bauplatzierung verwendet dieselben Regeln, ist aber an das jeweilige Eingabegerät angepasst:

- **Desktop:** Der Bau-Ghost folgt sofort der Maus. Ein kurzer Linksklick auf eine gültige Position platziert das Gebäude. Escape bricht den Baumodus ab.
- **Touch:** Ein kurzes Tippen setzt den Ghost auf die gewünschte Position. Ziehen verschiebt weiterhin die Karte. Der Bauen-Button bestätigt die Platzierung.

In beiden Fällen entscheidet dieselbe Platzierungslogik, ob eine Position gültig ist. Eingabemethoden verändern keine Bauvoraussetzungen. Auf dem Mikroraster wird nicht jede einzelne gültige Ankerzelle über die gesamte Karte hervorgehoben; der Ghost selbst zeigt an seiner aktuellen Position, ob dort gebaut werden kann.

## Spielerkommunikation

Die Personenansicht zeigt weiterhin die aktuelle Berufserfahrung. Das In-App-Handbuch erklärt, dass jede erfolgreich abgeschlossene Tätigkeit einen Punkt bringt, dass Berufserfahrung neue Technologien dauerhaft freischalten kann und wie sich die Gebäudeplatzierung auf Desktop und Touch unterscheidet.

## Unveränderte Produktbereiche

Für den vollständigen aktuellen Stand gelten zusätzlich die Details in [`concept-detail.md`](./concept-detail.md), insbesondere:

- Startzustand mit 12 Personen und HQ,
- Berge, Wasser, Wälder und Beerenbüsche in derselben ungefähr sichtbaren Weltgröße,
- Hunger und Schlaf mit Unterbrechung und Wiederaufnahme von Arbeit,
- Gebäude-Footprints mit freiem Ring,
- Bau- und Abrisslogik,
- feste Simulationsgeschwindigkeit bei 60 Ticks pro Sekunde auf 1×,
- organisch entstehende Wege,
- vorübergehend weiterhin die bisherige Holz-, Lehm- und Steinvorkommen-Logik,
- Produktionsketten und lokale Outputs,
- HQ- und Lagerinventare,
- Händler als einziger automatischer Lager-zu-Lager-Transport,
- Farmen und Felder,
- Personenliste und Personeninspektor,
- Touch- und Desktop-Bedienung,
- In-App-Handbuch und Technologiebaum.
