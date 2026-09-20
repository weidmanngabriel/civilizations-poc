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

Bei Änderungen an Player-Facing-Funktionen muss zusätzlich geprüft werden, ob das In-App-Handbuch unter `src/handbook/*.md` angepasst werden muss.

Bei **jedem neu eingeführten Beruf (`Profession`)** muss ausdrücklich die vollständige Integration geprüft werden. Dazu gehören mindestens Typ/Union, Berufsbezeichnung und Icon, Erfahrungs-/Freischaltregeln, `currentProfession`, `workerProfession`, die Zuordnung zu Gebäudeberufen in `personCommands.ts` (einschließlich `BUILDING_PROFESSIONS` und Arbeitsplatz-Kompatibilität), Personen-/Gebäude-UI sowie ein Regressionstest, der bei Gebäudeberufen den kompletten Pfad **Beruf setzen → gültigen Arbeitsplatz finden → Arbeitsplatz zuweisen** abdeckt. Ein erfolgreicher TypeScript-Build allein genügt dafür nicht, weil nicht alle Berufs-Mappings als exhaustive `Record` modelliert sind. Spielerrelevante Änderungen dort knapp, spielerzentriert und ohne interne Technikdetails oder unnötige Balancezahlen ergänzen. Das Handbuch soll erklären, wie sich die Spielwelt verhält und was der Spieler daraus ableiten kann, nicht die interne Simulation offenlegen.

Die Dokumentation soll so gepflegt werden, dass ein fähiger Agent die bestehende App und ihre wichtigsten Produkt- und Architekturentscheidungen schnell verstehen und im Zweifel von Grund auf neu implementieren könnte. Es geht vor allem um eine belastbare Highlevel-Übersicht, nicht um jedes Detail.

## Entwicklungsworkflow

Änderungen werden während eines Runs auf einem **temporären Branch** umgesetzt. Zwischencommits auf diesem Branch sind erlaubt.

Vor dem Merge wird ein Pull Request gegen `main` erstellt. Pull-Request-Updates führen automatisch nur `npm test` aus. Dadurch können Zwischenstände und insbesondere Testoptimierungen schnell geprüft werden, ohne bei jedem Commit zusätzlich den Produktions-Build auszuführen. Der Workflow kann außerdem manuell mit der Validierungsstufe `test` gestartet werden, wenn bewusst nur die Tests benötigt werden.

**Unmittelbar vor jedem Squash-Merge muss auf dem finalen PR-Head eine vollständige Validierung erfolgreich gelaufen sein.** Dazu wird derselbe Workflow entweder manuell mit der Validierungsstufe `full` gestartet oder der Pull Request geschlossen und wieder geöffnet; ein `reopened`-Lauf ist ausdrücklich als Full-Validation-Trigger definiert. Dieser Lauf muss sowohl `npm test` als auch `npm run build` erfolgreich abschließen. Nach diesem Full-Validation-Lauf dürfen vor dem Merge keine weiteren Commits mehr auf den Branch gelangen. Der Agent muss deshalb prüfen, dass der erfolgreich validierte Commit-SHA exakt dem zu mergenden PR-Head entspricht.

Am Ende des Runs werden alle Änderungen **per Squash auf `main` übernommen**, sodass für die jeweilige Anpassung genau ein aussagekräftiger Commit auf `main` verbleibt.

Der Push auf `main` startet Tests und Build erneut. Nur wenn beide erfolgreich sind, wird GitHub Pages deployt. Manuelle Workflow-Läufe deployen grundsätzlich nicht. Nach dem Squash-Merge den Build-/Deploy-Status prüfen. Konkrete Fehler werden bei Bedarf wieder auf einem neuen temporären Branch behoben und anschließend erneut als einzelner Squash-Commit auf `main` übernommen.

## Räumliches Referenzmodell

Der Umbau auf ein feineres räumliches Raster und physische Ressourcen ist abgeschlossen und in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md) dokumentiert.

Vor Änderungen an **Kartenmaßstab, Terrain, Gebäudegrößen oder -platzierung, Bewohnerdarstellung/-skalierung, natürlichen Ressourcen, losen Waren, Pathfinding, Wegen oder Ressourcenlogistik** muss neben `architecture.md` und `concept.md` auch dieses Referenzdokument gelesen werden. Es enthält die abgeschlossenen Migrationsentscheidungen und die bewusst getrennten späteren Folgefragen.

Wird künftig erneut ein größerer Umbau dieser Systeme gestartet, soll dafür der bestehende Plan ausdrücklich wieder geöffnet oder ein neuer aktiver Plan angelegt werden.
