# Produktkonzept

## PoC 1: Produktionslogistik auf einem Hex-Grid

Ziel ist eine personenbasierte Produktions- und Logistiksimulation. Waren liegen physisch an Orten, Personen transportieren sie sichtbar und räumliche Planung beeinflusst Wege, Produktion und Versorgung.

## Karte und Terrain

- Festes **41 × 25 Hex-Grid**.
- Zu Beginn existiert nur das Hauptquartier als Gebäude.
- Passive Waldgruppen sind über die Karte verteilt.
- Zu Beginn gibt es keine Wege.
- Wiese, Wald, Acker, Wege und Gebäudekacheln sind begehbar; Wasser und Berge nicht.
- Wege entstehen ausschließlich organisch durch häufige Bewegung. Acht Überquerungen einer Wiese innerhalb von 32 Sekunden erzeugen dort dauerhaft einen Weg.
- Wege erhöhen die Bewegungsgeschwindigkeit um 30 %.
- Es gibt keine manuelle Funktion zum Bauen oder Entfernen von Wegen.

## Gebäude und Platzierung

Baubare Gebäude sind Lager, Farm, Sägewerk, Schreinerei, Mühle, Bäckerei und Brunnen. Das Hauptquartier ist nicht frei platzierbar.

Aktuelle Footprints:

- Hauptquartier: 4 Kacheln,
- Lager: 4 Kacheln,
- Farm: 4 Kacheln,
- Sägewerk: 6 Kacheln,
- Schreinerei: 4 Kacheln,
- Mühle: 4 Kacheln,
- Bäckerei: 4 Kacheln,
- Brunnen: 4 Kacheln.

Ein Gebäude ist logisch eine einzelne Entity. Klick oder Tap auf eine belegte Kachel selektiert das Gebäude.

### Platzierungsregel

Ein Gebäude darf nur platziert werden, wenn der komplette Footprint und ein Ring von mindestens einer freien Kachel rundherum innerhalb der Karte liegen und aus freier Wiese oder Weg bestehen. Auf keiner Footprint-Kachel darf eine Person stehen. Wald, Acker, Wasser, Berge, andere Gebäude und der Kartenrand blockieren die Platzierung.

Wege dürfen vom Footprint überbaut werden. Der vorherige Untergrund wird gespeichert und beim Abriss wiederhergestellt.

### Baumenü und Baumodus

Am linken Bildschirmrand befindet sich eine vertikale Menüleiste. Aktuell enthält sie nur **Bauen**; weitere Hauptfunktionen können später dort ergänzt werden.

Klick oder Tap auf **Bauen** öffnet eine Liste aller baubaren Gebäude. Jeder Eintrag zeigt Gebäude-Icon, Namen und die benötigten Bauressourcen. Ein Klick auf einen Gebäudetyp startet direkt den Baumodus. Ein normaler Klick auf eine freie Kachel öffnet kein Baumenü und keine Kachelaktionen.

Im Baumodus:

1. Die Karte wird leicht abgedunkelt und gültige Ankerkacheln bleiben hervorgehoben.
2. Zu Beginn ist noch kein Ghost sichtbar.
3. Der erste kurze Klick/Tap setzt den Ghost.
4. Footprint und notwendiger Freiraum werden angezeigt; gültig grün, ungültig rot.
5. Desktop-Hover oder kurzer Touch-Tap verschieben den Ghost.
6. Ziehen verschiebt weiterhin die Karte; Pinch-Zoom bleibt aktiv.
7. Der Bau wird ausschließlich über **Bauen** bestätigt; **Abbrechen** beendet den Modus.

### Baukosten und Baustellen

- Lager: 4 Holz,
- Farm: 4 Holz,
- Sägewerk: 6 Holz,
- Schreinerei: 4 Bretter,
- Mühle: 4 Holz,
- Bäckerei: 4 Bretter,
- Brunnen: 4 Holz.

Gebäude entstehen als unfertige Baustellen. Der Footprint ist sofort belegt, die Gebäudefunktion bleibt bis zur Fertigstellung gesperrt. Die Basisbauzeit beträgt 3 Sekunden plus 2 Sekunden je benötigter Ressourceneinheit. Bis zu zwei Bauarbeiter arbeiten gleichzeitig; ihre persönlichen Bauleistungen werden addiert und durch Berufserfahrung erhöht.

## Zeit und Bewegung

Die Simulation läuft bei 1× mit **60 festen Simulationsschritten pro realer Sekunde**. Rendering und Simulationsgeschwindigkeit sind getrennt. Der Spieler kann pausieren sowie 0,5×, 1×, 2× und 3× wählen.

Personen bewegen sich kontinuierlich zwischen Hex-Mittelpunkten. Die Kacheln dienen für Wegfindung und räumliche Regeln, nicht für sichtbare Sprungbewegung.

## Berufserfahrung

Jede Person besitzt Erfahrung von 0 bis 100 % je Beruf. Erfahrung bleibt bei Berufswechsel erhalten und steigt nur während tatsächlicher Arbeit.

Zielkurve:

- ca. 50 % nach 10 Minuten aktiver Arbeit,
- ca. 80 % nach 30 Minuten,
- ca. 95 % nach 60 Minuten,
- 100 % nach ca. 90 Minuten.

Produktionsberufe und Bauarbeiter nutzen `1 + Erfahrung / 100` als Leistungsfaktor. Träger und Händler tragen weiterhin genau eine Einheit und erhalten stattdessen bis zu +50 % Bewegungsgeschwindigkeit.

## Produktion und Logistik

Aktuelle Ketten:

- Wald → Holz,
- Sägewerk: 2 Holz → 1 Brett,
- Schreinerei: 2 Bretter → 1 Holzwerkzeug,
- Farm → Weizen,
- Mühle: 1 Weizen → 1 Mehl,
- Brunnen → Wasser,
- Bäckerei: 2 Mehl + 1 Wasser → 2 Brot.

Produzierte Waren bleiben lokal liegen, bis eine Person sie transportiert. Transporte bewegen immer genau 1,0 Einheit. Nur lokale Produktions-Outputs dürfen durch Erfahrung Dezimalwerte enthalten; Produktionsinputs und Lagerbestände bleiben ganzzahlig.

Lager halten aktuell bis zu 20 ganze Einheiten je Warentyp. Lager-Träger sammeln Waren nur aus Nicht-Lagern innerhalb von 10 begehbaren Kachelschritten und verschieben niemals automatisch Ware zwischen Lagern. Händler sind die bewusste Ausnahme und verbinden zwei Lager ohne dieses Reichweitenlimit.

## Farm

Eine fertige Farm besitzt einen Farmer-Slot. Der Farmer bewirtschaftet maximal vier Acker innerhalb von drei Hex-Schritten um den Farm-Footprint. Priorität: erntereifen Acker ernten, fehlenden Acker aussäen, sonst nicht erntereifen Acker düngen. Aussaat und Ernte dauern je 10 Sekunden; natürliche Wachstumsstufen je 30 Sekunden. Düngen beschleunigt den verbleibenden Wachstumsfortschritt auf das Dreifache.

Nach der Ernte trägt der Farmer eine physische Weizeneinheit zurück zur Farm. Erst dort wird der Farm-Output erhöht; Lager-Träger holen Weizen anschließend an der Farm ab.

## Wald

Holzfäller werden global am Hauptquartier ernannt. Jeder sucht selbständig einen freien erreichbaren Wald. Ein Wald liefert zehn Arbeitszyklen und verschwindet danach sofort; bereits produziertes Holz bleibt liegen und kann eingesammelt werden.

## Gebäudeauswahl und Dialoge

Gebäude werden direkt auf der Karte ausgewählt. Das jeweilige kompakte Dialogpanel enthält Personalzuweisung, lokale Bestände, Produktion, Händlersteuerung, Baustellenstatus oder Abrissfunktionen. Acker sind keine direkt steuerbaren Gebäude.

Die Karte bleibt bildschirmfüllend. Oben liegen Build-Version und Kernmetriken, unten Pause und Simulationsgeschwindigkeit, links die Hauptmenüleiste.
