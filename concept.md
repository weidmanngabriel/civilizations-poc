# Produktkonzept

## PoC 1: Produktionslogistik auf einem Graphen

Ziel des ersten Proof of Concept ist es, den Kern der personenbasierten Produktionslogistik zu testen. Die Welt wird als Hex-Grid mit begehbaren Weg-, Wald- und Gebäudekacheln modelliert. Gebäude werden nicht direkt miteinander verbunden; Laufwege und physischer Warentransport sollen sichtbar und spielerisch relevant sein.

### Kartenstruktur

- Jede Kartenkachel ist ein Hexfeld.
- Jedes Gebäude belegt genau ein Hexfeld.
- Wegkacheln, Waldkacheln und Gebäudekacheln sind begehbar.
- Wiesen, Berge und Flüsse sind zunächst nicht begehbar.
- Geländearten besitzen noch keine unterschiedlichen Bewegungskosten oder Boni.
- Die erste Karte ist fest vorgegeben; freie Gebäudeplatzierung gehört noch nicht zum PoC.
- Die aktuelle Startkarte umfasst **21 × 13 Hexfelder** mit Hauptquartier, Sägewerk, Schreinerei und Lager.
- Zu Beginn existiert **kein aktiver Wald als Arbeitsstätte**. Stattdessen liegen mehrere kleine Gruppen passiver Waldkacheln über die Karte verteilt.
- Die Gebäude liegen bewusst weiter auseinander; das Straßennetz enthält längere Wege, Verzweigungen und Umwege.

### Zeit- und Bewegungsmodell

Der PoC läuft rundenbasiert.

- Jede Kante hat die Länge 1.
- Jede Figur bewegt sich pro Runde höchstens um eine Kante.
- Wege werden über den kürzesten begehbaren Pfad bestimmt, nicht über Luftlinie.
- Eine Produktion dauert 5 Arbeitsrunden.
- Runden können manuell einzeln oder automatisch ausgeführt werden.
- Der normale Autolauf besitzt einen Regler von **1 bis 10 FPS**; 1 FPS entspricht einer Simulationsrunde pro realer Sekunde.
- Zusätzlich gibt es einen Toggle **Max FPS**. Ist er aktiv, wird der FPS-Regler deaktiviert und die Simulation führt eine Runde pro Browser-Animationsframe aus. Die Simulationsregeln selbst ändern sich dadurch nicht.

### Allgemeines Produktionsprinzip

Nichts produziert automatisch. Jede Produktion benötigt eine konkrete zugewiesene Person.

Für verarbeitende Arbeitsstätten gilt:

- Sägewerk und Schreinerei besitzen jeweils genau einen Produktionsarbeiter-Slot.
- Der Produktionsarbeiter kann benötigte Rohstoffe selbst beschaffen.
- Produktion hat Vorrang: Sind genügend Inputs vorhanden und ist Output-Kapazität frei, produziert der Arbeiter direkt weiter.
- Nur wenn Produktion aktuell nicht möglich ist, kann der Arbeiter freie Input-Slots mit weiteren Beschaffungsgängen auffüllen.
- Zusätzlich können je Produktionsstätte bis zu 2 Träger eingesetzt werden, die ausschließlich Rohstoffe für diese Arbeitsstätte beschaffen.

Einheitliches Rezeptprinzip im PoC:

- 2 Einheiten Input werden verbraucht.
- Nach 5 Produktionsrunden entsteht 1 Einheit Output.

Aktuelle Kette:

- 2 Holz → 1 Brett im Sägewerk.
- 2 Bretter → 1 Holzwerkzeug in der Schreinerei.
- Produzierte Waren bleiben lokal liegen, bis sie abgeholt werden.
- Eine Figur trägt pro Transportweg genau 1 Einheit Ware.

### Holzfäller und Waldstandorte

Holzfäller werden **global ernannt** und nicht manuell einem bestimmten Wald zugewiesen.

- Der Spieler kann beliebig viele freie Personen zu Holzfällern ernennen; praktisch begrenzen nur die aktuelle Bevölkerung und verfügbare Waldstandorte die aktive Arbeit.
- Jeder Holzfäller sucht selbständig einen eigenen Wald.
- Pro aktivem Wald darf **genau ein Holzfäller** arbeiten.
- Ein neuer Holzfäller sucht den nächstgelegenen erreichbaren, nicht belegten Waldstandort.
- Dabei können sowohl noch passive Waldkacheln als auch bereits aktive, aber gerade unbesetzte und noch nicht erschöpfte Wälder gewählt werden.
- Gibt es mehrere gleich weit entfernte Kandidaten, wird pseudozufällig gewählt.
- Der Zufall bleibt über einen Seed im Weltzustand reproduzierbar, damit Simulation und Tests deterministisch wiederholbar sind.
- Wird eine passive Waldkachel gewählt, wird sie zu einer aktiven Wald-Arbeitsstätte.
- Hat ein ernannter Holzfäller aktuell keinen verfügbaren Wald, bleibt er Holzfäller und wartet beziehungsweise bewegt sich zurück in Richtung Hauptquartier, bis wieder ein Wald frei wird.

Für jeden aktiven Wald gilt:

- Er startet mit **10 Einheiten Holzvorrat**.
- Der Holzfäller produziert nach 5 Arbeitsrunden genau 1 Holz.
- Jede produzierte Einheit reduziert den verbleibenden Waldvorrat um 1.
- Das lokale Output-Inventar besitzt wie andere begrenzte Produktionsorte 3 Plätze.
- Ist der Output voll, pausiert der Holzabbau bis wieder Platz frei ist.
- Der sichtbare Wald verblasst proportional zum verbleibenden Holzvorrat.
- Die Sichtbarkeit fällt nie unter **35 %**, solange der Wald noch existiert, damit der Standort weiterhin klar erkennbar bleibt.

Sobald der zehnte Holzvorrat produziert wurde:

- Der Wald ist erschöpft und verschwindet **sofort** als sichtbarer Wald beziehungsweise aktive Arbeitsstätte.
- Seine Kachel wird zu einer normalen begehbaren Wegkachel.
- Der Holzfäller sucht unmittelbar den nächsten verfügbaren Wald und läuft regulär dorthin; es gibt keine Teleportation.
- Bereits produziertes Holz bleibt vollständig an der alten Position liegen und kann weiterhin abgeholt werden.
- Das intern verbliebene Quellobjekt darf deshalb noch für Restholz und laufende Transportreferenzen existieren, wird aber nicht mehr als Wald dargestellt.
- Wird bereits getragenes Holz durch eine Debug-Umbesetzung zurückgebucht, bleibt der Wald trotzdem verschwunden; nur das Holz liegt wieder an der alten Position.

### Träger an Produktionsstätten

Träger sind keine globalen Warenkuriere, sondern unterstützen genau die Arbeitsstätte, der sie zugeordnet sind.

- Sägewerk und Schreinerei können jeweils bis zu 2 Träger haben.
- Träger holen die von ihrer Arbeitsstätte benötigten Rohstoffe an verfügbaren Quellen ab.
- Bereits geplante Lieferungen zählen gegen die Input-Kapazität des Ziels.
- Ein Abholauftrag reserviert eine physisch vorhandene Wareneinheit, damit dieselbe Ware nicht doppelt beansprucht werden kann.
- Wird eine Person während eines getragenen Transports freigesetzt, wird die Ware an der ursprünglichen Quelle zurückgebucht.

### Lager

Das Lager ist keine Produktionsstätte.

- Es kann bis zu 2 Träger haben.
- Diese sammeln aktuell ausschließlich Holzwerkzeuge aus der Schreinerei ein.
- Das Lager besitzt im PoC keine Kapazitätsgrenze.
- Eingelagerte Waren bleiben dauerhaft als Bestand erhalten.

### Inventarkapazitäten

Für alle Produktions- und Rohstoffknoten außer dem Lager gelten getrennte Input- und Output-Kapazitäten.

- Input: maximal 10 Einheiten.
- Output: maximal 3 Einheiten.
- Input und Output teilen sich keine gemeinsame Kapazität.
- Ein Produktionsvorgang startet nur, wenn Platz für seinen Output reserviert werden kann.
- Laufende Produktion reserviert den zukünftigen Output-Platz.
- Reservierte, aber noch nicht physisch angelieferte Inputs erscheinen nicht als gefüllte Slots.
- Auf der Karte werden begrenzte Inputs und Outputs als sichtbare Ressourcen-Slots dargestellt.
- Restholz eines bereits verschwundenen Waldes bleibt als Ressource an der alten Position sichtbar.
- Das unbegrenzte Lager zeigt keine künstlichen Kapazitäts-Slots.

### Arbeitskräfte und Hauptquartier

Der PoC startet standardmäßig mit 8 Personen. Das ist nur ein konfigurierbarer Startwert, kein dauerhaftes Bevölkerungslimit.

Das Hauptquartier dient als Sammelpunkt für freie Personen.

- Freie Personen besitzen keine Arbeitszuweisung und keinen globalen Holzfällerjob.
- Wird eine Person aus einer stationären Arbeitsstätte freigesetzt, endet ihre Zuweisung sofort und sie läuft vom aktuellen Ort zum Hauptquartier.
- Wird eine freie Person unterwegs neu eingesetzt, läuft sie von ihrer aktuellen Position direkt zum neuen Ziel weiter.
- Eine Person zählt erst nach Ankunft als aktiv an einer stationären Arbeitsstätte.
- Personen werden nie zwischen Arbeitsstätten teleportiert.

Aktuelle Besetzungsregeln:

- Holzfäller: globaler Job, beliebig viele Ernennungen, aber maximal 1 pro Wald.
- Sägewerk: 0–1 Produktionsarbeiter und 0–2 Träger.
- Schreinerei: 0–1 Produktionsarbeiter und 0–2 Träger.
- Lager: 0 Produktionsarbeiter und 0–2 Lager-Träger.

### Bevölkerung im laufenden PoC

Unter dem Spiel gibt es eine Debug-Steuerung für die Bevölkerung.

- `+1` erzeugt eine neue freie Person am Hauptquartier.
- `-1` entfernt nur eine freie Person, die sich tatsächlich am Hauptquartier befindet.
- Eingesetzte Personen und ernannte Holzfäller werden dadurch nicht zwangsweise entfernt.
- Die aktuelle Bevölkerungszahl und die Zahl freier Personen werden sichtbar angezeigt.

Diese Steuerung ist kein späteres Spielsystem. Langfristig soll sich Bevölkerung durch normale Systeme wie Nachwuchs und Tod verändern können.

### Simulations- und Reservierungsregeln

- Bewegung wird pro Tick zuerst ausgeführt.
- Danach werden Ankünfte, Warenübergaben und Abholungen verarbeitet.
- Anschließend läuft Produktion.
- Danach verschwinden erschöpfte Wälder sofort und Holzfäller suchen neue Standorte.
- Erst danach werden neue Beschaffungsaufträge geplant.
- Eine Person kann in ihrer Ankunftsrunde bereits Ware übergeben beziehungsweise den ersten Arbeitsfortschritt erhalten.
- Neu geplante Wege beginnen erst in der folgenden Runde.
- Produktionsinputs bleiben bis zum Abschluss im Input-Inventar und werden dann verbraucht.
- Bei Freisetzung wird laufender Arbeitsfortschritt verworfen, vorhandene Inputs bleiben aber erhalten.
- Warenreservierungen und ein Seed im Weltzustand sorgen für reproduzierbare und konsistente Simulation.

### UI des PoC

Die Bedienung zeigt unter anderem:

- Runde, Bevölkerung, freie Personen und Werkzeugbestand im Lager.
- Globale +/- Steuerung für Holzfäller.
- Besetzung stationärer Arbeitsstätten.
- Inputs, Outputs, Produktionsstatus und Waldrestvorrat.
- Sichtbare Ressourcen-Slots direkt auf der Hex-Karte.
- Dynamische Waldkarten als Statusanzeige ohne eigene Arbeiter-Zuweisungsbuttons.
- Eine aufklappbare Personenliste mit Zuweisung, Holzfällerstatus, Wegen und Transportaufträgen.
- Manuellen Rundenschritt, Autolauf 1–10 FPS und Max-FPS-Toggle.

### Bauarbeiter als spätere Erweiterung

Bauarbeiter bilden einen getrennten Logistikfall. Sie sollen später Materialien aus einem globaleren Radius beschaffen und zu Baustellen bringen. Die genaue Zahl gleichzeitig erlaubter Bauarbeiter pro Baustelle ist noch offen.

### Noch nicht Teil des ersten Schritts

- Bauarbeiter und Baustellenlogistik
- Bedürfnisse wie Hunger und Schlaf
- Familien, Kinder und Wohnen
- natürliche Geburten und Todesfälle
- Kampf, Diplomatie und Handel
- Berufserfahrung und Freischaltungen
- freie Gebäudeplatzierung durch den Spieler
- allgemeines Einsammeln beliebiger Waren durch Lager-Träger
- unterschiedliche Bewegungskosten oder Boni durch Gelände

## Leitprinzip

Die Fachlogik soll so modelliert werden, dass Rohstoffarbeiter, Produktionsarbeiter, unterstützende Träger, Lager-Träger und spätere Bauarbeiter unterschiedliche Rollen mit eigenen Beschaffungsregeln haben können, ohne das grundlegende Graph-, Waren- und Bewegungssystem neu bauen zu müssen. Bevölkerung ist ein veränderlicher Weltzustand und keine feste Konstante.
