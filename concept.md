# Produktkonzept

## PoC 1: Produktionslogistik auf einem Hex-Grid

Ziel des ersten Proof of Concept ist es, den Kern der personenbasierten Produktionslogistik zu testen. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte, und Laufwege sollen spielerisch relevant sein.

## Kartenstruktur

- Jedes Kartenfeld ist ein Hexfeld.
- Gebäude belegen jeweils genau ein Hexfeld.
- Weg-, Wald- und Gebäudekacheln sind begehbar.
- Wiesen, Berge und Flüsse sind aktuell nicht begehbar.
- Die feste Startkarte umfasst **21 × 13 Hexfelder** mit Hauptquartier, Sägewerk, Schreinerei und Lager.
- Zu Beginn gibt es keinen aktiven Wald als Arbeitsstätte. Mehrere kleine Gruppen passiver Waldkacheln sind über die Karte verteilt.
- Das Straßennetz enthält bewusst längere Wege, Abzweigungen und Umwege.
- Freie Gebäudeplatzierung gehört noch nicht zum PoC.

## Zeit und Bewegung

Der PoC läuft rundenbasiert.

- Jede begehbare Kante kostet aktuell eine Runde.
- Jede Person bewegt sich pro Runde höchstens um eine Kante.
- Der kürzeste erreichbare Weg wird über das Hex-Netz bestimmt.
- Produktion dauert fünf Arbeitsrunden.
- Runden können manuell oder automatisch ausgeführt werden.
- Normaler Autolauf: **1–10 FPS**.
- Zusätzlich gibt es **Max FPS**, bei dem eine Simulationsrunde pro Browser-Animationsframe ausgeführt wird.

## Produktionskette

Nichts produziert ohne konkrete Person.

Aktuelle Kette:

- Wald: 5 Arbeitsrunden → 1 Holz.
- Sägewerk: 2 Holz → 1 Brett in 5 Arbeitsrunden.
- Schreinerei: 2 Bretter → 1 Holzwerkzeug in 5 Arbeitsrunden.
- Lager: Träger sammeln fertige Holzwerkzeuge ein.

Produzierte Waren bleiben lokal liegen, bis eine Person sie transportiert. Eine Person trägt aktuell genau eine Ware pro Transportweg.

Sägewerk und Schreinerei besitzen jeweils einen Produktionsarbeiter-Slot und bis zu zwei Träger. Der Produktionsarbeiter produziert bevorzugt und beschafft nur dann selbst Rohstoffe, wenn die Produktion blockiert ist. Träger beschaffen ausschließlich die Inputs ihrer zugewiesenen Arbeitsstätte.

## Inventare und Reservierungen

Produktions- und Rohstofforte besitzen getrennte Kapazitäten:

- Input: maximal 10 Einheiten.
- Output: maximal 3 Einheiten.
- Das Lager ist aktuell unbegrenzt.

Ein Produktionsvorgang startet nur, wenn Platz für den späteren Output reserviert werden kann. Bereits geplante Transporte zählen gegen die Zielkapazität. Eine vorhandene Ware wird beim Abholauftrag reserviert, damit sie nicht mehrfach verplant werden kann.

Wird ein Transport während des Tragens abgebrochen, kehrt die Ware zur ursprünglichen Quelle zurück.

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
- Die frühere große Überschrift, Intro, Kartenüberschrift, Legende und Footer entfallen aus der normalen Ansicht.

Oben liegt ein kleines HUD mit Build-Version und Kernwerten wie Runde, Bevölkerung, freie Personen und Werkzeugbestand.

Unten liegt die Simulationssteuerung mit Rundenschritt, Autolauf, FPS-Regler und Max-FPS-Toggle.

Ein ausgewähltes Gebäude öffnet sein Detailpanel als Bottom-Overlay über der unteren Steuerung.

### Hauptquartier

Das HQ enthält die globalen Personalsteuerungen:

- aktuelle Bevölkerung und freie Personen,
- Bevölkerung `− / +`,
- Holzfäller `− / +`,
- globaler Status.

Damit liegen auch die Holzfäller-Controls beim HQ, obwohl Holzfäller später an dynamischen Waldstandorten arbeiten.

### Sägewerk und Schreinerei

Die Gebäudeansicht zeigt:

- Rezept,
- Input und Output,
- Produktionsstatus,
- Produktionsarbeiter `− / +`,
- Träger `− / +`,
- aktive gegenüber nur zugewiesenen Personen.

### Lager

Die Lageransicht zeigt:

- aktuellen Werkzeugbestand,
- Status,
- Lager-Träger `− / +`.

### Aktive Wälder

Ein aktiver Wald zeigt:

- verbleibenden Holzvorrat,
- lokalen Holz-Output,
- Arbeitsstatus.

Es gibt dort keine manuelle Holzfäller-Zuweisung; diese bleibt global und automatisch.

### Debug-Personenliste

Die globale Liste aller Personen und Transportaufträge bleibt als Entwicklungswerkzeug erhalten, ist aber standardmäßig verborgen. Ein Debug-Button öffnet sie als Overlay über der Karte; sie belegt keinen dauerhaften Bildschirmbereich mehr.

## Desktop und Mobile

Das Spiel muss dauerhaft auch auf Smartphones bedienbar bleiben. Referenzgerät ist ein **iPhone 13 Mini mit 375 × 812 CSS-Pixeln**.

- Browser-/Seitenzoom wird unterdrückt.
- Die Karte belegt `100vw × 100dvh` beziehungsweise den jeweils verfügbaren Viewport.
- Kartenzoom: **0,7× bis 3,5×**.
- Desktop: Mausrad zum Zoomen, Pointer-Drag zum Verschieben.
- Touch: ein Finger verschiebt, zwei Finger zoomen.
- Ein kurzer Tap wählt ein Gebäude aus; eine erkennbare Ziehbewegung gilt als Pan und löst keine Auswahl aus.
- Auf iOS Safari werden Gesten direkt am Canvas verarbeitet, damit die Karte statt der Webseite gezoomt wird.
- Overlays berücksichtigen Safe-Area-Abstände für Notch und Home-Indikator.

## Simulationsreihenfolge

Pro Runde gilt weiterhin:

1. Personen bewegen sich höchstens einmal.
2. Ankünfte, Abholungen und Lieferungen werden verarbeitet.
3. Produktion schreitet fort beziehungsweise wird abgeschlossen.
4. Erschöpfte Wälder verschwinden und Holzfäller suchen neue Standorte.
5. Neue Beschaffungsaufträge werden geplant.

Neu geplante Wege beginnen erst in der folgenden Runde. Produktionsinputs bleiben bis zur Fertigstellung im Gebäude. Bei Freisetzung verfällt laufender Arbeitsfortschritt, vorhandene Materialien bleiben erhalten.

## Noch nicht Teil des PoC

- Bauarbeiter und Baustellenlogistik
- Bedürfnisse wie Hunger und Schlaf
- Familien, Kinder und Wohnen
- natürliche Geburten und Todesfälle
- Kampf, Diplomatie und Handel
- Berufserfahrung und Freischaltungen
- freie Gebäudeplatzierung
- allgemeines Einsammeln beliebiger Waren durch Lager-Träger
- unterschiedliche Bewegungskosten oder Geschwindigkeiten je Gelände
- Karren oder andere Transportmittel

## Leitprinzip

Rohstoffarbeiter, Produktionsarbeiter, unterstützende Träger, Lager-Träger und spätere Bauarbeiter dürfen unterschiedliche Beschaffungsregeln besitzen, sollen aber dasselbe grundlegende Waren-, Weg- und Bewegungssystem verwenden.

Die Bedienung soll diesem Prinzip folgen: globale Entscheidungen gehören zum HQ beziehungsweise zu übergeordneten Ansichten; lokale Entscheidungen und Informationen gehören direkt zum betroffenen Gebäude auf der Karte.
