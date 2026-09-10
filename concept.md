# Produktkonzept

## PoC 1: Produktionslogistik auf einem Hex-Grid

Ziel des ersten Proof of Concept ist eine personenbasierte Produktions- und Logistiksimulation. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte, und räumliche Planung soll einen direkten spielerischen Effekt haben.

## Karte und Terrain

- Die Welt ist ein festes **41 × 25 Hex-Grid**.
- Die Hexfelder sind ungefähr halb so groß dargestellt wie im früheren 21 × 13 Raster.
- Zu Beginn existiert nur das Hauptquartier als Gebäude.
- Mehrere kleine Gruppen passiver Waldkacheln sind über die Karte verteilt.
- Zu Beginn gibt es keine Wege.
- Wiese, Wald, Acker, Wege und Gebäudekacheln sind begehbar.
- Wasser und Berge sind nicht begehbar.

## Gebäude und Platzierung

Gebäude besitzen feste zusammenhängende Footprints aus mehreren Hexfeldern und eine Ankerposition.

Aktuelle Größen:

- Hauptquartier: 4 Kacheln,
- Lager: 4 Kacheln,
- Farm: 4 Kacheln,
- Sägewerk: 6 Kacheln,
- Schreinerei: 4 Kacheln.

Ein Gebäude bleibt logisch eine einzelne Entity. Klick oder Tap auf eine beliebige belegte Kachel selektiert dieselbe Gebäude-Entity.

### Platzierungsregel

Ein Gebäude darf nur platziert werden, wenn:

1. jede Kachel seines Footprints innerhalb der Karte liegt,
2. jede Footprint-Kachel freie Wiese oder Weg ist,
3. auf keiner Footprint-Kachel eine Person steht,
4. um den kompletten Footprint mindestens ein Ring aus einer freien Kachel bestehen bleibt.

Der freie Ring muss ebenfalls innerhalb der Karte liegen und aus Wiese oder Weg bestehen. Gebäude können dadurch weder direkt aneinander noch direkt an Wald, Acker, Wasser, Berge oder den Kartenrand gesetzt werden.

Wege dürfen vom Footprint überbaut werden. Der vorherige Untergrund jeder belegten Kachel wird gespeichert und beim Abriss wiederhergestellt.

### Baumodus

1. Der Spieler wählt auf einer bebaubaren Kachel einen Gebäudetyp.
2. Die UI wechselt in einen eigenen Baumodus.
3. Die Karte wird leicht abgedunkelt; gültige Ankerkacheln bleiben normal hell.
4. Beim Start wird noch kein Gebäude-Ghost angezeigt.
5. Der erste kurze Klick/Tap wählt eine Position und zeigt den Ghost.
6. Der komplette Footprint und der notwendige freie Ring werden dargestellt.
7. Gültig wird grün, ungültig rot visualisiert.
8. Desktop-Hover oder ein kurzer Touch-Tap können danach den Ghost verschieben.
9. Ziehen verschiebt weiterhin nur die Karte; Pinch-Zoom bleibt aktiv.
10. Der Bau wird ausschließlich über „Bauen“ bestätigt. „Abbrechen“ beendet den Modus ohne Änderung.

### Baustellen und Bauarbeiter

Lager, Farm, Sägewerk und Schreinerei werden zunächst als unfertige Baustelle angelegt. Der Footprint ist sofort belegt; die spätere Gebäudefunktion bleibt bis zur Fertigstellung gesperrt.

Aktuelle PoC-Baukosten:

- Lager: 4 Holz,
- Farm: 4 Holz,
- Sägewerk: 6 Holz,
- Schreinerei: 4 Bretter.

Die normale Bauzeit bei einem Bauarbeiter beträgt **3 Sekunden Grundzeit plus 2 Sekunden pro benötigter Ressourceneinheit**. Damit dauern Lager, Farm und Schreinerei aktuell 11 Sekunden und das Sägewerk 15 Sekunden.

Bauarbeiter sind ein globaler Berufspool am Hauptquartier. Freie Bauarbeiter suchen selbständig erreichbare Baustellen. Pro Baustelle arbeiten maximal zwei gleichzeitig. Direkt bei der Zuweisung prüft ein Bauarbeiter fehlendes Baumaterial: Ist eine erreichbare, nicht reservierte Ressource verfügbar, läuft er von seiner aktuellen Position direkt zur Quelle und anschließend zur Baustelle. Nur wenn aktuell nichts verfügbar ist, läuft er zunächst zur Baustelle und wartet dort. Ein zweiter aktiver Bauarbeiter verdoppelt den Baufortschritt. Nach Fertigstellung bleiben beide im Bauarbeiter-Pool und werden neu disponiert.

## Zeit und Spielgeschwindigkeit

Die Simulation läuft bei angezeigtem **1× mit 60 festen Simulationsschritten pro realer Sekunde**. Rendering und Simulation sind getrennt.

Autonome Neuentscheidungen laufen grundsätzlich einmal pro Simulationssekunde. Ereignisse wie Ankunft, Lieferung, Produktionsabschluss, Farmaktion oder Bauabschluss können unmittelbar eine neue Entscheidung auslösen.

Der Spieler steuert die Simulation mit 0,5×, 1×, 2×, 3× und Pause. Die Darstellungs-Framerate bleibt davon unabhängig.

## Bewegung und organische Wege

Personen bewegen sich kontinuierlich zwischen Hex-Mittelpunkten. Das Grundtempo beträgt bei 1× 2,5 Kacheln pro Sekunde.

- Wege machen Bewegung 30 % schneller.
- Die Wegfindung minimiert Reisezeit und berücksichtigt Wege.
- Acht Überquerungen einer Wiese innerhalb von 32 Sekunden erzeugen dort dauerhaft einen Weg.
- Laufende Routen werden nach neuer Wegbildung neu bewertet.
- Manuelles Bauen und Entfernen von Wegen bleibt möglich.

## Produktionskette

Nichts produziert ohne konkrete Person.

- Wald: ca. 4 Sekunden → 1 Holz.
- Sägewerk: 2 Holz → 1 Brett in ca. 4 Sekunden.
- Schreinerei: 2 Bretter → 1 Holzwerkzeug in ca. 4 Sekunden.
- Farm: Farmer bewirtschaftet bis zu vier umliegende Acker und erzeugt nach der Ernte je Acker 1 Weizen.
- Lager: Träger sammeln verfügbare Waren aus nahe gelegenen Produktions- und Rohstofforten ein.

Produzierte Waren bleiben lokal liegen, bis eine Person sie transportiert. Eine Person trägt aktuell genau eine Einheit pro Transportweg.

## Farm, Acker und Weizen

Eine fertige Farm besitzt genau einen Farmer-Slot. Der Farmer arbeitet autonom und bewirtschaftet maximal **vier gleichzeitig aktive Acker**.

### Aussaat

- Solange weniger als vier aktive Acker existieren, sucht der Farmer eine zufällige geeignete freie Wiese.
- Geeignet sind erreichbare Wiesen innerhalb von **drei Hex-Schritten vom Farm-Footprint**.
- Bereits von einem anderen Farmer für die Aussaat reservierte Kacheln werden ausgeschlossen.
- Der Farmer läuft physisch zur Zielkachel.
- Aussäen dauert bei 1× **10 Sekunden**.
- Danach wird die Wiese zu einem Acker auf Wachstumsstufe 1.

### Wachstum

Ein Acker besitzt vier sichtbare Zustände: Wachstumsstufe 1, 2, 3 und erntereif. Zwischen den Stufen liegen ohne Farmerhilfe jeweils **30 Sekunden Simulationszeit**.

Wenn der Farmer gerade weder ernten noch einen fehlenden Acker anlegen muss, sucht er sich einen noch nicht erntereifen Acker und **düngt** ihn. Während des Düngens läuft dessen Wachstumsfortschritt mit dreifacher Geschwindigkeit. Dadurch sinkt die verbleibende Zeit bis zur nächsten Stufe auf ein Drittel: 30 Sekunden Restzeit werden zu 10 Sekunden Arbeit, 15 Sekunden Restzeit zu 5 Sekunden Arbeit. Sobald die nächste Stufe erreicht ist, endet das Düngen sofort.

### Ernte

- Erntereife Acker haben Vorrang vor Aussaat und Düngen.
- Der Farmer läuft physisch zum Acker.
- Ernten dauert bei 1× **10 Sekunden**.
- Mit Abschluss der Ernte nimmt der Farmer **1 Weizen** direkt auf.
- Die Acker-Kachel wird sofort wieder normale Wiese.
- Der abgeerntete Acker zählt nicht mehr zu den maximal vier aktiven Ackern.
- Der Farmer trägt den Weizen physisch zurück zur Farm und legt ihn dort in den lokalen Output. Erst danach beginnt er seine nächste Feldaufgabe.
- Ist der Farm-Output voll, wartet der Farmer mit weiteren Ernten.

Lager-Träger holen Weizen damit ausschließlich an der Farm ab; im Normalfall bleibt nach der Ernte kein Weizen auf dem ehemaligen Acker liegen.

Die Priorität des Farmers lautet:

```text
erntereifen Acker ernten
→ falls weniger als 4 Acker: neuen Acker aussäen
→ sonst nicht erntereifen Acker düngen
→ warten, falls keine Aktion möglich ist
```

## Inventare, Lager und Reservierungen

Produktions- und Rohstofforte besitzen lokale Bestände. Produktionsinputs fassen maximal 10 Einheiten, normale Outputs maximal 3 Einheiten. Farmen halten geernteten Weizen in ihrem lokalen Output, nachdem der Farmer ihn vom Feld zurückgebracht hat.

Lager halten aktuell maximal 20 Einheiten je Warentyp:

- Holz,
- Bretter,
- Holzwerkzeuge,
- Weizen.

Geplante Transporte reservieren Quelle und Zielkapazität. Lager-Träger sammeln Waren nur aus Nicht-Lagern innerhalb von **10 begehbaren Kachelschritten**. Sie verschieben niemals automatisch Ware von einem Lager in ein anderes.

## Händler und Handelsrouten

Händler sind die bewusste Ausnahme zur Lager-zu-Lager-Regel.

- Bis zu zwei Händler pro Lager.
- Genau ein Startlager je Händler.
- Route = Ziellager + Warentyp.
- Weizen kann wie andere Waren als Handelsgut gewählt werden.
- Kein 10-Kachel-Limit.
- Eine Einheit pro Fahrt.

Die Zielwahl geschieht in einem modalen Kartenmodus. Die Simulation pausiert währenddessen; gültige fertige Lager werden hervorgehoben, Pan und Zoom bleiben möglich und Kamera sowie vorheriger Laufzustand werden danach wiederhergestellt.

## Gebäude abreißen

Frei baubar und abreißbar sind Lager, Farm, Sägewerk und Schreinerei, einschließlich unfertiger Baustellen.

Beim Abriss verschwinden Footprint und lokale Gebäudebestände, der gespeicherte Untergrund wird wiederhergestellt, Personen werden freigesetzt und betroffene Transporte werden bereinigt. Bei einer Farm verschwinden zusätzlich alle noch aktiven zugehörigen Acker und werden zu Wiese. Bereits abgeernteter, lose liegender Weizen bleibt erhalten.

HQ, aktive Wälder und Acker können nicht direkt manuell abgerissen werden.

## Holzfäller und Wälder

Holzfäller sind ein globaler Beruf und werden keinem Wald manuell zugewiesen.

- Jeder freie Mensch kann Holzfäller werden.
- Jeder Holzfäller sucht selbständig einen erreichbaren freien Wald.
- Pro aktivem Wald arbeitet maximal ein Holzfäller.
- Bei gleichwertigen Kandidaten entscheidet ein reproduzierbarer Seed-Zufall.
- Passive Waldkacheln werden beim Anspruch zu aktiven Wald-Arbeitsstätten.

Jeder aktive Wald besitzt 10 Holzvorrat und maximal 3 lokalen Output. Nach der zehnten produzierten Holzeinheit verschwindet der Wald sofort und seine Kachel wird Wiese. Bereits produziertes Restholz bleibt dort liegen.

## Bevölkerung und Hauptquartier

Der PoC startet mit acht Personen. Freie Personen sammeln sich am HQ. Freigesetzte Personen laufen von ihrer aktuellen Position zurück; neue Zuweisungen können sie unterwegs umlenken.

Im HQ werden Bevölkerung sowie die globalen Pools für Holzfäller und Bauarbeiter gesteuert. Farmer werden dagegen direkt einer fertigen Farm zugewiesen.

## Bedienung

Die Karte ist dauerhaft bildschirmfüllend. Status und Steuerungen liegen als kompakte Overlays darüber.

- Kurzer Klick/Tap auf eine Gebäude-Footprint-Kachel: Gebäude- oder Baustellendialog.
- Kurzer Klick/Tap auf freie Wiese oder Weg: lokale Bau- und Wegoptionen.
- Acker sind sichtbar, aber keine direkt steuerbaren Gebäude.
- Unten: Pause/Fortsetzen und 0,5× / 1× / 2× / 3×.
- Oben: Build-Version und Kernmetriken einschließlich Weizenbestand in Lagern.
- Debug-Personenliste zeigt Farmeraktionen wie Säen, Düngen und Ernten.

## Desktop und Mobile

Referenzgerät ist ein iPhone 13 Mini mit 375 × 812 CSS-Pixeln.

- Browser-/Seitenzoom wird unterdrückt.
- Karte belegt den gesamten Viewport.
- Kartenzoom: 0,7× bis 3,5×.
- Desktop: Mausrad-Zoom und Pointer-Drag.
- Touch: ein Finger verschiebt, zwei Finger zoomen.
- Im Baumodus wird der Ghost erst nach dem ersten kurzen Klick/Tap angezeigt.
- Danach verschiebt ein kurzer Tap auf Touch nur den Ghost; Ziehen bleibt Pan.
- Overlays berücksichtigen Safe Areas.

## Simulationsreihenfolge

Pro festem Simulationsschritt:

1. Bewegungsfortschritt vergeben und Kachelankünfte abschließen.
2. Wiesenverkehr registrieren; neue Wege können entstehen und Routen neu geplant werden.
3. Ankünfte, Abholungen und Lieferungen verarbeiten.
4. Baustellenfortschritt fortschreiben.
5. Ackerwachstum und laufende Farmeraktionen fortschreiben; Düngen beschleunigt das aktuelle Feldwachstum.
6. Normale Produktion fortschreiben oder abschließen.
7. Erschöpfte Wälder entfernen und Holzfäller neu zuweisen.
8. Neue Beschaffungs-, Farmer-, Bauarbeiter- und Händlerentscheidungen in der regulären 1-Hz-Runde oder bei markierter Sofortreaktion planen.

Alle Regeln bleiben deterministisch und hängen von Simulationszeit statt Darstellungs-FPS ab.