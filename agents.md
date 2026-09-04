## Entwicklungsprinzipien

Halte die Lösung möglichst klein und verständlich.

Bevorzuge einfache, etablierte Lösungen gegenüber komplexen Architekturen.

Treffe sinnvolle technische Entscheidungen selbstständig, solange sie die oben genannten Rahmenbedingungen einhalten.

Wenn eine konkrete Produktfunktion noch nicht definiert ist, erfinde keine umfangreiche Fachlogik. Schaffe stattdessen eine saubere Grundlage, auf der die eigentlichen Funktionen später aufgebaut werden können.

`concept.md` und `architecture.md` sind bei jeder relevanten Änderung verbindlich zu beachten. Vor einer Implementierung muss geprüft werden, ob die geplante Änderung mit dem dort dokumentierten Produktkonzept und der bestehenden Architektur übereinstimmt.

Halte beide Dateien dauerhaft auf dem aktuellen Stand. Ergänze neue fachliche Funktionen in `concept.md` und wichtige technische bzw. architektonische Entscheidungen in `architecture.md`. Aktualisiere bestehende Aussagen, wenn sich Verhalten oder Aufbau ändern, und entferne Inhalte, die nicht mehr dem tatsächlichen Stand der Anwendung entsprechen.

Die Dokumentation soll so gepflegt werden, dass ein fähiger Agent die bestehende App und ihre wichtigsten Produkt- und Architekturentscheidungen schnell verstehen und im Zweifel von Grund auf neu implementieren könnte. Es geht vor allem um eine belastbare Highlevel-Übersicht, nicht um jedes Detail.