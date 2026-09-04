# Produktkonzept

## PoC 1: Produktionslogistik auf einem Graphen

Ziel des ersten Proof of Concept ist es, den Kern der personenbasierten Produktionslogistik zu testen. Die Welt wird zunächst als Graph aus Gebäude- und Wegknoten modelliert. Gebäude werden nicht direkt miteinander verbunden; Wege laufen über eigene Wegknoten. Kanten besitzen Längen, und Bewegungen verwenden den kürzesten Weg entlang des Graphen.

### Produktionsprinzip

Jede produktive Arbeitsstätte hat genau einen verantwortlichen Arbeiter. Der Arbeiter beschafft die benötigten Rohstoffe selbst, bringt sie zu seiner Arbeitsstätte zurück und produziert dort die nächste Ware.

Beispiel:

- Wald erzeugt Holz als Quelle.
- Ein Arbeiter des Sägewerks beschafft Holz und produziert daraus Bretter.
- Ein Arbeiter der Schreinerei beschafft Bretter und produziert daraus Holzwerkzeug.
- Produzierte Waren liegen lokal an der jeweiligen Arbeitsstätte bzw. später im Lager.

Der Arbeiter sucht für einen fehlenden Rohstoff eine verfügbare Quelle und bewegt sich über den kürzesten Weg im Graphen dorthin und wieder zurück.

### Träger

Träger sind im Endziel keine globalen, frei verfügbaren Warenkuriere. Sie unterstützen konkrete Arbeitsstätten bei der Rohstoffbeschaffung. Diese Unterstützungsmechanik ist für einen späteren Ausbau vorgesehen und noch nicht Teil des ersten Implementierungsschritts.

### Bauarbeiter als spätere Erweiterung

Bauarbeiter bilden einen davon getrennten Logistikfall. Wenn ein Gebäude gebaut werden soll, können Bauarbeiter aus einem globalen Pool Materialien über die gesamte Karte beschaffen und zur Baustelle bringen. Wie viele Bauarbeiter gleichzeitig an einem Gebäude arbeiten dürfen und wie diese Obergrenze bestimmt wird, ist noch offen.

Die Bauarbeiterfunktion gehört ausdrücklich nicht zum ersten Implementierungsschritt von PoC 1, soll aber in einem späteren PoC-Stand ergänzt werden.

### Noch nicht Teil des ersten Schritts

- Träger als Unterstützung von Arbeitsstätten
- Bauarbeiter und Baustellenlogistik
- Bedürfnisse wie Hunger und Schlaf
- Familien, Kinder und Wohnen
- Kampf, Diplomatie und Handel
- Berufserfahrung und Freischaltungen
- freie Gebäudeplatzierung

## Leitprinzip

Die Fachlogik soll so modelliert werden, dass Produktionsarbeiter, unterstützende Träger und spätere Bauarbeiter unterschiedliche Rollen mit jeweils eigenen Beschaffungsregeln haben können, ohne das grundlegende Graph-, Waren- und Bewegungssystem neu bauen zu müssen.
