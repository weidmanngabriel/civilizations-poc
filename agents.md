## Entwicklungsprinzipien

Halte die Lösung möglichst klein und verständlich.

Bevorzuge einfache, etablierte Lösungen gegenüber komplexen Architekturen.

Treffe sinnvolle technische Entscheidungen selbstständig, solange sie die oben genannten Rahmenbedingungen einhalten.

Wenn eine konkrete Produktfunktion noch nicht definiert ist, erfinde keine umfangreiche Fachlogik. Schaffe stattdessen eine saubere Grundlage, auf der die eigentlichen Funktionen später aufgebaut werden können.

Bis Version 1 wird bewusst keine Rückwärtskompatibilität gepflegt, wenn dafür Migrationen, Kompatibilitäts-Defaults, parallele Legacy-Pfade oder zusätzliche Sonderfall-`if`s nötig wären. Der jeweils aktuelle Code-, Daten- und Schemastand ist verbindlich; ältere Saves, Exporte oder Zwischenstände dürfen bei Änderungen brechen.

Für jeden `BuildingKind` muss unter `src/assets/buildings/<key>/` ein Asset-Slot vorhanden sein. Dieser besteht aus `building.json` und einem Sprite (`sprite.png` oder bei bestehenden Assets `sprite.webp`). Solange ein Gebäudetyp noch keinen finalen Editor-Export besitzt, darf `building.json` als expliziter `placeholder` markiert sein und wird von der Runtime nicht registriert. Sobald ein echter Export eingespielt wird, muss derselbe Ordner weiterverwendet werden. Bei jedem neu eingeführten `BuildingKind` ist der gleichnamige Asset-Ordner im selben Run mit anzulegen; daraus darf kein separater manueller Nacharbeits-Schritt für den Nutzer entstehen.

Interaktionen müssen immer für **Desktop und Touch gemeinsam** betrachtet werden. Wenn eine mobile Bedienung ergänzt oder geändert wird, muss geprüft werden, dass dieselbe Funktion am Desktop sinnvoll bedienbar bleibt; bei Desktop-Änderungen gilt das umgekehrt genauso. Eine Optimierung für eine Eingabeart darf die andere nicht stillschweigend verschlechtern. Unterschiede zwischen Maus/Tastatur und Touch sind ausdrücklich erlaubt, wenn sie zum jeweiligen Eingabemodell passen, müssen aber bewusst gestaltet und getestet werden.

`concept.md` und `architecture.md` sind bei jeder relevanten Änderung verbindlich zu beachten. Vor einer Implementierung muss geprüft werden, ob die geplante Änderung mit dem dort dokumentierten Produktkonzept und der bestehenden Architektur übereinstimmt.

Halte beide Dateien dauerhaft auf dem aktuellen Stand. Ergänze neue fachliche Funktionen in `concept.md` und wichtige technische bzw. architektonische Entscheidungen in `architecture.md`. Aktualisiere bestehende Aussagen, wenn sich Verhalten oder Aufbau ändern, und entferne Inhalte, die nicht mehr dem tatsächlichen Stand der Anwendung entsprechen.

Bei Änderungen an Player-Facing-Funktionen muss zusätzlich geprüft werden, ob das In-App-Handbuch unter `src/handbook/*.md` angepasst werden muss. Spielerrelevante Änderungen dort knapp, spielerzentriert und ohne interne Technikdetails oder unnötige Balancezahlen ergänzen. Das Handbuch soll erklären, wie sich die Spielwelt verhält und was der Spieler daraus ableiten kann, nicht die interne Simulation offenlegen.

Die Dokumentation soll so gepflegt werden, dass ein fähiger Agent die bestehende App und ihre wichtigsten Produkt- und Architekturentscheidungen schnell verstehen und im Zweifel von Grund auf neu implementieren könnte. Es geht vor allem um eine belastbare Highlevel-Übersicht, nicht um jedes Detail.

## Entwicklungsworkflow

Änderungen werden während eines Runs auf einem **temporären Branch** umgesetzt. Zwischencommits auf diesem Branch sind erlaubt.

Am Ende des Runs werden alle Änderungen **per Squash auf `main` übernommen**, sodass für die jeweilige Anpassung genau ein aussagekräftiger Commit auf `main` verbleibt. Dadurch wird die bestehende GitHub-Action nur einmal für den finalen Stand ausgelöst.

Nach dem Squash-Merge den Build-/Deploy-Status prüfen und konkrete Fehler bei Bedarf erneut über einen temporären Branch beheben und anschließend wieder als einzelnen Squash-Commit auf `main` übernehmen.

## Räumliches Referenzmodell

Der Umbau auf ein feineres räumliches Raster und physische Ressourcen ist abgeschlossen und in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md) dokumentiert.

Vor Änderungen an **Kartenmaßstab, Terrain, Gebäudegrößen oder -platzierung, Bewohnerdarstellung/-skalierung, natürlichen Ressourcen, losen Waren, Pathfinding, Wegen oder Ressourcenlogistik** muss neben `architecture.md` und `concept.md` auch dieses Referenzdokument gelesen werden. Es enthält die abgeschlossenen Migrationsentscheidungen und die bewusst getrennten späteren Folgefragen.

Wird künftig erneut ein größerer Umbau dieser Systeme gestartet, soll dafür der bestehende Plan ausdrücklich wieder geöffnet oder ein neuer aktiver Plan angelegt werden.
