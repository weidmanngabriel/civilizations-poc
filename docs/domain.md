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

## Building progression invariants

- A building unlocks only after all of its current unlock prerequisites have been satisfied. Prerequisites may come from the required production chain and from resident qualification or profession experience.
- Building unlocks are permanent progression. Once a building has been unlocked, later loss of a prerequisite production building or qualified resident never revokes that unlock.
- If a building type has multiple construction or upgrade levels, each level is unlocked separately.
- Each level evaluates its own prerequisites. Unlocking one level never implicitly unlocks later levels unless their prerequisites are also satisfied.

## Housing invariants

- A completed residential building has a level from 1 through 5 and therefore 2 through 6 apartments.
- One apartment can be occupied by at most one household.
- One household occupies exactly one apartment in exactly one residential building.
- One person belongs to at most one household.
- Household membership, not a direct building reference on the person, is the authoritative source for a person's home.
- Household size does not consume additional apartments. Children remain members of their parents' household without extra housing capacity.
- Assigning a home to an already housed person moves the existing household as a unit.
- A residential upgrade does not grant its additional apartment until the upgrade construction is complete.
- Direct construction of residential level N costs the sum of level costs 1 through N; an upgrade costs only the target level's increment.
- Residential level 1 requires a completed farm. Higher levels additionally require the production buildings for every processed construction material in their cumulative direct-build cost.
- Residential level unlocks are permanent world progression. Removing a prerequisite production building never revokes an already unlocked residential level.
- An unhoused person is a valid simulation state.
- When the later age system makes a child an adult, that person leaves the parental household and is not assigned a new apartment automatically.

## Family invariants

- Sex does not change profession, work, need or equipment rules.
- A marriage relation is symmetric: if A has spouse B, B has spouse A.
- A person can have at most one spouse.
- Children and parents cannot marry each other; siblings sharing a parent cannot marry each other.
- Partner candidates are reserved while an active searcher travels to them.
- Marriage never creates an apartment. It only merges existing household state when housing exists.
- Married adults with one existing household share it; two existing households collapse to one randomly retained apartment.
- Only married opposite-sex adults in the same household are eligible for the current biological birth system.
- One birth creates 1/2/3 children at 90/9/1 percent probabilities.
- Children remain in the parents' household without consuming another apartment.
- Children have no hunger, sleep, profession, work assignment or player movement commands.
- Childhood lasts five simulated minutes; the visual stage switches from baby to child halfway through.
- Adult transition removes the child from the parental household and never assigns a replacement apartment automatically.
- Birth policy is always one of low/medium/high; there is deliberately no disabled option.
- Active family tasks yield to hunger and sleep. The family task remains authoritative and resumes after the need is fulfilled.

