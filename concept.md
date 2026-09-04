# Produktkonzept

## PoC 1: Produktionslogistik auf einem Graphen

Ziel des ersten Proof of Concept ist es, den Kern der personenbasierten Produktionslogistik zu testen. Die Welt wird zunächst als Graph aus Gebäude- und Wegknoten modelliert. Gebäude werden nicht direkt miteinander verbunden; Wege laufen über eigene Wegknoten.

### Zeit- und Bewegungsmodell

Der PoC läuft zunächst rundenbasiert.

- Jede Kante im Graphen hat die Länge 1.
- Jede Figur kann sich pro Runde um genau eine Kante bewegen.
- Wege werden über den kürzesten Weg im Graphen bestimmt, nicht über Luftlinie.
- Eine Produktion dauert immer 5 Runden, sobald alle benötigten Rohstoffe an der Arbeitsstätte vorhanden sind und ein zuständiger Arbeiter dort produzieren kann.

### Allgemeines Produktionsprinzip

Nichts produziert automatisch. Jede Produktion braucht mindestens einen zugewiesenen Arbeiter.

Für verarbeitende Arbeitsstätten gilt:

- Jede produktive Arbeitsstätte hat genau einen verantwortlichen Produktionsarbeiter.
- Der Produktionsarbeiter beschafft fehlende Rohstoffe selbst, bringt sie zur Arbeitsstätte zurück und produziert dort die nächste Ware.
- Jeder Produktionsstätte können zusätzlich bis zu 2 Träger zugewiesen werden, die ausschließlich Rohstoffe für diese Arbeitsstätte beschaffen.

Für den PoC gilt ein einheitliches Rezeptprinzip:

- Für einen Produktionsvorgang werden immer 2 Einheiten Input verbraucht.
- Nach 5 Produktionsrunden entsteht 1 Einheit Output.

Beispiel:

- Der Arbeiter des Sägewerks beschafft 2 Holz und produziert daraus 1 Brett.
- Der Arbeiter der Schreinerei beschafft 2 Bretter und produziert daraus 1 Holzwerkzeug.
- Produzierte Waren bleiben lokal an der jeweiligen Arbeitsstätte liegen, bis sie von einem zuständigen Abholer eingesammelt werden.

Der Arbeiter sucht für einen fehlenden Rohstoff eine verfügbare Quelle und bewegt sich über den kürzesten Weg im Graphen dorthin und wieder zurück.

Für den ersten Stand wird angenommen, dass eine Figur pro Weg genau 1 Einheit Ware tragen kann. Diese Tragkapazität ist bewusst als einfache PoC-Regel gewählt und kann später erweitert werden.

### Rohstoffquellen

Rohstoffquellen wie Wälder sind ebenfalls Arbeitsstätten und produzieren nicht automatisch.

Für den Wald gilt im PoC:

- Der Wald ist unerschöpflich.
- Im Wald können bis zu 2 Arbeiter gleichzeitig arbeiten.
- Jeder Arbeiter produziert nach 5 Runden genau 1 Holz.
- Produziertes Holz liegt anschließend im lokalen Inventar des Waldknotens.
- Ist das Inventar des Walds voll, kann dort nicht weiter produziert werden, bis wieder Platz frei ist.

Dass Rohstoffquellen mehrere Arbeiter haben können, unterscheidet sie in PoC 1 bewusst von verarbeitenden Arbeitsstätten mit genau einem Produktionsarbeiter.

### Träger an Produktionsstätten

Jeder Produktionsstätte können bis zu 2 Träger zugewiesen werden.

Träger sind keine globalen Warenkuriere, sondern unterstützen genau die Arbeitsstätte, der sie zugeordnet sind. Ihre einzige Aufgabe besteht darin, die von dieser Produktionsstätte benötigten Rohstoffe an verfügbaren Quellen abzuholen und zur Arbeitsstätte zu bringen.

Der verantwortliche Produktionsarbeiter bleibt trotzdem grundsätzlich selbst zur Rohstoffbeschaffung fähig. Träger dienen als Unterstützung, damit der Arbeiter häufiger an seiner Arbeitsstätte produzieren kann.

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

Für alle Gebäude- und Rohstoffknoten außer dem Lager gilt zunächst eine gemeinsame Gesamtkapazität von 10 Wareneinheiten.

- Inputs und Outputs teilen sich diese Kapazität.
- Sobald insgesamt 10 Einheiten im lokalen Inventar liegen, ist der Knoten voll.
- Ein voller Produktionsknoten kann keinen weiteren Output erzeugen, bis wieder Platz frei wird.
- Das Lager ist die einzige aktuelle Ausnahme und besitzt unbegrenzte Kapazität.

### Bauarbeiter als spätere Erweiterung

Bauarbeiter bilden einen davon getrennten Logistikfall. Wenn ein Gebäude gebaut werden soll, können Bauarbeiter aus einem globalen Pool Materialien über die gesamte Karte beschaffen und zur Baustelle bringen. Wie viele Bauarbeiter gleichzeitig an einem Gebäude arbeiten dürfen und wie diese Obergrenze bestimmt wird, ist noch offen.

Die Bauarbeiterfunktion gehört ausdrücklich nicht zum ersten Implementierungsschritt von PoC 1, soll aber in einem späteren PoC-Stand ergänzt werden.

### Noch nicht Teil des ersten Schritts

- Bauarbeiter und Baustellenlogistik
- Bedürfnisse wie Hunger und Schlaf
- Familien, Kinder und Wohnen
- Kampf, Diplomatie und Handel
- Berufserfahrung und Freischaltungen
- freie Gebäudeplatzierung
- allgemeines Einsammeln beliebiger Waren durch Lager-Träger

## Leitprinzip

Die Fachlogik soll so modelliert werden, dass Rohstoffarbeiter, Produktionsarbeiter, unterstützende Träger, Lager-Träger und spätere Bauarbeiter unterschiedliche Rollen mit jeweils eigenen Beschaffungsregeln haben können, ohne das grundlegende Graph-, Waren- und Bewegungssystem neu bauen zu müssen.
