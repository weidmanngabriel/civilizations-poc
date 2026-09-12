# Produktkonzept

## PoC 1: Produktionslogistik auf einem Hex-Grid

Ziel des Proof of Concept ist eine personenbasierte Produktions- und Logistiksimulation. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte und räumliche Planung wirkt direkt auf Produktions- und Versorgungswege. Bedürfnisse konkurrieren mit Arbeit um die Zeit einzelner Personen.

## Startzustand

Die Standardpartie startet mit **12 Personen** und einem Hauptquartier.

Das Hauptquartier ist gleichzeitig das erste Lager:

- 10 Brot liegen bereits im HQ,
- zu Beginn ist **kein Träger** dem HQ zugewiesen,
- das HQ kann maximal **2 Träger** haben,
- 2 Personen sind Bauarbeiter,
- 2 Personen sind Holzfäller,
- 8 Personen sind zunächst frei.

Explizit erzeugte Testwelten mit eigener Bevölkerungszahl bleiben neutral und erhalten diese Startzuweisungen nicht automatisch.

## Karte und Terrain

Die Welt ist ein festes **41 × 25 Hex-Grid**. Zu Beginn gibt es keine Wege. Wasser und Berge blockieren Bewegung; Wiese, Wald, Acker, Wege und Gebäudekacheln sind begehbar.

Passive Waldgruppen sind über die Karte verteilt. Zusätzlich existieren im aktuellen Startzustand **42 Beerenbüsche** auf Wiesen.

### Beerenbüsche

Ein Busch ist eine regenerative Naturquelle, keine transportierbare Ware.

- Ein voller Busch enthält genau eine Portion Beeren.
- Eine Person kann direkt am Busch essen.
- Beeren stellen **40 Hungerpunkte** wieder her, maximal bis 100.
- Danach ist der Busch leer.
- Nach einer deterministisch zufälligen Zeit von **2 bis 3 Simulationsminuten** trägt derselbe Busch wieder Beeren.
- Ein leerer Busch bleibt sichtbar, bis er nachgewachsen oder überschrieben wurde.
- Büsche gelten für die Platzierung wie Wiese.
- Wird ein Busch durch Gebäude, Acker oder entstehenden Weg überschrieben, verschwindet er dauerhaft.
- Nach dem späteren Abriss eines darüber gebauten Gebäudes entsteht normale Wiese; der Busch kehrt nicht zurück.

## Hunger und Essen

Jede Person besitzt Hunger von 0 bis 100.

Verbrauch bei 1×:

- herumstehen/warten: 1 Punkt alle 4 Sekunden,
- laufen: 1 Punkt alle 2 Sekunden,
- aktive Arbeit: 1 Punkt pro Sekunde,
- Tragen einer Ware zählt als aktive Arbeit und verbraucht 1 Punkt pro Sekunde.

Essenspriorität:

- über 40: normales Verhalten,
- 40 bis über 20: aktuelle Tätigkeit beenden, danach essen,
- 20 oder weniger: aktuelle Tätigkeit sofort pausieren und essen gehen.

Sobald bei leichtem Hunger eine Tätigkeit abgeschlossen ist, wird **keine neue Tätigkeit oder Beschaffungsfahrt mehr begonnen**, bevor die Person gegessen hat. Damit ist die Grenze zwischen zwei Arbeitszyklen der verbindliche Essenszeitpunkt.

Bei einer kritischen Unterbrechung bleibt der Fortschritt erhalten. Nach dem Essen kehrt die Person zu ihrer Aufgabe zurück, sofern das Ziel noch gültig ist.

Nahrungsquellen sind aktuell:

- Brot aus fertigen Lagern oder dem HQ: setzt Hunger auf 100,
- Brot, das als fertiger lokaler Output in einer Bäckerei liegt: setzt Hunger ebenfalls auf 100,
- Beerenbusch: +40 Hungerpunkte.

Die Person vergleicht erreichbare Nahrung nach Reisezeit und nutzt die schnellste verfügbare Quelle. Reservierungen verhindern, dass mehrere hungrige Personen gleichzeitig dasselbe Brot oder denselben Busch fest einplanen.

Die Nahrungssuche ist ereignisgetrieben: Sobald eine Person tatsächlich essen muss, wird einmal ein Ziel gewählt und ein Weg berechnet. Während sie dorthin läuft, wird die Quelle nicht ständig neu geprüft. Erst bei Ankunft wird kontrolliert, ob Brot oder Beeren noch verfügbar sind. Ist das Ziel dann ungültig, sucht die Person ein neues Ziel. Wenn momentan gar keine Nahrung erreichbar ist, bleibt die Person für das Bedürfnis blockiert und versucht die Suche höchstens einmal pro Simulationssekunde erneut.

## Müdigkeit und Schlaf

Jede Person besitzt zusätzlich einen Schlafwert von 0 bis 100. **100 bedeutet vollständig ausgeruht.** Müdigkeit entwickelt sich langsamer als Hunger und hängt ebenfalls von der Belastung ab.

Verbrauch bei 1×:

- herumstehen/warten: 1 Punkt alle 8 Sekunden,
- laufen: 1 Punkt alle 4 Sekunden,
- aktive Arbeit oder Tragen: 1 Punkt alle 2 Sekunden.

Schlafpriorität entspricht grundsätzlich Hunger:

- über 40: normales Verhalten,
- 40 bis über 20: aktuelle Tätigkeit beenden, danach schlafen,
- 20 oder weniger: aktuelle Tätigkeit sofort pausieren und schlafen gehen.

Wenn Hunger und Schlaf gleichzeitig fällig sind, hat **Hunger Vorrang**. Fortschritt, Transporte und Arbeitsaufgaben bleiben während eines Schlafumwegs erhalten und werden danach fortgesetzt.

Jeder Schlafvorgang dauert **10 Simulationssekunden**, besteht aber aus **zwei Phasen à 5 Sekunden**. Nach jeder Phase wird bereits die Hälfte der gesamten vorgesehenen Erholung gutgeschrieben. Wird Schlaf später zwischen den Phasen unterbrochen, bleibt die bereits erhaltene Erholung erhalten.

Eine Person sucht Schlafmöglichkeiten nur innerhalb von maximal **8 erreichbaren Kachelschritten**. Die Qualitätsreihenfolge ist verbindlich:

1. fertiges Wohnhaus innerhalb der Reichweite: nach 5 Sekunden wird die Hälfte der bis 100 fehlenden Erholung gutgeschrieben, nach weiteren 5 Sekunden der Rest bis **100**,
2. Baum oder Busch innerhalb der Reichweite: **+20 nach 5 Sekunden und weitere +20 nach 10 Sekunden**,
3. wenn beides fehlt: die Person schläft an ihrer aktuellen Position auf dem Boden und erhält **+10 nach 5 Sekunden und weitere +10 nach 10 Sekunden**.

Bei mehreren Möglichkeiten derselben Qualitätsstufe wird der kürzeste erreichbare Weg verwendet. Ein Wohnhaus braucht in dieser PoC-Stufe noch keine feste Bewohner- oder Familienzuweisung und hat noch keine Schlafplatzkapazität.

Auch die Schlafplatzsuche ist ereignisgetrieben: Ziel und Weg werden beim Schlafentscheid einmal festgelegt. Während des Laufens wird nicht ständig neu gesucht. Erst wenn der Weg endet, wird das Ziel geprüft; ist es dann ungültig oder nicht mehr erreichbar, wird ein neuer lokaler Schlafplatz gewählt.

Nach einem Teil-Schlaf darf die vorherige Tätigkeit zunächst wieder aufgenommen werden, bevor bei weiterhin niedrigem Schlaf erneut eine Schlafentscheidung getroffen wird. Dadurch kann insbesondere Bodenschlaf mit nur +20 die Simulation fortsetzen, ohne im selben Moment erneut zu starten.

## Gebäude und Platzierung

Gebäude besitzen feste zusammenhängende Footprints und eine Ankerposition.

Aktuelle Größen:

- HQ: 4 Kacheln,
- Lager: 4,
- Wohnhaus: 4,
- Farm: 4,
- Sägewerk: 6,
- Schreinerei: 4,
- Mühle: 4,
- Bäckerei: 4,
- Brunnen: 4.

Ein Gebäude darf nur platziert werden, wenn Footprint und ein kompletter Ring von einer freien Kachel innerhalb der Karte liegen. Wiese und Wege sind freie Untergründe; Büsche liegen logisch auf Wiese und dürfen im Footprint überbaut werden. Personen dürfen nicht auf Footprint-Kacheln stehen.

Der freie Ring wird nicht verändert. Nur der tatsächliche Footprint überschreibt den Untergrund.

Beim Abriss wird der gespeicherte Untergrund wiederhergestellt. Ein zuvor überbauter Busch wird dabei bewusst nicht rekonstruiert.

## Baumodus und Baustellen

Das linke Hauptmenü enthält den Baumodus. Nach Wahl eines Gebäudes wird die Karte abgedunkelt und gültige Anker bleiben hervorgehoben. Der Ghost erscheint erst nach dem ersten Klick/Tap. Ziehen verschiebt weiterhin die Karte; Pinch-Zoom bleibt aktiv. Gebaut wird ausschließlich über den Bestätigungsbutton.

Aktuelle Baukosten:

- Lager: 4 Holz,
- Wohnhaus: 4 Holz,
- Farm: 4 Holz,
- Sägewerk: 6 Holz,
- Schreinerei: 4 Bretter,
- Mühle: 4 Holz,
- Bäckerei: 4 Bretter,
- Brunnen: 4 Holz.

Die Grundbauzeit beträgt 3 Sekunden plus 2 Sekunden pro benötigter Ressourceneinheit. Bis zu zwei Bauarbeiter arbeiten gleichzeitig an einer Baustelle. Baufortschritt bleibt pro Baustelle erhalten.

## Bewegung und Zeit

Die Simulation verwendet bei 1× feste **60 Simulationsschritte pro Sekunde**. Rendering läuft unabhängig auf `requestAnimationFrame`.

Der Spieler kann 0,5×, 1×, 2×, 3× und Pause wählen. Bewegung bleibt visuell kontinuierlich und wird nicht kachelweise gesprungen dargestellt.

Das Grundtempo beträgt 2,5 Kacheln pro Sekunde. Wege machen Bewegung 30 % schneller.

## Organische Wege

Zu Beginn gibt es keine Wege. Acht Überquerungen einer Wiese innerhalb von 32 Simulationssekunden erzeugen dort dauerhaft einen Weg. Laufende Routen werden danach neu bewertet.

Wenn auf der Wiese ein Busch steht, verschwindet er beim Entstehen des Weges dauerhaft.

## Berufserfahrung

Erfahrung wird pro Person und Beruf von 0 bis 100 gespeichert und bleibt bei Berufswechsel erhalten. Sie steigt nur während tatsächlicher Arbeit.

Zielkurve:

- ca. 50 % nach 10 Minuten aktiver Arbeit,
- ca. 80 % nach 30 Minuten,
- ca. 95 % nach 60 Minuten,
- 100 % nach ca. 90 Minuten.

Normale Produktionsberufe steigern den Output linear bis auf 2×. Holzfäller behalten exakt 1 Holz pro Zyklus und werden stattdessen bis zu 50 % schneller. Träger und Händler behalten eine Traglast von 1 Einheit und werden bis zu 50 % schneller. Bauarbeiter steigern ihre persönliche Bauleistung bis auf 2×.

## Produktionskette

Aktuell:

- Wald: ca. 4 Sekunden → 1 Holz,
- Sägewerk: 2 Holz → 1 Brett,
- Schreinerei: 2 Bretter → 1 Holzwerkzeug,
- Farm: Felder → Weizen,
- Mühle: 1 Weizen → 1 Mehl,
- Bäckerei: 2 Mehl + 1 Wasser → 2 Brot,
- Brunnen: unerschöpfliches Wasser ohne Arbeiter.

Normale Produktionsstätten können **10 Einheiten lokalen Output** halten. Der Wald behält seine separate Grenze von **3 lokal liegenden Holz**. Produktionsinputs und Lagerbestände sind ganzzahlig. Nur lokale Produktionsoutputs dürfen durch Erfahrung Bruchteile enthalten. Jede Transportfahrt bewegt weiterhin exakt 1 Einheit.

## Lager und HQ-Lager

Normale Lager und das HQ halten Waren physisch im Inventar. Die Kapazität beträgt aktuell 20 Einheiten je Warentyp.

Lager-Träger sammeln Nicht-Lager-Quellen innerhalb von 10 erreichbaren Kachelschritten. Sie verschieben keine Ware automatisch zwischen Lagern.

Produktionsarbeiter dürfen benötigte Zutaten direkt aus normalen Lagern **und aus dem HQ-Inventar** holen. Für diese Beschaffung gibt es keinen separaten HQ-Sonderradius; es gilt dieselbe erreichbare Quellenwahl wie bei einem normalen Lager als Produktionsquelle.

Das HQ unterstützt maximal **2 Träger**, startet aber ohne zugewiesenen Träger. Zugewiesene HQ-Träger verwenden dieselbe Reichweiten- und Transportlogik wie Lager-Träger. Das HQ ist damit von Beginn an ein Versorgungs- und Lagerpunkt, während die automatische Sammlung erst nach einer Trägerzuweisung beginnt.

Der HQ-Dialog kombiniert die globale Personalsteuerung mit der Trägerzuweisung und einer vollständigen Anzeige des HQ-Lagerinventars.

Händler bleiben der separate Mechanismus für Lager-zu-Lager-Transporte.

## Farm und Felder

Eine fertige Farm hat einen Farmer. Er bewirtschaftet maximal vier aktive Felder innerhalb von drei Hex-Schritten vom Farm-Footprint.

Priorität:

1. erntereifes Feld ernten,
2. bei weniger als vier Feldern aussäen,
3. sonst ein wachsendes Feld düngen.

Aussaat und Ernte dauern je 10 Sekunden. Eine natürliche Wachstumsstufe dauert 30 Sekunden; Düngen beschleunigt die verbleibende Stufenzeit auf ein Drittel. Geernteter Weizen wird physisch zur Farm zurückgetragen.

## Holzfäller und Wälder

Holzfäller werden global am HQ verwaltet. Jeder sucht selbständig einen erreichbaren freien Wald. Pro aktivem Wald arbeitet höchstens ein Holzfäller.

Ein Wald besitzt zehn Arbeitszyklen. Jeder Zyklus erzeugt exakt 1 Holz. Am Wald liegen höchstens **drei** produzierte Holz gleichzeitig. Nach dem zehnten abgeschlossenen Zyklus verschwindet der Wald sofort und die Kachel wird Wiese; bereits produziertes Holz bleibt liegen.

## Bedienung und Mobile

Die Karte belegt den gesamten Viewport. Overlays liegen darüber. Referenzgerät ist ein iPhone 13 Mini mit 375 × 812 CSS-Pixeln.

- Browserzoom wird unterdrückt,
- Kartenzoom: 0,7× bis 3,5×,
- Desktop: Mausrad und Drag,
- Touch: ein Finger verschiebt, zwei Finger zoomen,
- Hunger wird über ein kleines gelbes beziehungsweise rotes Bestecksymbol über der Person angezeigt,
- Müdigkeit wird analog über ein eigenes `💤`-Symbol angezeigt: gelb bei Schlafbedarf, rot bei kritischer Müdigkeit,
- Hunger- und Schlafsymbol liegen getrennt nebeneinander, falls beide Bedürfnisse gleichzeitig sichtbar sind,
- Büsche werden direkt auf der Karte dargestellt; volle Büsche zeigen Beeren, leere nur das Buschgrün.
