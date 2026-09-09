# Produktkonzept

## PoC 1: Produktionslogistik auf einem Hex-Grid

Ziel des ersten Proof of Concept ist es, den Kern der personenbasierten Produktionslogistik zu testen. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte, und Laufwege sollen spielerisch relevant sein.

## Kartenstruktur

- Jedes Kartenfeld ist ein Hexfeld.
- Gebäude belegen jeweils genau ein Hexfeld.
- Weg-, Wald- und Gebäudekacheln sind begehbar.
- Wiesen, Berge und Flüsse sind aktuell nicht begehbar.
- Die feste Startkarte umfasst **21 × 13 Hexfelder**.
- Zu Beginn ist **nur das Hauptquartier** gebaut. Lager, Sägewerke und Schreinereien werden vom Spieler platziert.
- Zu Beginn gibt es keinen aktiven Wald als Arbeitsstätte. Mehrere kleine Gruppen passiver Waldkacheln sind über die Karte verteilt.
- Das Straßennetz enthält bewusst längere Wege, Abzweigungen und Umwege.
- Lager, Sägewerke und Schreinereien können frei auf leeren Wiesen- oder Wegkacheln platziert werden.
- Der Bau erfolgt im aktuellen PoC sofort und ohne Baukosten oder Bauarbeiter.
- Wiesen können zu Wegen gemacht werden. Wege können wieder zu Wiese entfernt werden, solange keine Person auf der Kachel steht.

## Zeit und Bewegung

Die Simulation läuft intern in diskreten Schritten. Diese Schritte sind eine technische Grundlage und werden im normalen Spiel nicht als Runden gezählt oder angezeigt.

- Jede begehbare Kante kostet aktuell einen Simulationsschritt.
- Jede Person bewegt sich pro Schritt höchstens um eine Kante.
- Der kürzeste erreichbare Weg wird über das Hex-Netz bestimmt.
- Produktion dauert fünf Arbeitsschritte.
- Das Spiel startet automatisch mit **5 FPS**.
- Normaler Lauf: **1–10 FPS**.
- **Pausieren** stoppt die Simulation. Nur im pausierten Zustand erscheint **„Nächster Schritt“**, womit genau ein Simulationsschritt ausgeführt wird.
- Zusätzlich gibt es **Max FPS**, bei dem ein Simulationsschritt pro Browser-Animationsframe ausgeführt wird.

## Produktionskette

Nichts produziert ohne konkrete Person.

Aktuelle Kette:

- Wald: 5 Arbeitsschritte → 1 Holz.
- Sägewerk: 2 Holz → 1 Brett in 5 Arbeitsschritten.
- Schreinerei: 2 Bretter → 1 Holzwerkzeug in 5 Arbeitsschritten.
- Lager: Träger sammeln verfügbare Waren aus nahe gelegenen Produktions- und Rohstofforten ein.

Produzierte Waren bleiben lokal liegen, bis eine Person sie transportiert. Eine Person trägt aktuell genau eine Ware pro Transportweg.

Sägewerk und Schreinerei besitzen jeweils einen Produktionsarbeiter-Slot und bis zu zwei Träger. Der Produktionsarbeiter produziert bevorzugt und beschafft nur dann selbst Rohstoffe, wenn die Produktion blockiert ist. Träger beschaffen ausschließlich die Inputs ihrer zugewiesenen Arbeitsstätte.

## Inventare, Lager und Reservierungen

Produktions- und Rohstofforte besitzen getrennte Kapazitäten:

- Input: maximal 10 Einheiten.
- Output: maximal 3 Einheiten.

Lager besitzen stattdessen einen echten lokalen Bestand pro Warentyp:

- maximal **20 Holz**,
- maximal **20 Bretter**,
- maximal **20 Holzwerkzeuge**.

Ein Produktionsvorgang startet nur, wenn Platz für den späteren Output reserviert werden kann. Bereits geplante Transporte zählen gegen die Zielkapazität. Eine vorhandene Ware wird beim Abholauftrag reserviert, damit sie nicht mehrfach verplant werden kann.

Lager-Träger sammeln Waren nur aus einem **Umkreis von maximal 5 tatsächlich begehbaren Kachelschritten** um ihr Lager. Maßgeblich ist der kürzeste Weg vom Lager zur Warenquelle, nicht die geometrische Luftlinie. Eine Quelle mit einem notwendigen Weg von mehr als fünf Schritten wird von diesem Lager nicht automatisch eingesammelt.

Waren in Lagern sind normale physische Warenquellen. Benötigt ein Sägewerk Holz oder eine Schreinerei Bretter, dürfen deren Arbeiter oder Träger die Ware aus einem erreichbaren Lager holen. Für diese bedarfsgetriebene Beschaffung gilt die 5-Schritte-Grenze nicht.

Lager-Träger holen Waren weiterhin **niemals aus einem anderen Lager**. Dadurch entstehen keine automatischen Lager-zu-Lager-Umlagerungen. Ein Lager wird nur geleert, wenn eine Ware an einem Produktionsort tatsächlich benötigt wird oder wenn ein Händler eine ausdrücklich eingerichtete Handelsroute bedient.

Wird ein Transport während des Tragens abgebrochen, kehrt die Ware zur ursprünglichen Quelle zurück, sofern diese noch existiert.

## Händler und Handelsrouten

Händler sind eine eigene Rolle am Lager. Sie bilden die bewusste Ausnahme zur Regel, dass Lager-Träger niemals Lager-zu-Lager transportieren.

- Ein Lager kann aktuell bis zu **zwei Händler** haben.
- Jeder Händler gehört zu genau einem Startlager.
- Pro Händler wird genau eine Route konfiguriert.
- Eine Route besteht aus einem Ziellager und genau einem Warentyp: Holz, Bretter oder Holzwerkzeuge.
- Das Ziellager kann aus der Liste der vorhandenen Lager gewählt oder direkt durch Antippen eines anderen Lagers auf der Karte gesetzt werden.
- Handelsrouten unterliegen **nicht** der 5-Kachel-Grenze der Lager-Träger.
- Der Händler transportiert pro Fahrt genau **eine Einheit**.

Ablauf einer Route:

1. Der Händler wartet am Startlager.
2. Ist die konfigurierte Ware verfügbar und das Ziellager nicht voll, wird genau eine Einheit reserviert.
3. Der Händler nimmt die Einheit auf und läuft zum Ziellager.
4. Dort legt er die Ware ab.
5. Danach läuft er **leer zurück** zum Startlager.
6. Anschließend beginnt der Zyklus erneut.

Ist im Startlager nichts verfügbar, das Ziellager voll oder nicht erreichbar, wartet der Händler. Es gibt aktuell keinen Rücktransport einer zweiten Ware, keine Preise und keinen Tauschhandel.

Wird das Ziellager abgerissen, verliert die Route ihr Ziel und der Händler bleibt seinem Startlager zugewiesen. Wird das Startlager abgerissen, wird der Händler frei und kehrt Richtung HQ zurück. Laufende Transporte werden wie andere Transporte sauber abgebrochen.

## Gebäude bauen und abreißen

Ein Klick auf eine freie Wiesen- oder Wegkachel öffnet die lokalen Bauoptionen.

Aktuell frei baubar:

- Lager,
- Sägewerk,
- Schreinerei.

HQ und Wälder sind nicht frei baubar.

Normale Produktionsgebäude und Lager können über ihr Gebäude-Panel wieder abgerissen werden. Vor dem Abriss erscheint eine Bestätigung. Beim Abriss:

- verschwindet das Gebäude sofort,
- vorhandene Waren im Gebäude verfallen,
- zugewiesene Arbeiter, Träger und Händler werden frei und kehren Richtung HQ zurück,
- betroffene Transportaufträge und Handelsrouten werden abgebrochen beziehungsweise ungültige Ziele entfernt,
- die Kachel wird auf ihren vorherigen Untergrund zurückgesetzt.

Das HQ und aktive Wälder können nicht manuell abgerissen werden.

## Holzfäller und Wälder

Holzfäller sind ein globaler Beruf und werden keinem bestimmten Wald manuell zugewiesen.

- Jeder freie Mensch kann zum Holzfäller ernannt werden.
- Jeder Holzfäller sucht selbständig einen eigenen freien Wald.
- Pro aktivem Wald arbeitet maximal ein Holzfäller.
- Der nächstgelegene erreichbare freie Wald wird gewählt.
- Bei mehreren gleich weit entfernten Kandidaten entscheidet ein reproduzierbarer Seed-Zufall.
- Passive Waldkacheln werden beim Anspruch zu aktiven Wald-Arbeitsstätten.
- Ein Holzfäller ohne verfügbaren Wald bleibt Holzfäller und wartet beziehungsweise kehrt zum HQ zurück.

Jeder aktive Wald besitzt **10 Holzvorrat** und maximal 3 lokalen Output. Sinkt der Vorrat, verblasst die Darstellung proportional, aber nie unter 35 %, solange der Wald existiert.

Nach der zehnten produzierten Holzeinheit verschwindet der Wald sofort. Seine Kachel wird Weg. Bereits produziertes Restholz bleibt an dieser Position liegen und kann weiterhin abgeholt werden. Der Holzfäller sucht anschließend ohne Teleportation den nächsten Wald.

## Bevölkerung und Hauptquartier

Der PoC startet mit acht Personen. Das ist kein dauerhaftes Bevölkerungslimit.

Freie Personen sammeln sich am Hauptquartier. Freigesetzte Personen laufen von ihrer aktuellen Position zurück zum HQ; neue Zuweisungen können sie unterwegs umlenken. Eine Person zählt erst nach ihrer Ankunft als aktiv an einer stationären Arbeitsstätte.

Die Debug-Bevölkerungssteuerung erzeugt oder entfernt Personen weiterhin direkt:

- `+1`: neue freie Person am HQ.
- `-1`: entfernt nur eine freie Person, die sich tatsächlich am HQ befindet.

Langfristig soll Bevölkerung über normale Spielsysteme wie Nachwuchs und Tod entstehen beziehungsweise sinken.

## Kartenbasierte Bedienung

Die Karte ist die primäre und dauerhaft bildschirmfüllende Bedienoberfläche.

- Die Karte belegt immer den gesamten Browser-Viewport.
- Es gibt keine normale scrollende Seite mehr um die Karte herum.
- Status und Steuerungen liegen als kompakte Overlays über der Karte.
- Ein kurzer Klick/Tap auf ein Gebäude öffnet dessen Detailpanel.
- Ein kurzer Klick/Tap auf eine freie Kachel öffnet die lokalen Bau- und Wegoptionen.

Oben liegt ein kleines HUD mit Build-Version und Kernwerten wie Bevölkerung, freie Personen und Werkzeugbestand. Ein Rundenzähler wird nicht angezeigt.

Unten liegt die Simulationssteuerung mit Pausieren/Fortsetzen, FPS-Regler und Max-FPS-Toggle. Der Button **„Nächster Schritt“** ist ausschließlich während einer Pause sichtbar.

### Hauptquartier

Das HQ enthält die globalen Personalsteuerungen:

- aktuelle Bevölkerung und freie Personen,
- Bevölkerung `− / +`,
- Holzfäller `− / +`,
- globaler Status.

### Sägewerk und Schreinerei

Die Gebäudeansicht zeigt:

- Rezept,
- Input und Output,
- Produktionsstatus,
- Produktionsarbeiter `− / +`,
- Träger `− / +`,
- aktive gegenüber nur zugewiesenen Personen,
- Abrissfunktion mit Bestätigung.

### Lager

Die Lageransicht zeigt:

- Holzbestand,
- Brettbestand,
- Holzwerkzeugbestand,
- jeweils Kapazität 20,
- Status,
- Lager-Träger `− / +`,
- Händler `− / +`,
- je Händler den transportierten Warentyp,
- je Händler das Ziellager als Liste,
- alternativ **„Ziel auf Karte wählen“**, worauf der nächste Tap auf ein anderes Lager dieses Ziel setzt,
- Abrissfunktion mit Bestätigung.

### Aktive Wälder

Ein aktiver Wald zeigt verbleibenden Holzvorrat, lokalen Holz-Output und Arbeitsstatus. Es gibt dort keine manuelle Holzfäller-Zuweisung und keine Abrissfunktion.

### Debug-Personenliste

Die globale Liste aller Personen und Transportaufträge bleibt als Entwicklungswerkzeug erhalten, ist aber standardmäßig verborgen. Händler und ihre Route werden dort ebenfalls sichtbar gemacht.

## Desktop und Mobile

Das Spiel muss dauerhaft auch auf Smartphones bedienbar bleiben. Referenzgerät ist ein **iPhone 13 Mini mit 375 × 812 CSS-Pixeln**.

- Browser-/Seitenzoom wird unterdrückt.
- Die Karte belegt `100vw × 100dvh` beziehungsweise den jeweils verfügbaren Viewport.
- Kartenzoom: **0,7× bis 3,5×**.
- Desktop: Mausrad zum Zoomen, Pointer-Drag zum Verschieben.
- Touch: ein Finger verschiebt, zwei Finger zoomen.
- Ein kurzer Tap wählt Gebäude oder Kachel aus; eine erkennbare Ziehbewegung gilt als Pan und löst keine Auswahl aus.
- Auf iOS Safari werden Gesten direkt am Canvas verarbeitet, damit die Karte statt der Webseite gezoomt wird.
- Overlays berücksichtigen Safe-Area-Abstände für Notch und Home-Indikator.

## Simulationsreihenfolge

Pro Simulationsschritt gilt weiterhin:

1. Personen bewegen sich höchstens einmal.
2. Ankünfte, Abholungen und Lieferungen werden verarbeitet.
3. Produktion schreitet fort beziehungsweise wird abgeschlossen.
4. Erschöpfte Wälder verschwinden und Holzfäller suchen neue Standorte.
5. Neue Beschaffungs- und Handelsaufträge werden geplant.

Neu geplante Wege beginnen erst im folgenden Schritt. Produktionsinputs bleiben bis zur Fertigstellung im Gebäude. Bei Freisetzung verfällt laufender Arbeitsfortschritt, vorhandene Materialien bleiben erhalten.

## Noch nicht Teil des PoC

- Bauarbeiter und Baustellenlogistik
- Baukosten und Bauzeiten
- Bedürfnisse wie Hunger und Schlaf
- Familien, Kinder und Wohnen
- natürliche Geburten und Todesfälle
- Kampf und Diplomatie
- Preise, Tauschhandel und Handelsbeziehungen zwischen Fraktionen
- Rückfracht auf Händler-Routen
- Berufserfahrung und Freischaltungen
- unterschiedliche Bewegungskosten oder Geschwindigkeiten je Gelände
- Karren oder andere Transportmittel

## Leitprinzip

Rohstoffarbeiter, Produktionsarbeiter, unterstützende Träger, Lager-Träger, Händler und spätere Bauarbeiter dürfen unterschiedliche Beschaffungsregeln besitzen, sollen aber dasselbe grundlegende Waren-, Weg-, Reservierungs- und Bewegungssystem verwenden.

Die Bedienung folgt demselben Prinzip: globale Entscheidungen gehören zum HQ beziehungsweise zu übergeordneten Ansichten; lokale Entscheidungen und Informationen gehören direkt zum betroffenen Gebäude oder zur ausgewählten Kachel auf der Karte.
