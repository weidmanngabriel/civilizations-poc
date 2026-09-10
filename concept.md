# Produktkonzept

## PoC 1: Produktionslogistik auf einem Hex-Grid

Ziel des ersten Proof of Concept ist eine personenbasierte Produktions- und Logistiksimulation. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte, und räumliche Planung soll einen direkten spielerischen Effekt haben.

## Karte und Terrain

- Die Welt ist ein festes **41 × 25 Hex-Grid**.
- Die Hexfelder sind ungefähr halb so groß dargestellt wie im früheren 21 × 13 Raster. Dadurch bleibt die sichtbare Welt ähnlich groß, enthält aber deutlich mehr räumliche Auflösung.
- Zu Beginn existiert nur das Hauptquartier als Gebäude.
- Mehrere kleine Gruppen passiver Waldkacheln sind über die Karte verteilt.
- Zu Beginn gibt es keine Wege.
- Wiese, Wald, Wege und Gebäudekacheln sind begehbar.
- Wasser und Berge sind nicht begehbar.

## Gebäude und Platzierung

Gebäude sind keine Ein-Kachel-Objekte mehr. Jeder Gebäudetyp besitzt einen festen zusammenhängenden **Footprint** aus mehreren Hexfeldern.

Aktuelle Größen:

- Hauptquartier: 4 Kacheln,
- Lager: 4 Kacheln,
- Sägewerk: 6 Kacheln,
- Schreinerei: 4 Kacheln.

Ein Gebäude bleibt logisch eine einzelne Entity mit einer Ankerposition. Klick oder Tap auf eine beliebige belegte Kachel selektiert dieselbe Gebäude-Entity.

Form und Anker sind dabei getrennt definiert. Die Gebäudeform besteht aus lokalen Hex-Zellen; zusätzlich bestimmt jeder Gebäudetyp, welche dieser lokalen Zellen der **Ankerpunkt** ist. Die vom Spieler angetippte Kachel ist die Zielposition dieses Ankers, und der restliche Footprint wird relativ dazu platziert. Dadurch kann der Anker künftig ohne Änderung der Platzierungslogik beispielsweise vorne, mittig oder an einer anderen Stelle einer rechteckigen oder unregelmäßigen Gebäudeform liegen.

### Platzierungsregel

Ein Gebäude darf nur platziert werden, wenn:

1. jede Kachel seines Footprints innerhalb der Karte liegt,
2. jede Footprint-Kachel freie Wiese oder Weg ist,
3. auf keiner Footprint-Kachel eine Person steht,
4. **um den kompletten Footprint mindestens ein Ring aus einer freien Kachel bestehen bleibt**.

Der freie Ring muss ebenfalls innerhalb der Karte liegen und aus Wiese oder Weg bestehen. Gebäude können dadurch weder direkt aneinander noch direkt an Wald, Wasser, Berge oder den Kartenrand gesetzt werden.

Wege dürfen vom Footprint überbaut werden. Der vorherige Untergrund jeder belegten Kachel wird gespeichert und beim Abriss wiederhergestellt.

### Baumodus

Gebäude werden nicht mehr sofort auf der zuvor angeklickten Kachel gebaut.

1. Der Spieler wählt auf einer bebaubaren Kachel einen Gebäudetyp.
2. Die UI wechselt in einen eigenen Baumodus und blendet die normalen Steuerelemente aus.
3. Die Karte wird leicht abgedunkelt.
4. **Alle aktuell gültigen Ankerkacheln bleiben in ihrer normalen Helligkeit sichtbar; ungültige Ankerkacheln bleiben abgedunkelt.** Damit ist vor dem ersten Tap sichtbar, auf welche Kacheln das Gebäude gesetzt werden kann.
5. Ein halbtransparenter Gebäude-Ghost snappt auf das Hex-Grid und verwendet die gewählte Kachel als Ankerpunkt.
6. Der komplette Footprint wird dargestellt.
7. Der Ghost wird bei gültiger Position grün und bei ungültiger Position rot hervorgehoben; der notwendige freie Ring wird zusätzlich sichtbar umrandet.
8. **Ein kurzer Tap auf die Karte verschiebt auf Touch-Geräten nur den Ghost.**
9. **Ziehen verschiebt weiterhin ausschließlich die Karte; Pinch-Zoom bleibt unverändert.**
10. Ein klarer Hinweis im Overlay erklärt: „Tippen, um das Gebäude zu verschieben.“
11. Der Bau wird ausschließlich über den sichtbaren **„Bauen“**-Button bestätigt. Dieser ist nur aktiv, wenn die aktuelle Position gültig ist.
12. Ein sichtbarer **„Abbrechen“**-Button beendet den Modus ohne Bau.

Auf Desktop kann der Ghost weiterhin der Mausposition folgen. Auch dort ist „Bauen“ die explizite Bestätigung; ein Karten-Klick baut nicht unmittelbar.

Auf schmalen Displays ordnet der Baumodus seine beiden Aktionsbuttons in einer eigenen Zeile innerhalb des Overlays an, damit weder „Bauen“ noch „Abbrechen“ aus dem sichtbaren Bereich ragen.

## Zeit und Spielgeschwindigkeit

Die Simulation besitzt bei angezeigtem **1× weiterhin 60 feste Simulationsschritte pro realer Sekunde**. Rendering und Simulationsgeschwindigkeit bleiben voneinander getrennt.

Das allgemeine Spieltempo beträgt trotzdem nur **25 % des früheren Tempos**: Bewegungsfortschritt pro Tick wurde auf ein Viertel reduziert und Arbeits-/Produktionsdauern sowie andere Zeitfenster wurden vervierfacht. Dadurch bleiben die Zustände bei 1× mit 60 Hz fein aufgelöst, statt die Simulation nur noch 15-mal pro Sekunde zu aktualisieren.

Autonome **Neuentscheidungen** laufen nicht mit 60 Hz. Eine reguläre Entscheidungsrunde findet einmal pro Simulationssekunde, also alle 60 Simulationsschritte, statt. Bewegung, laufende Produktion und andere kontinuierliche Zustände bleiben bei 60 Hz. Notwendige Folgereaktionen auf konkrete Ereignisse wie Ankunft am Arbeitsplatz, Warenlieferung oder Produktionsabschluss werden sofort verarbeitet und warten nicht auf die nächste Entscheidungsrunde.

Der Spieler steuert die gesamte Simulation relativ zu diesem neuen Basistempo mit:

- 0,5×,
- 1× – Standard,
- 2×,
- 3×,
- Pause.

Die Darstellungs-Framerate bleibt von diesen Geschwindigkeiten unabhängig. Es gibt keinen FPS-Regler, keinen Max-FPS-Modus und keinen „Nächster Schritt“-Button.

## Bewegung und organische Wege

Das Hex-Grid dient Wegfindung und Terrainlogik; Personen bewegen sich kontinuierlich zwischen den Mittelpunkten der Wegkacheln.

Das Grundtempo beträgt bei 1× jetzt **2,5 Kacheln pro realer Sekunde**. Das sind 25 % des vorherigen Tempos von 10 Kacheln pro Sekunde, bei weiterhin 60 Bewegungsupdates pro Sekunde.

- Ein Weg macht Bewegung 30 % schneller.
- Die Wegfindung minimiert Reisezeit und berücksichtigt daher Wege.
- Sichtbare Zwischenpositionen entstehen direkt aus dem deterministischen Simulationsfortschritt.

### Automatische Wegbildung

- Jede vollständige Ankunft auf einer Wiesen-Kachel wird gezählt.
- 8 Überquerungen innerhalb der letzten 32 Sekunden bei 1× machen die Kachel dauerhaft zum Weg.
- Laufende Routen werden danach neu bewertet.
- Manuelles Weg-Bauen und -Entfernen bleibt zusätzlich verfügbar.

## Produktionskette

Nichts produziert ohne konkrete Person.

- Wald: ca. 4 Sekunden bei 1× → 1 Holz.
- Sägewerk: 2 Holz → 1 Brett in ca. 4 Sekunden bei 1×.
- Schreinerei: 2 Bretter → 1 Holzwerkzeug in ca. 4 Sekunden bei 1×.
- Lager: Träger sammeln verfügbare Waren aus nahe gelegenen Produktions- und Rohstofforten ein.

Produzierte Waren bleiben lokal liegen, bis eine Person sie transportiert. Eine Person trägt aktuell genau eine Einheit pro Transportweg.

Sägewerk und Schreinerei besitzen jeweils einen Produktionsarbeiter-Slot und bis zu zwei Träger. Produktionsarbeiter produzieren bevorzugt und beschaffen nur dann selbst Rohstoffe, wenn die Produktion blockiert ist. Träger beschaffen ausschließlich Inputs ihrer Arbeitsstätte.

## Inventare, Lager und Reservierungen

Produktions- und Rohstofforte:

- Input maximal 10 Einheiten,
- Output maximal 3 Einheiten.

Lager:

- maximal 20 Holz,
- maximal 20 Bretter,
- maximal 20 Holzwerkzeuge.

Ein Produktionsvorgang startet nur, wenn Platz für Output reserviert werden kann. Geplante Transporte zählen gegen Zielkapazitäten und vorhandene Waren werden für Abholaufträge reserviert.

Der Lager-Sammelradius beträgt wegen der verdoppelten Rasterdichte jetzt **10 begehbare Kachelschritte**. Das erhält ungefähr die bisherige physische Reichweite. Die Reichweite wird weiterhin in Schritten und nicht in Reisezeit gemessen.

Lager-Träger holen Waren niemals aus einem anderen Lager. Produktionsarbeiter und Träger dürfen benötigte Waren dagegen auch aus weiter entfernten Lagern holen.

## Händler und Handelsrouten

Händler sind eine eigene Lagerrolle und die bewusste Ausnahme zur Lager-zu-Lager-Regel.

- Bis zu zwei Händler pro Lager.
- Genau ein Startlager je Händler.
- Route = Ziellager + Warentyp.
- Kein 10-Kachel-Limit.
- Eine Einheit pro Fahrt.

Ablauf: am Startlager warten → Ware und Zielkapazität reservieren → transportieren → leer zurücklaufen → wiederholen.

Die Zielwahl geschieht in einem modalen Kartenmodus. Die Simulation pausiert währenddessen; gültige Lager werden hervorgehoben, Pan und Zoom bleiben möglich und Kamera sowie vorheriger Laufzustand werden danach wiederhergestellt.

## Gebäude abreißen

Frei baubar und abreißbar sind Lager, Sägewerk und Schreinerei.

Beim Abriss:

- verschwindet die gesamte Footprint-Fläche,
- alle darunter gespeicherten Wiesen-/Wegkacheln werden wiederhergestellt,
- lokale Waren verfallen,
- zugewiesene Personen werden frei und laufen zum HQ,
- betroffene Transporte und Handelsrouten werden bereinigt.

HQ und aktive Wälder können nicht manuell abgerissen werden.

## Holzfäller und Wälder

Holzfäller sind ein globaler Beruf und werden keinem Wald manuell zugewiesen.

- Jeder freie Mensch kann Holzfäller werden.
- Jeder Holzfäller sucht selbständig einen erreichbaren freien Wald.
- Pro aktivem Wald arbeitet maximal ein Holzfäller.
- Bei gleichwertigen Kandidaten entscheidet ein reproduzierbarer Seed-Zufall.
- Passive Waldkacheln werden beim Anspruch zu aktiven Wald-Arbeitsstätten.

Jeder aktive Wald besitzt 10 Holzvorrat und maximal 3 lokalen Output. Die Darstellung verblasst proportional zum Restvorrat, aber nie unter 35 %, solange der Wald existiert.

Nach der zehnten produzierten Holzeinheit verschwindet der Wald sofort und seine Kachel wird Wiese. Bereits produziertes Restholz bleibt dort liegen.

## Bevölkerung und Hauptquartier

Der PoC startet mit acht Personen. Freie Personen sammeln sich am HQ. Freigesetzte Personen laufen von ihrer aktuellen Position zurück; neue Zuweisungen können sie unterwegs umlenken.

Debug-Bevölkerungssteuerung:

- +1 erzeugt eine freie Person am HQ,
- −1 entfernt nur eine freie Person, die tatsächlich am HQ steht.

## Bedienung

Die Karte ist dauerhaft bildschirmfüllend. Status und Steuerungen liegen als kompakte Overlays darüber.

- Kurzer Klick/Tap auf eine beliebige Footprint-Kachel: Gebäudedialog.
- Kurzer Klick/Tap auf freie Kachel: lokale Bau- und Wegoptionen.
- Unten: Pause/Fortsetzen und 0,5× / 1× / 2× / 3×.
- Oben: Build-Version und Kernmetriken.
- Debug-Personenliste bleibt standardmäßig verborgen.

## Desktop und Mobile

Referenzgerät ist ein iPhone 13 Mini mit 375 × 812 CSS-Pixeln.

- Browser-/Seitenzoom wird unterdrückt.
- Karte belegt den gesamten Viewport.
- Kartenzoom: 0,7× bis 3,5×.
- Desktop: Mausrad-Zoom und Pointer-Drag.
- Touch: ein Finger verschiebt, zwei Finger zoomen.
- Im Baumodus verschiebt ein kurzer Tap nur den Ghost; Ziehen bleibt Pan.
- Der Bau wird im Baumodus ausschließlich mit „Bauen“ bestätigt oder mit „Abbrechen“ verworfen.
- Im Baumodus zeigen normal helle Kacheln die aktuell gültigen Ankerpositionen; die übrige Karte bleibt leicht abgedunkelt.
- Overlays berücksichtigen Safe Areas.

## Simulationsreihenfolge

Pro festem Simulationsschritt:

1. Bewegungsfortschritt vergeben und Kachelankünfte abschließen.
2. Wiesenverkehr registrieren; neue Wege können entstehen und Routen neu geplant werden.
3. Ankünfte, Abholungen und Lieferungen verarbeiten; notwendige direkte Folgereaktionen werden für denselben Tick markiert.
4. Produktion fortschreiben oder abschließen.
5. Erschöpfte Wälder entfernen und betroffene Holzfäller sofort neu zuweisen.
6. Neue Beschaffungs-, Händler- und Warteentscheidungen nur in der regulären 1-Hz-Entscheidungsrunde oder bei einer markierten Sofortreaktion planen.

Alle Regeln bleiben deterministisch und hängen von Simulationszeit statt Darstellungs-FPS ab.
