# Produktkonzept

## PoC 1: Produktionslogistik auf einem Graphen

Ziel des ersten Proof of Concept ist es, den Kern der personenbasierten Produktionslogistik zu testen. Die Welt wird zunächst als Graph aus Gebäude- und Wegknoten modelliert. Gebäude werden nicht direkt miteinander verbunden; Wege laufen über eigene Wegknoten.

### Kartenstruktur

Die sichtbare Karte basiert im PoC auf einem Hex-Grid.

- Jede Kartenkachel ist ein Hexfeld.
- Jedes Gebäude belegt genau ein Hexfeld.
- Gebäude werden nicht direkt miteinander verbunden; zwischen Gebäuden liegen begehbare Wegkacheln.
- Wegkacheln, Waldkacheln und Gebäudekacheln sind begehbar.
- Wiesen sind zunächst nicht begehbar.
- Berge und Flüsse sind ebenfalls nicht begehbar und dienen zunächst nur als Hindernisse bzw. zur optischen Auflockerung.
- Geländearten besitzen zunächst keine unterschiedlichen Bewegungskosten oder Boni; Wald ist bewegungstechnisch einem Weg gleichgestellt.
- Die erste Karte ist fest vorgegeben; freie Gebäudeplatzierung durch den Spieler gehört noch nicht zum PoC.

Die aktuelle Startkarte umfasst **21 × 13 Hexfelder**. Sie enthält Hauptquartier, einen anfangs aktiven Wald, Sägewerk, Schreinerei und Lager sowie Wiesen-, Berg-, Fluss-, Weg- und weitere Waldkacheln. Die zusätzlichen Waldkacheln sind in mehreren kleinen Gruppen über die Karte verteilt, statt einen einzelnen großen Waldblock zu bilden. Sie sind bereits begehbar, aber zunächst noch keine aktiven Wald-Arbeitsstätten.

Die Gebäude bleiben jeweils genau ein Hexfeld groß, liegen aber bewusst deutlich weiter auseinander. Das Straßennetz verwendet längere, teilweise verzweigte Wege und Umwege, damit Transportzeit und Bewegung im laufenden Wirtschaftskreislauf sichtbar und relevant werden.

### Zeit- und Bewegungsmodell

Der PoC läuft zunächst rundenbasiert.

- Jede Kante im Graphen hat die Länge 1.
- Jede Figur kann sich pro Runde um genau eine Kante bewegen.
- Wege werden über den kürzesten Weg im Graphen bestimmt, nicht über Luftlinie.
- Waldkacheln dürfen beim Pathfinding genauso betreten und durchquert werden wie Wegkacheln.
- Eine Produktion dauert immer 5 Runden, sobald alle benötigten Rohstoffe an der Arbeitsstätte vorhanden sind und ein zuständiger Arbeiter dort produzieren kann.
- Runden können weiterhin einzeln ausgelöst oder optional automatisch abgespielt werden.
- Beim Autolauf stellt der Spieler die Geschwindigkeit mit einem Regler von **1 bis 10 FPS** ein. Im PoC bedeutet 1 FPS genau eine reguläre Simulationsrunde pro realer Sekunde und 10 FPS entsprechend zehn Runden pro Sekunde. Die Einstellung verändert nur den zeitlichen Abstand zwischen bestehenden `tick()`-Schritten und nicht die Simulationsregeln.

### Allgemeines Produktionsprinzip

Nichts produziert automatisch. Jede Produktion braucht mindestens einen zugewiesenen Arbeiter.

Für verarbeitende Arbeitsstätten gilt:

- Jede produktive Arbeitsstätte hat genau einen verantwortlichen Produktionsarbeiter.
- Der Produktionsarbeiter beschafft Rohstoffe selbst, bringt sie zur Arbeitsstätte zurück und produziert dort die nächste Ware.
- Produktion hat für den Produktionsarbeiter Vorrang: Sind mindestens die benötigten Rezeptinputs vorhanden und ist im Output noch Platz, produziert er direkt weiter und startet keinen zusätzlichen Beschaffungsgang.
- Solange Produktion gerade nicht möglich ist und noch Input-Slots frei sind, beschafft der Produktionsarbeiter weiter passende Rohstoffe. Das gilt insbesondere bei zu wenig Input oder vollem Output.
- Jeder Produktionsstätte können zusätzlich bis zu 2 Träger zugewiesen werden, die ausschließlich Rohstoffe für diese Arbeitsstätte beschaffen.

Für den PoC gilt ein einheitliches Rezeptprinzip:

- Für einen Produktionsvorgang werden immer 2 Einheiten Input verbraucht.
- Nach 5 Produktionsrunden entsteht 1 Einheit Output.

Beispiel:

- Der Arbeiter des Sägewerks beschafft 2 Holz und produziert daraus 1 Brett.
- Der Arbeiter der Schreinerei beschafft 2 Bretter und produziert daraus 1 Holzwerkzeug.
- Produzierte Waren bleiben lokal an der jeweiligen Arbeitsstätte liegen, bis sie von einem zuständigen Abholer eingesammelt werden.

Der Arbeiter sucht für einen Rohstoff eine verfügbare Quelle und bewegt sich über den kürzesten Weg im Graphen dorthin und wieder zurück.

Für den ersten Stand wird angenommen, dass eine Figur pro Weg genau 1 Einheit Ware tragen kann. Diese Tragkapazität ist bewusst als einfache PoC-Regel gewählt und kann später erweitert werden.

### Rohstoffquellen und wandernde Waldarbeit

Rohstoffquellen wie Wälder sind ebenfalls Arbeitsstätten und produzieren nicht automatisch.

Für jeden aktiven Waldstandort gilt im PoC:

- Ein neu aktiver Wald besitzt einen festen Holzvorrat von **10 Einheiten**.
- Im Wald können bis zu 2 Arbeiter gleichzeitig arbeiten.
- Jeder Arbeiter produziert nach 5 Runden genau 1 Holz.
- Jede produzierte Holzeinheit reduziert den noch abbaubaren Vorrat des Standorts um 1.
- Mehrere Waldarbeiter dürfen gemeinsam niemals mehr als die insgesamt 10 verfügbaren Einheiten produzieren.
- Produziertes Holz liegt anschließend im lokalen Output-Inventar des Waldstandorts.
- Ist das Output-Inventar des Walds voll, kann dort nicht weiter produziert werden, bis wieder Platz frei ist.
- Sobald der zehnte Holzvorrat produziert wurde, ist der Standort erschöpft und erzeugt kein weiteres Holz.

Sobald ein Wald erschöpft ist, wechseln seine Arbeiter automatisch den Standort:

- Jeder Waldarbeiter sucht **unabhängig** nach den nächstgelegenen noch nicht aktiven Waldkacheln.
- Die Entfernung wird vom erschöpften Waldstandort über den normalen begehbaren Graphen gemessen.
- Gibt es mehrere gleich weit entfernte Waldkacheln, wählt jeder Arbeiter zufällig eine davon.
- Dadurch können sich zwei bisher gemeinsam arbeitende Waldarbeiter auf verschiedene neue Waldstandorte aufteilen oder denselben neuen Standort wählen.
- Pro neuem Waldstandort dürfen weiterhin höchstens 2 Waldarbeiter arbeiten.
- Die gewählte Waldkachel wird zu einem neuen aktiven Waldgebäude mit erneut 10 Einheiten Holzvorrat.
- Der Arbeiter läuft regulär über das Wegenetz bzw. begehbare Waldkacheln zum neuen Standort; es gibt keine Teleportation.

Der Zufall bei gleich weit entfernten Waldkacheln soll reproduzierbar bleiben, damit Simulation und Tests deterministisch wiederholbar sind. Die konkrete Implementierung darf daher einen Seed im Weltzustand verwenden, statt unkontrolliert globale Zufallswerte zu verwenden.

Der erschöpfte alte Wald bleibt zunächst als Restholzquelle bestehen:

- Bereits produziertes Holz bleibt dort vollständig verfügbar und kann von Trägern weiterhin abgeholt werden.
- Die Waldarbeiter dürfen bereits an neuen Standorten arbeiten, während am alten Standort noch Restholz liegt.
- Sobald am alten Standort kein Holz mehr gelagert ist, verschwindet das alte Waldgebäude und seine Kachel wird zu einer normalen Wegkachel. Bereits abgeholtes Holz darf zu diesem Zeitpunkt noch unterwegs sein.
- Falls ein bereits abgeholter Transport per Debug-Zuweisung abgebrochen und das Holz an die Quelle zurückgebucht wird, erscheint der erschöpfte Wald vorübergehend wieder als Restholzquelle, bis auch dieses Holz erneut abgeholt wurde.

Dass Rohstoffquellen mehrere Arbeiter haben können und ihre Arbeitsstätte im Lauf der Simulation wechseln kann, unterscheidet sie bewusst von den stationären verarbeitenden Arbeitsstätten.

### Träger an Produktionsstätten

Jeder Produktionsstätte können bis zu 2 Träger zugewiesen werden.

Träger sind keine globalen Warenkuriere, sondern unterstützen genau die Arbeitsstätte, der sie zugeordnet sind. Ihre einzige Aufgabe besteht darin, die von dieser Produktionsstätte benötigten Rohstoffe an verfügbaren Quellen abzuholen und zur Arbeitsstätte zu bringen.

Der verantwortliche Produktionsarbeiter bleibt selbst zur Rohstoffbeschaffung fähig, priorisiert aber immer mögliche Produktion. Nur wenn er gerade nicht produzieren kann, nutzt er freie Input-Kapazität ebenfalls für Nachschub. Träger dienen als Unterstützung, damit der Arbeiter häufiger an seiner Arbeitsstätte produzieren kann.

Für die erste Version gilt auch für Träger eine Tragkapazität von 1 Einheit pro Weg.

### Lager

Das Lager ist keine Produktionsstätte. Es sammelt fertige Waren ein.

Für PoC 1 gilt:

- Das Lager kann bis zu 2 Träger haben.
- Diese Lager-Träger sammeln zunächst ausschließlich Holzwerkzeuge aus der Schreinerei ein und bringen sie zum Lager.
- Der Schreiner bringt fertige Holzwerkzeuge nicht selbst zum Lager.
- Später sollen Lager-Träger allgemein geeignete Waren aus der Umgebung einsammeln können.
- Das Lager besitzt im PoC keine Kapazitätsgrenze.
- Eingelagerte Waren verschwinden nicht, sondern werden dauerhaft als Bestand mitgezählt.

### Inventarkapazitäten

Für alle Gebäude- und Rohstoffknoten außer dem Lager gelten getrennte Kapazitäten für Input und Output.

- Das Input-Inventar kann maximal 10 Einheiten aufnehmen.
- Das Output-Inventar kann maximal 3 Einheiten aufnehmen.
- Inputs und Outputs teilen sich keine gemeinsame Kapazität.
- Ein Produktionsvorgang startet nur, wenn im Output-Inventar noch Platz für den entstehenden Output vorhanden ist.
- Ein voller Output verhindert weitere Produktion, bis Output abgeholt wurde, verhindert aber nicht das weitere Auffüllen freier Input-Slots durch Arbeiter oder Träger.
- Das Lager ist die einzige aktuelle Ausnahme und besitzt unbegrenzte Kapazität.
- Auf der Karte werden die begrenzten Input- und Output-Kapazitäten als feste Ressourcen-Slots direkt an der jeweiligen Produktionsstätte dargestellt. Vorhandene Waren füllen diese Slots sichtbar; nach Abholung oder Verbrauch werden sie wieder leer. Reservierte, aber noch nicht physisch vorhandene Waren füllen keinen Slot.
- Für das unbegrenzte Lager werden keine Kapazitäts-Slots dargestellt, damit keine künstliche Obergrenze suggeriert wird.

### Arbeitskräfte und Hauptquartier

Der PoC besitzt eine aktuelle Bevölkerung, die auf Arbeitsstätten verteilt werden kann. Das erste Szenario startet standardmäßig mit 8 Personen. Diese Zahl ist kein dauerhaftes Bevölkerungslimit, sondern nur ein konfigurierbarer Startwert.

Das Hauptquartier dient als Sammelpunkt für freie Personen.

- Freie Personen haben keine Arbeitsstätte zugewiesen und bewegen sich zum Hauptquartier.
- Wird eine Person an einer Arbeitsstätte freigesetzt, endet ihre Zuweisung sofort und sie läuft vom aktuellen Ort zum Hauptquartier.
- Wird eine freie Person bereits unterwegs zum Hauptquartier einer neuen Arbeitsstätte zugewiesen, läuft sie direkt von ihrer aktuellen Position zur neuen Arbeitsstätte weiter.
- Eine zugewiesene Person zählt erst dann als aktiver Arbeiter oder Träger der Ziel-Arbeitsstätte, wenn sie dort angekommen ist.
- Personen werden nie zwischen Arbeitsstätten teleportiert; jeder Wechsel benötigt die reguläre Bewegung über den Graphen.

Für Arbeitsstätten gibt es eine einfache Einstellung der gewünschten Besetzung. Der Spieler kann die Zahl der zugewiesenen Arbeiter bzw. Träger innerhalb der jeweiligen Obergrenze erhöhen oder reduzieren. Eine Erhöhung verwendet freie Personen aus dem globalen Pool; eine Reduktion setzt entsprechende Personen frei.

Für PoC 1 gelten damit insbesondere:

- Aktiver Wald: 0 bis 2 Produktionsarbeiter.
- Sägewerk: 0 bis 1 Produktionsarbeiter und 0 bis 2 Träger.
- Schreinerei: 0 bis 1 Produktionsarbeiter und 0 bis 2 Träger.
- Lager: 0 Produktionsarbeiter und 0 bis 2 Lager-Träger.

### Bevölkerung im laufenden PoC

Unter dem Spiel gibt es eine einfache Debug-Steuerung für die aktuelle Bevölkerung. Damit kann die Personenzahl während des laufenden Spiels erhöht oder reduziert werden.

- `+1` erzeugt eine neue freie Person am Hauptquartier.
- `-1` entfernt eine freie Person am Hauptquartier.
- Sind keine freien Personen am Hauptquartier verfügbar, wird durch `-1` keine bereits eingesetzte oder noch laufende Person zwangsweise entfernt.
- Die aktuelle Bevölkerungszahl wird sichtbar angezeigt.
- Der Startwert von 8 Personen soll einfach konfigurierbar bleiben.

Diese Steuerung ist ausdrücklich ein PoC-/Debug-Werkzeug und bildet keine spätere Spielmechanik ab. Langfristig soll sich die Bevölkerung durch normale Spielsysteme verändern können, insbesondere durch Nachwuchs und Tod. Deshalb darf die Architektur nicht von einer konstanten oder festen maximalen Bevölkerungszahl ausgehen.

### Bauarbeiter als spätere Erweiterung

Bauarbeiter bilden einen davon getrennten Logistikfall. Wenn ein Gebäude gebaut werden soll, können Bauarbeiter aus einem globalen Pool Materialien über die gesamte Karte beschaffen und zur Baustelle bringen. Wie viele Bauarbeiter gleichzeitig an einem Gebäude arbeiten dürfen und wie diese Obergrenze bestimmt wird, ist noch offen.

Die Bauarbeiterfunktion gehört ausdrücklich nicht zum ersten Implementierungsschritt von PoC 1, soll aber in einem späteren PoC-Stand ergänzt werden.

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

Die Fachlogik soll so modelliert werden, dass Rohstoffarbeiter, Produktionsarbeiter, unterstützende Träger, Lager-Träger und spätere Bauarbeiter unterschiedliche Rollen mit jeweils eigenen Beschaffungsregeln haben können, ohne das grundlegende Graph-, Waren- und Bewegungssystem neu bauen zu müssen. Bevölkerung ist ein veränderlicher Weltzustand und keine feste Konstante.

## Konkretisierungen der PoC-Implementierung

- Alle acht Personen starten frei; die Besetzung wird vom Spieler eingestellt.
- Bei gleichen Entfernungen entscheidet bei normalen Warenquellen weiterhin die feste Reihenfolge der Gebäude. Zuweisungen verwenden die erste freie Person; Reduktionen lösen die zuletzt zugewiesene passende Person.
- Für die Standortwahl erschöpfter Waldarbeiter gilt davon abweichend: Nur die kürzeste erreichbare Distanz zählt; bei mehreren gleich weit entfernten Waldkacheln wird pro Arbeiter pseudozufällig gewählt. Ein Seed im Weltzustand hält Replays deterministisch.
- Passive Waldkacheln sind von Anfang an begehbar. Wird eine davon als neuer Waldstandort gewählt, wird sie zu einer aktiven Wald-Arbeitsstätte mit 10 Holz Vorrat. Sobald ein erschöpfter alter Wald lokal kein Holz mehr lagert, wird seine Kachel zu einem Weg; bereits abgeholte Transporte dürfen weiterlaufen. Wird solches Holz durch einen abgebrochenen Transport zurückgebucht, wird die Restholzquelle wieder sichtbar.
- Ein Abholauftrag reserviert eine vorhandene Wareneinheit und einen Input-Platz am Ziel. Träger füllen den Input bis zur Kapazitätsgrenze auf. Produktionsarbeiter tun dies nur dann ebenfalls, wenn sie gerade nicht produzieren können; mögliche Produktion hat Vorrang. Bereits eingehende Lieferungen zählen gegen die freien Slots.
- Während eines Transports bleibt der ursprüngliche Output-Platz bis zur Ablieferung reserviert. Bei Freisetzung wird eine bereits getragene Ware sofort in diesen Platz an der Quelle zurückgebucht. Die Person läuft von ihrer aktuellen Position zum HQ. Diese vereinfachte Rückbuchung betrifft nur Waren, niemals Personen.
- Produktionsinputs bleiben bis zum Abschluss im Input-Inventar gebunden und werden dann verbraucht. Bei Freisetzung wird der Arbeitsfortschritt verworfen; die Inputs bleiben erhalten. Ein laufender Produktionsvorgang reserviert einen Output-Platz, damit auch zwei Waldarbeiter die Kapazität gemeinsam einhalten. Laufende Waldproduktionen reservieren zusätzlich implizit den verbleibenden endlichen Holzvorrat, damit zwei Arbeiter zusammen nie über 10 Holz hinaus produzieren.
- Bewegung erfolgt zuerst. Eine Person kann in ihrer Ankunftsrunde Waren übergeben und einen Arbeitsfortschritt erhalten. Neu geplante Wege beginnen erst in der folgenden Runde.
- „Aktiv“ bedeutet: Die zugewiesene Person ist erstmals an ihrer Arbeitsstätte angekommen. Anschließende Beschaffungsgänge oder automatische Waldwechsel gehören weiterhin zu dieser aktiven Arbeitslogik.
- Die Bedienung zeigt Runde, freie und gesamte Bevölkerung, Lagerbestand, Besetzung, Inputs, Outputs, Waldrestvorrat und Produktionsstatus. Eine aufklappbare Personenliste zeigt Zuweisungen, Wege und Transportaufträge.
- Zusätzlich kann der Spieler den bestehenden Rundenschritt automatisch mit **1 bis 10 FPS** ausführen lassen und jederzeit pausieren; der manuelle Rundenschritt bleibt parallel verfügbar.
- Begrenzte Inventare werden auf der Hex-Karte zusätzlich als leere bzw. gefüllte Slots visualisiert. Die numerischen Bestände in den Arbeitsstätten-Karten bleiben als genaue Debug-Anzeige bestehen.
