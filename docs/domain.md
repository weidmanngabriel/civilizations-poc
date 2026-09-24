# Domain

This file is the primary location for verified domain terms, domain rules, invariants, value ranges, and state transitions; code alone is not sufficient evidence for a domain rule.

## Strukturkategorien

- **Verwaltbare Gebäude** sind normale Gebäudeinstanzen, die in der Gebäudeübersicht erscheinen und gebäudebezogene Verwaltungs- oder Hinweisfunktionen besitzen können.
- **Infrastruktur** sind baubare statische Elemente, die Baukosten, Bauzeit, Bauarbeiter und Abriss mit Gebäuden teilen können, aber nicht als normale Gebäude verwaltet oder gezählt werden.
- Palisaden sind Infrastruktur.
- Ackerflächen bleiben eine eigene, gebäudeintern gespeicherte Domänenkategorie und sind weder verwaltbare Gebäude noch Infrastruktur.
- Künftige Tore und vergleichbare konstruierbare Elemente sollen die Infrastrukturkategorie erweitern. Wege gehören nur dann dazu, wenn sie als eigenständige konstruierbare Elemente statt als Terrain modelliert werden.

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


## Schule und Ausbildung

- Eine Schule kostet 4 Holz, 2 Backsteine, 2 Steinblöcke und 2 Dachziegel.
- Ein Unterricht verbindet genau einen Lehrer und einen Schüler mit genau einer fertigen Schule und einem Zielberuf.
- Ein Lehrer darf höchstens an einem aktiven Unterricht beteiligt sein.
- Unterricht beginnt nur bei Anwesenheit beider Beteiligten an der Schule und benötigt 60 simulierte Sekunden Anwesenheitszeit.
- Essen oder Schlafen unterbricht den Unterricht ohne Verlust des bisherigen Unterrichtsfortschritts.
- Während aktivem Unterricht gelten Hunger- und Schlafverbrauch wie bei normaler Arbeit.
- Erfolgreiche Ausbildung verleiht dem Schüler dauerhaft die Berechtigung zum Zielberuf, auch nach späteren Berufswechseln, aber keine praktische Erfahrung in diesem Beruf.
- Nach erfolgreichem Unterricht wird der Lehrer nach Möglichkeit zu seinem vorherigen Arbeitsplatz zurückgeführt.


## Viehzüchterei und Zucht

- Eine neue Zucht reserviert genau zwei ausgewachsene, zuchtfähige Tiere derselben Art.
- Der Viehzüchter holt beide Elterntiere nacheinander physisch ab; ein abgeholtes Tier folgt dem Viehzüchter bis zur Viehzüchterei.
- Die eigentliche Zuchtzeit beginnt erst, wenn beide reservierten Elterntiere die Viehzüchterei erreicht haben.
- Eine Zucht verbraucht 4 Weizen und 4 Wasser.
- Die eigentliche Zucht dauert 10 simulierte Sekunden.
- Nach Abschluss verlassen die beiden Elterntiere und das Jungtier das Gebäude wieder in Richtung der umliegenden Weide.

## Fischschwärme

- Jede zusammenhängende Wasserregion besitzt genau einen Fischschwarm.
- Ein Fischschwarm hat eine maximale Kapazität von 15 Fischen.
- Ein erfolgreicher Angelversuch reduziert den Bestand des zugehörigen Schwarms um genau 1.
- Ein Schwarm mit Bestand 0 bleibt bestehen und kann sich wieder erholen; er liefert bis dahin keinen erfolgreichen Fang.
- Solange der Bestand unter der Kapazität liegt, wächst er alle 60 simulierten Sekunden um genau 1 Fisch.
- Die visuelle Position eines Schwarms innerhalb seiner Region beeinflusst die Angelbarkeit nicht.
- Bei Beständen von 3, 2 oder 1 werden exakt 3, 2 oder 1 sichtbare Fische dargestellt; bei 0 keiner.

