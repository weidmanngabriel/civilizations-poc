# Domain

This file is the primary location for verified domain terms, domain rules, invariants, value ranges, and state transitions; code alone is not sufficient evidence for a domain rule.

## Palisaden

- Ein Palisadensegment belegt genau eine Mikrokachel und kostet 1 Holz.
- Ein Linienauftrag umfasst höchstens 50 Segmente. Wird das Ziel wegen des Limits oder wegen der Wegweiser-Abdeckung nicht erreicht, bleibt der gefundene Teilabschnitt gültig und baubar.
- Jede Palisadenzelle muss innerhalb des Orientierungradius mindestens eines platzierten Wegweisers liegen; wie bei Gebäudeplatzierung ist dafür keine Verbindung dieses Wegweisers zum übrigen Netz erforderlich.
- Ein unfertiges Segment bleibt begehbar. Ein fertiges Segment blockiert Bewegung.
- Pro Palisadensegment darf höchstens ein Bauarbeiter zugewiesen sein.
- Nach vollständiger Materialanlieferung benötigt ein Palisadensegment genau eine Simulationssekunde Bauarbeit.
- Bauarbeiter und Materiallieferung bedienen Palisaden von einer erreichbaren Nachbarzelle; die Seite ist nicht festgelegt und kann je nach Erreichbarkeit wechseln.
- Die blaue Flagge an einer unfertigen Palisade ist eine abgeleitete Anzeige einer bestehenden Bauarbeiter-Zuweisung und kein eigener Simulationszustand.
