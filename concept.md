# Produktkonzept

## PoC 1: Produktionslogistik auf einem Graphen

Ziel des ersten Proof of Concept ist es, den Kern der personenbasierten Produktionslogistik zu testen. Die Welt wird zunächst als Graph aus Gebäude- und Wegknoten modelliert. Gebäude werden nicht direkt miteinander verbunden; Wege laufen über eigene Wegknoten.

### Zeit- und Bewegungsmodell

Der PoC läuft zunächst rundenbasiert.

- Jede Kante im Graphen hat die Länge 1.
- Jede Figur kann sich pro Runde um genau eine Kante bewegen.
- Wege werden über den kürzesten Weg im Graphen bestimmt, nicht über Luftlinie.
- Eine Produktion dauert immer 5 Runden, sobald alle benötigten Rohstoffe an der Arbeitsstätte vorhanden sind.

### Rohstoffquellen

Rohstoffquellen wie Wälder sind eigene Knoten im Graphen und produzieren Ressourcen nach demselben Zeitprinzip wie andere Produktionsstätten.

Für den PoC gilt:

- Ein Wald ist eine unerschöpfliche Quelle für Holz.
- Die Quelle ist mengenmäßig unendlich, erzeugt die Ware aber nicht sofort.
- Die Produktion von 1 Holz dauert 5 Runden.
- Produziertes Holz liegt anschließend an der Quelle und kann dort abgeholt werden.

Damit besitzen auch Primärressourcen eine Produktionsrate und sind nicht einfach jederzeit unbegrenzt verfügbar.

### Produktionsprinzip

Jede produktive Arbeitsstätte hat genau einen verantwortlichen Arbeiter. Der Arbeiter beschafft fehlende Rohstoffe selbst, bringt sie zu seiner Arbeitsstätte zurück und produziert dort die nächste Ware.

Für den PoC gilt ein einheitliches Rezeptprinzip:

- Für einen Produktionsvorgang werden immer 2 Einheiten Input verbraucht.
- Nach 5 Produktionsrunden entsteht 1 Einheit Output.

Beispiel:

- Wald produziert alle 5 Runden 1 Holz.
- Der Arbeiter des Sägewerks beschafft 2 Holz und produziert daraus 1 Brett.
- Der Arbeiter der Schreinerei beschafft 2 Bretter und produziert daraus 1 Holzwerkzeug.
- Produzierte Waren bleiben zunächst lokal an der jeweiligen Arbeitsstätte liegen.

Der Arbeiter sucht für einen fehlenden Rohstoff eine verfügbare Quelle und bewegt sich über den kürzesten Weg im Graphen dorthin und wieder zurück.

Für den ersten Stand wird angenommen, dass eine Figur pro Weg genau 1 Einheit Ware tragen kann. Diese Tragkapazität ist bewusst als einfache PoC-Regel gewählt und kann später erweitert werden.

### Träger an Produktionsstätten

Jeder Produktionsstätte können bis zu 2 Träger zugewiesen werden.

Träger sind keine globalen Warenkuriere, sondern unterstützen genau die Arbeitsstätte, der sie zugeordnet sind. Ihre einzige Aufgabe besteht darin, die von dieser Produktionsstätte benötigten Rohstoffe an verfügbaren Quellen abzuholen und zur Arbeitsstätte zu bringen.

Der verantwortliche Produktionsarbeiter bleibt trotzdem grundsätzlich selbst zur Rohstoffbeschaffung fähig. Träger dienen als Unterstützung, damit der Arbeiter häufiger an seiner Arbeitsstätte produzieren kann.

Für die erste Version gilt auch für Träger eine Tragkapazität von 1 Einheit pro Weg.

### Lager

Das Lager produziert keine Waren. Es sammelt fertige Waren aus Produktionsstätten ein.

Für den ersten PoC gilt:

- Dem Lager können bis zu 2 Träger zugewiesen werden.
- Diese Träger holen zunächst ausschließlich Holzwerkzeuge aus der Schreinerei ab und bringen sie zum Lager.
- Der Schreiner transportiert fertige Holzwerkzeuge nicht selbst zum Lager; der Output bleibt in der Schreinerei liegen, bis ein Lager-Träger ihn abholt.
- Die maximale Lagerkapazität ist noch nicht festgelegt.

Später sollen Lager-Träger nicht nur eine fest definierte Schreinerei bedienen, sondern geeignete Waren aus der Umgebung einsammeln können, solange das Lager noch Platz hat. Diese allgemeinere Sammellogik gehört noch nicht zum ersten Implementierungsschritt.

### Bauarbeiter als spätere Erweiterung

Bauarbeiter bilden einen davon getrennten Logistikfall. Wenn ein Gebäude gebaut werden soll, können Bauarbeiter aus einem globalen Pool Materialien über die gesamte Karte beschaffen und zur Baustelle bringen. Wie viele Bauarbeiter gleichzeitig an einem Gebäude arbeiten dürfen und wie diese Obergrenze bestimmt wird, ist noch offen.

Die Bauarbeiterfunktion gehört ausdrücklich nicht zum ersten Implementierungsschritt von PoC 1, soll aber in einem späteren PoC-Stand ergänzt werden.

### Noch nicht Teil des ersten Schritts

- Bauarbeiter und Baustellenlogistik
- allgemeine Lager-Sammellogik für Waren aus der Umgebung
- Bedürfnisse wie Hunger und Schlaf
- Familien, Kinder und Wohnen
- Kampf, Diplomatie und Handel
- Berufserfahrung und Freischaltungen
- freie Gebäudeplatzierung

## Leitprinzip

Die Fachlogik soll so modelliert werden, dass Rohstoffquellen, Produktionsarbeiter, unterstützende Träger, Lager-Träger und spätere Bauarbeiter unterschiedliche Rollen mit jeweils eigenen Produktions- und Beschaffungsregeln haben können, ohne das grundlegende Graph-, Waren- und Bewegungssystem neu bauen zu müssen.
