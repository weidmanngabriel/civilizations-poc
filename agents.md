## Entwicklungsprinzipien

Halte die Lösung möglichst klein und verständlich.

Bevorzuge einfache, etablierte Lösungen gegenüber komplexen Architekturen.

Treffe sinnvolle technische Entscheidungen selbstständig, solange sie die oben genannten Rahmenbedingungen einhalten.

Wenn eine konkrete Produktfunktion noch nicht definiert ist, erfinde keine umfangreiche Fachlogik. Schaffe stattdessen eine saubere Grundlage, auf der die eigentlichen Funktionen später aufgebaut werden können.

Interaktionen müssen immer für **Desktop und Touch gemeinsam** betrachtet werden. Wenn eine mobile Bedienung ergänzt oder geändert wird, muss geprüft werden, dass dieselbe Funktion am Desktop sinnvoll bedienbar bleibt; bei Desktop-Änderungen gilt das umgekehrt genauso. Eine Optimierung für eine Eingabeart darf die andere nicht stillschweigend verschlechtern. Unterschiede zwischen Maus/Tastatur und Touch sind ausdrücklich erlaubt, wenn sie zum jeweiligen Eingabemodell passen, müssen aber bewusst gestaltet und getestet werden.

`concept.md` und `architecture.md` sind bei jeder relevanten Änderung verbindlich zu beachten. Vor einer Implementierung muss geprüft werden, ob die geplante Änderung mit dem dort dokumentierten Produktkonzept und der bestehenden Architektur übereinstimmt.

Halte beide Dateien dauerhaft auf dem aktuellen Stand. Ergänze neue fachliche Funktionen in `concept.md` und wichtige technische bzw. architektonische Entscheidungen in `architecture.md`. Aktualisiere bestehende Aussagen, wenn sich Verhalten oder Aufbau ändern, und entferne Inhalte, die nicht mehr dem tatsächlichen Stand der Anwendung entsprechen.

Bei Änderungen an Player-Facing-Funktionen muss zusätzlich geprüft werden, ob das In-App-Handbuch unter `src/handbook/*.md` angepasst werden muss. Spielerrelevante Änderungen dort knapp, spielerzentriert und ohne interne Technikdetails oder unnötige Balancezahlen ergänzen. Das Handbuch soll erklären, wie sich die Spielwelt verhält und was der Spieler daraus ableiten kann, nicht die interne Simulation offenlegen.

Die Dokumentation soll so gepflegt werden, dass ein fähiger Agent die bestehende App und ihre wichtigsten Produkt- und Architekturentscheidungen schnell verstehen und im Zweifel von Grund auf neu implementieren könnte. Es geht vor allem um eine belastbare Highlevel-Übersicht, nicht um jedes Detail.

## Entwicklungsworkflow

Änderungen werden **direkt auf `main`** committed, damit sie sofort über die bestehende GitHub-Action gebaut und auf GitHub Pages veröffentlicht werden und der aktuelle Stand live getestet werden kann. Keine temporären Entwicklungsbranches oder PR-Zwischenschritte verwenden, sofern der Nutzer nicht ausdrücklich etwas anderes verlangt.

Nach Änderungen den Build-/Deploy-Status prüfen und konkrete Fehler direkt auf `main` nachbessern.

## Aktiver Umbauplan

Für den geplanten Umbau auf ein feineres räumliches Raster und physische Ressourcen gilt zusätzlich [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md).

Solange dieser Plan als aktiv markiert ist, muss er vor Änderungen an **Kartenmaßstab, Terrain, Gebäudegrößen oder -platzierung, Bewohnerdarstellung/-skalierung, natürlichen Ressourcen, losen Waren, Pathfinding, Wegen oder Ressourcenlogistik** gelesen und berücksichtigt werden. Auch Änderungen an angrenzenden Systemen sollen darauf geprüft werden, ob sie Annahmen schaffen, die dem geplanten Umbau entgegenstehen.

Der Plan wird nach jeder umgesetzten Phase aktualisiert, damit der aktuelle Stand und die nächsten Schritte auch in einem neuen Chat eindeutig nachvollziehbar bleiben.
