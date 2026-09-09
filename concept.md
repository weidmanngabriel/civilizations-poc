# Produktkonzept

## PoC 1: Produktionslogistik auf einem Hex-Grid

Ziel des ersten Proof of Concept ist eine personenbasierte Produktions- und Logistiksimulation. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte, und räumliche Planung soll einen direkten spielerischen Effekt haben.

## Karte und Terrain

- Die Welt ist ein festes **21 × 13 Hex-Grid**.
- Gebäude belegen jeweils genau eine Kachel.
- Zu Beginn existiert **nur das Hauptquartier** als Gebäude.
- Mehrere kleine Gruppen passiver Waldkacheln sind auf der Karte verteilt.
- Zu Beginn gibt es **keine Wege**.
- **Wiese, Wald, Wege und Gebäudekacheln sind begehbar.**
- **Wasser und Berge sind nicht begehbar.**
- Lager, Sägewerke und Schreinereien können auf freien Wiesen- oder Wegkacheln sofort und kostenlos gebaut werden.
- Das HQ und aktive Wälder können nicht manuell abgerissen werden.

## Zeit und Spielgeschwindigkeit

Die Simulation besitzt einen festen internen Zeitschritt von **60 Simulationsschritten pro Sekunde bei 1×**. Dieser technische Takt wird dem Spieler nicht als Rundenzähler oder FPS-Wert gezeigt.

Die Darstellung läuft unabhängig davon über den normalen Browser-/Phaser-Renderloop mit bis zu 60 FPS.

Der Spieler steuert nur die **gesamte Simulationsgeschwindigkeit**:

- **0,5×**
- **1×** – Standard
- **2×**
- **3×**
- **Pause**

Die Geschwindigkeit wirkt auf die komplette Simulation: Bewegung, Produktion, Holzabbau, Transporte und Händler. Es gibt keinen FPS-Regler, keinen Max-FPS-Modus und keinen „Nächster Schritt“-Button mehr.

Bei 1× entsprechen die bisherigen Spielzeiten ungefähr dem vorherigen 5-FPS-Stand: Ein normaler Produktionsvorgang dauert etwa **1 Sekunde Simulationszeit**.

## Bewegung und organische Wege

Das Hex-Grid dient der Wegfindung und der Terrainlogik, nicht mehr als sichtbare Sprungbewegung. Personen bewegen sich kontinuierlich zwischen den Mittelpunkten der von der Wegfindung bestimmten Kacheln.

- Grundtempo auf Wiese, Wald und Gebäudekacheln: **5 Kacheln pro Simulationssekunde**.
- Ein Weg macht Bewegung **30 % schneller**.
- Jeder Simulationsschritt verschiebt eine Person nur um den entsprechenden Teil einer Kantenstrecke.
- Erst beim Erreichen des nächsten Kachelmittelpunkts gilt die Kachel logisch als betreten; dort werden Ankunft und Verkehr registriert.
- Nicht verbrauchter Bewegungsfortschritt bleibt während eines laufenden Wegs erhalten.
- Die Wegfindung berücksichtigt die unterschiedlichen Bewegungskosten. Ein vorhandener Weg kann daher attraktiver sein als eine kürzere Route über Wiese.
- Die sichtbare Zwischenposition stammt direkt aus dem deterministischen Simulationsfortschritt; es gibt keine unabhängige Render-Tween-Logik.

### Automatische Wegbildung

Wege entstehen durch tatsächliche Nutzung der Landschaft:

- Jede vollständige Überquerung beziehungsweise Ankunft auf einer Wiesen-Kachel wird gezählt.
- Erreicht eine Wiesen-Kachel **8 Überquerungen innerhalb der letzten 8 Simulationssekunden**, wird sie automatisch zu einem Weg.
- Ein automatisch entstandener Weg bleibt bestehen.
- Sobald sich ein neuer Weg bildet, werden laufende Routen neu bewertet, damit Personen den Geschwindigkeitsvorteil nutzen können.
- Die bestehende manuelle Weg-Bauen-/Entfernen-Funktion bleibt im PoC zusätzlich verfügbar.

Damit verstärken sich häufig genutzte Routen selbst: Verkehr erzeugt Wege, Wege beschleunigen Verkehr, und die Wegfindung bevorzugt dadurch etablierte Verbindungen.

## Produktionskette

Nichts produziert ohne konkrete Person.

Aktuelle Kette:

- Wald: ca. 1 Simulationssekunde → 1 Holz.
- Sägewerk: 2 Holz → 1 Brett in ca. 1 Simulationssekunde.
- Schreinerei: 2 Bretter → 1 Holzwerkzeug in ca. 1 Simulationssekunde.
- Lager: Träger sammeln verfügbare Waren aus nahe gelegenen Produktions- und Rohstofforten ein.

Produzierte Waren bleiben lokal liegen, bis eine Person sie transportiert. Eine Person trägt aktuell genau eine Einheit pro Transportweg.

Sägewerk und Schreinerei besitzen jeweils einen Produktionsarbeiter-Slot und bis zu zwei Träger. Der Produktionsarbeiter produziert bevorzugt und beschafft nur dann selbst Rohstoffe, wenn die Produktion blockiert ist. Träger beschaffen ausschließlich die Inputs ihrer zugewiesenen Arbeitsstätte.

## Inventare, Lager und Reservierungen

Produktions- und Rohstofforte besitzen getrennte Kapazitäten:

- Input: maximal 10 Einheiten.
- Output: maximal 3 Einheiten.

Lager besitzen einen lokalen Bestand pro Warentyp:

- maximal 20 Holz,
- maximal 20 Bretter,
- maximal 20 Holzwerkzeuge.

Ein Produktionsvorgang startet nur, wenn Platz für den späteren Output reserviert werden kann. Bereits geplante Transporte zählen gegen die Zielkapazität. Eine vorhandene Ware wird beim Abholauftrag reserviert, damit sie nicht mehrfach verplant wird.

Lager-Träger sammeln Waren nur aus einem **Umkreis von maximal 5 tatsächlich begehbaren Kachelschritten** um ihr Lager. Diese Reichweite wird weiterhin in Kachelschritten und nicht in Bewegungszeit gemessen; ein schnellerer Weg vergrößert den Sammelradius also nicht.

Waren in Lagern sind normale physische Warenquellen. Benötigt ein Sägewerk Holz oder eine Schreinerei Bretter, dürfen deren Arbeiter oder Träger die Ware aus einem erreichbaren Lager holen. Für diese bedarfsgetriebene Beschaffung gilt die 5-Schritte-Grenze nicht.

Lager-Träger holen Waren **niemals aus einem anderen Lager**. Dadurch entstehen keine automatischen Lager-zu-Lager-Umlagerungen.

Wird ein Transport während des Tragens abgebrochen, kehrt die Ware zur ursprünglichen Quelle zurück, sofern diese noch existiert.

## Händler und Handelsrouten

Händler sind eine eigene Rolle am Lager und die bewusste Ausnahme zur Lager-zu-Lager-Regel.

- Ein Lager kann bis zu zwei Händler haben.
- Jeder Händler gehört zu genau einem Startlager.
- Pro Händler wird genau eine Route konfiguriert.
- Eine Route besteht aus einem Ziellager und einem Warentyp: Holz, Bretter oder Holzwerkzeuge.
- Die Route unterliegt nicht dem 5-Kachel-Radius der Lager-Träger.
- Der Händler transportiert pro Fahrt genau eine Einheit.

Ablauf:

1. Händler wartet am Startlager.
2. Ware und Zielkapazität werden reserviert.
3. Händler bringt eine Einheit zum Ziellager.
4. Händler läuft leer zurück.
5. Der Zyklus beginnt erneut.

Es gibt aktuell keinen Rücktransport einer zweiten Ware, keine Preise und keinen Tauschhandel.

### Ziellager-wählen-Modus

Das Ziellager wird direkt auf der Karte gewählt:

- Die Simulation pausiert während der Auswahl.
- Nur gültige Ziellager werden deutlich hervorgehoben.
- Andere Kartenaktionen sind gesperrt; Pan und Zoom bleiben möglich.
- Auswahl oder Abbruch stellt Kameraposition und Zoom wieder her.
- War die Simulation vorher aktiv, läuft sie danach mit der zuvor gewählten Geschwindigkeit weiter.
- War sie vorher pausiert, bleibt sie pausiert.

## Gebäude bauen und abreißen

Frei baubar sind:

- Lager,
- Sägewerk,
- Schreinerei.

Beim Abriss eines normalen Gebäudes:

- verschwindet das Gebäude sofort,
- lokale Waren verfallen,
- zugewiesene Personen werden frei und laufen zum HQ,
- betroffene Transporte und Handelsrouten werden bereinigt,
- die Kachel erhält ihren vorherigen Untergrund zurück.

## Holzfäller und Wälder

Holzfäller sind ein globaler Beruf und werden keinem Wald manuell zugewiesen.

- Jeder freie Mensch kann Holzfäller werden.
- Jeder Holzfäller sucht selbständig einen erreichbaren freien Wald.
- Pro aktivem Wald arbeitet maximal ein Holzfäller.
- Bei gleichwertigen Kandidaten entscheidet ein reproduzierbarer Seed-Zufall.
- Passive Waldkacheln werden beim Anspruch zu aktiven Wald-Arbeitsstätten.
- Ein Holzfäller ohne verfügbaren Wald bleibt Holzfäller und wartet beziehungsweise kehrt zum HQ zurück.

Jeder aktive Wald besitzt **10 Holzvorrat** und maximal 3 lokalen Output. Die Darstellung verblasst proportional zum Restvorrat, aber nie unter 35 %, solange der Wald existiert.

Nach der zehnten produzierten Holzeinheit verschwindet der Wald sofort. Seine Kachel wird wieder **Wiese**. Bereits produziertes Restholz bleibt an dieser Position liegen und kann weiterhin abgeholt werden. Ein Weg entsteht dort nur dann, wenn die normale Verkehrsregel erfüllt wird.

## Bevölkerung und Hauptquartier

Der PoC startet mit acht Personen. Das ist kein dauerhaftes Bevölkerungslimit.

Freie Personen sammeln sich am HQ. Freigesetzte Personen laufen von ihrer aktuellen Position zurück; neue Zuweisungen können sie unterwegs umlenken. Eine Person zählt erst nach ihrer Ankunft als aktiv an einer stationären Arbeitsstätte.

Die Debug-Bevölkerungssteuerung erzeugt oder entfernt Personen direkt:

- `+1`: neue freie Person am HQ.
- `-1`: entfernt nur eine freie Person, die sich tatsächlich am HQ befindet.

## Bedienung

Die Karte ist dauerhaft bildschirmfüllend. Status und Steuerungen liegen als kompakte Overlays darüber.

- Kurzer Klick/Tap auf Gebäude: Gebäudedialog.
- Kurzer Klick/Tap auf freie Kachel: lokale Bau- und Wegoptionen.
- Unten: Pause/Fortsetzen und `0,5× / 1× / 2× / 3×`.
- Oben: Build-Version und Kernmetriken.
- Debug-Personenliste bleibt standardmäßig verborgen.

### HQ

- Bevölkerung und freie Personen,
- Bevölkerung `− / +`,
- Holzfäller `− / +`,
- globaler Status.

### Produktionsgebäude

- Rezept,
- Input und Output,
- Produktionsstatus,
- Produktionsarbeiter `− / +`,
- Träger `− / +`,
- Abriss.

### Lager

- Bestände je Warentyp,
- Lager-Träger `− / +`,
- Händler `− / +`,
- Warentyp und Zielstatus je Händler,
- „Ziellager wählen“,
- Abriss.

## Desktop und Mobile

Referenzgerät für Mobile ist ein **iPhone 13 Mini mit 375 × 812 CSS-Pixeln**.

- Browser-/Seitenzoom wird unterdrückt.
- Karte belegt den gesamten Viewport.
- Kartenzoom: 0,7× bis 3,5×.
- Desktop: Mausrad-Zoom und Pointer-Drag.
- Touch: ein Finger verschiebt, zwei Finger zoomen.
- Ein kurzer Tap wählt; eine erkennbare Ziehbewegung gilt als Pan.
- Overlays berücksichtigen Safe Areas.

## Simulationsreihenfolge

Pro festem Simulationsschritt:

1. Bewegungsfortschritt wird vergeben; Personen bewegen sich kontinuierlich entlang der aktuellen Kante und schließen bei ausreichendem Fortschritt Kachelankünfte ab.
2. Wiesenverkehr wird bei abgeschlossenen Kachelankünften registriert; neue Wege können entstehen und Routen neu geplant werden.
3. Ankünfte, Abholungen und Lieferungen werden verarbeitet.
4. Produktion schreitet fort beziehungsweise wird abgeschlossen.
5. Erschöpfte Wälder verschwinden und Holzfäller suchen neue Standorte.
6. Neue Beschaffungs- und Handelsaufträge werden geplant.

Alle Regeln bleiben deterministisch und hängen von Simulationszeit statt Darstellungs-FPS ab.
