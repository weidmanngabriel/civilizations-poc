# Domain

This file is the primary location for verified domain terms, domain rules, invariants, value ranges, and state transitions; code alone is not sufficient evidence for a domain rule.

## Palisaden

- Ein Palisadensegment belegt genau eine Mikrokachel und kostet 1 Holz.
- Ein Linienauftrag umfasst höchstens 50 Routenzellen. Bereits vorhandene Palisaden auf dieser Route zählen gegen dieses Limit. Wird das Ziel wegen des Limits oder wegen der Wegweiser-Abdeckung nicht erreicht, bleibt der gefundene Teilabschnitt gültig und baubar.
- Bereits vorhandene Palisaden blockieren ausschließlich die normale Bewohnerbewegung, nicht die Palisaden-Planungs-A*. Sie dürfen als Startpunkt, Zielpunkt oder Zwischenzelle eines neuen Linienauftrags verwendet werden.
- Auf einer bereits vorhandenen Palisadenzelle wird kein zweites Segment angelegt und kein Holz berechnet; Kosten und Baustellen entstehen nur für neue Segmente.
- Jede Palisadenzelle muss innerhalb des Orientierungradius mindestens eines platzierten Wegweisers liegen; wie bei Gebäudeplatzierung ist dafür keine Verbindung dieses Wegweisers zum übrigen Netz erforderlich.
- Der Palisaden-Baumodus zeigt die aktuell gültige Wegweiser-Bauregion bereits vor der Startwahl und weiterhin während der Zielwahl.
- Ein unfertiges Segment bleibt begehbar. Ein fertiges Segment blockiert Bewegung.
- Pro Palisadensegment darf höchstens ein Bauarbeiter zugewiesen sein.
- Nach vollständiger Materialanlieferung benötigt ein Palisadensegment genau eine Simulationssekunde Bauarbeit.
- Bauarbeiter und Materiallieferung bedienen Palisaden von einer erreichbaren Nachbarzelle; die Seite ist nicht festgelegt und kann je nach Erreichbarkeit wechseln.
- Die blaue Flagge an einer unfertigen Palisade ist eine abgeleitete Anzeige einer bestehenden Bauarbeiter-Zuweisung und kein eigener Simulationszustand.
