# Produktkonzept

Diese Datei ist der aktuelle Einstieg in das Produktkonzept. Ausführliche unveränderte Regeln bleiben in [`concept-detail.md`](./concept-detail.md) dokumentiert. Bei Widersprüchen beschreibt diese Datei den neueren Stand.

Der abgeschlossene Umbau auf das feine Raster und physische Ressourcen ist in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md) dokumentiert.

## PoC 1: personenbasierte Produktionslogistik

Ziel bleibt eine personenbasierte Produktions- und Logistiksimulation auf einem Hex-Grid. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte und räumliche Planung wirkt direkt auf Produktion, Versorgung und Transport. Hunger und Schlaf konkurrieren mit Arbeit um die Zeit einzelner Personen.

## Feineres Raumraster

Die Welt verwendet intern ein **5× feineres Raster pro Raumachse**: aus 41 × 25 werden 205 × 125 Mikrozellen. Die sichtbare Kartengröße bleibt ungefähr gleich. Gebäude und Äcker belegen viele Mikrozellen; Bewohner bewegen sich flüssig und bleiben visuell lesbar.

## Untergrund, Ressourcen und Waren

Terrain beschreibt nur den Untergrund. Bäume, Lehm, Stein und spätere natürliche Ressourcen sind eigenständige Weltobjekte. Wald entsteht durch viele einzelne Bäume, nicht durch einen besonderen Bodentyp.

Aktueller verbindlicher Stand:

- **Baum:** 1 Mikrozelle, blockierend, 3 Holz.
- **Busch:** 1 Mikrozelle, nicht blockierend.
- **Pilze:** 1 Mikrozelle, nicht blockierend.
- **Lehm:** 4 kompakte Mikrozellen, nicht blockierend.
- **Stein:** 4 kompakte Mikrozellen, blockierend.
- **Erz:** Zielrichtung ungefähr 4 Mikrozellen und blockierend.

Blockierende Ressourcen werden von einer begehbaren Nachbarzelle aus benutzt. Lose Warenhaufen enthalten einen Warentyp und 1–3 Einheiten, sind immer begehbar und bleiben nach dem Verschwinden ihrer Quelle erhalten.

Holz, Lehm und Bruchstein folgen dem physischen Grundmodell:

**Ressource → Abbauer → Bodenhaufen → Abholung → Verarbeitung/Lagerung.**

Bodenhaufen sind echte Transportquellen. Sie werden nicht zusätzlich als unsichtbare Rohstoffquelle gespiegelt. Eine reservierte Einheit bleibt sichtbar am Boden, bis sie tatsächlich abgeholt wird.

## Lager und Hauptquartier

Das Hauptquartier und normale Lager besitzen echte Inventare. Träger liefern direkt in dieses Inventar; es gibt kein verborgenes Hilfslager für das Hauptquartier.

Automatische Lager-zu-Lager-Verteilung bleibt verboten. Händler verbinden weiterhin explizit Lager miteinander. Produktionsgebäude und Bauarbeiter dürfen benötigte Waren nach ihren eigenen Regeln aus Lager/HQ oder von physischen Bodenhaufen beschaffen.

## Arbeitsflaggen

Holzfäller, Lehmgräber, Steinbrecher sowie **Lager- und HQ-Träger** besitzen einen lokalen Arbeitsbereich, dessen Mittelpunkt durch eine sichtbare persönliche Arbeitsflagge festgelegt wird. Der gemeinsame Radius beträgt **2,5 Weltkacheln**.

Die Flagge gehört zur einzelnen Person, nicht zum Gebäude. Zwei Träger desselben Lagers können deshalb unterschiedliche Bereiche abdecken. **Abbauer-Flaggen sind rot.**

- Bei einem neuen Holzfäller oder Abbauer erscheint die erste Flagge am ersten tatsächlich gewählten Rohstoffvorkommen.
- Bei einem neuen Lager-/HQ-Träger erscheint sie zunächst am zugewiesenen Lagergebäude.
- Abbauer wählen nur passende freie Rohstoffquellen innerhalb ihrer eigenen Flagge. Ist dort nichts mehr verfügbar, warten sie und wandern nicht automatisch über die Karte zum nächsten Vorkommen.
- Ein Abbauer verschiebt seine Flagge niemals selbst. Nur der Spieler kann den Mittelpunkt verändern.
- Lager-/HQ-Träger holen nur Nicht-Lager-Quellen innerhalb ihrer Flagge. Dazu gehören Produktionsausgänge und physische Warenhaufen. Lager-zu-Lager-Verteilung bleibt Händlersache.
- Wird eine Flagge durch den Spieler verschoben, wird ein noch nicht abgeholtes Ziel außerhalb des neuen Bereichs verworfen und dessen Reservierung freigegeben. Bereits getragene Ware wird noch ausgeliefert.
- Der Spieler versetzt die Flagge über die ausgewählte Person. Ein kurzer Klick oder Tap setzt den neuen Mittelpunkt; Ziehen verschiebt weiterhin die Karte.

Produktions-Träger behalten ihre bestehende bedarfsgetriebene Beschaffung. Eine spätere Ausweitung der Arbeitsflaggen auf weitere Berufe bleibt eine eigene Produktentscheidung.

Die Arbeitsflagge beantwortet **„Wo darf diese Person Ressourcen abbauen oder lokal einsammeln?“**. Langstrecken-Navigation über Wegweiser ist ein separates späteres System.

## Farmen und Felder

Die bestehenden Farmregeln bleiben unverändert. Ein Acker belegt aber vollständig seine feine Rasterfläche und darf beim Säen keine natürliche Ressource oder lose Ware überschreiben. Bereits reservierte Feldflächen und besetzte Zellen bleiben ebenfalls tabu.

Wird eine Farm abgerissen, verschwinden ihre aktiven Felder wie bisher und die belegten Zellen werden wieder zu Gras.

## Gebäude, Freiraum und Abriss

Gebäude behalten ihren mehrzelligen Grundriss und den bestehenden freien Ring von einer alten Weltkachel rundherum. Der komplette Grundriss und der Freiraum dürfen keine aktiven natürlichen Ressourcen schneiden.

Lose Waren dürfen im freien Ring liegen bleiben, aber nicht unter dem eigentlichen Gebäudegrundriss. Damit kann ein Gebäude keine sichtbare Ware beim Platzieren löschen.

Beim Abriss wird die komplette belegte Fläche wieder freigegeben, nicht nur der Ankerpunkt. Eine zuvor überbaute Straße kehrt nicht automatisch zurück; die Fläche wird wie bisher zu Gras.

## Gebäudeeditor

Unter `/building-editor/` steht ein internes Authoring-Werkzeug als eigene Unterseite zur Verfügung. Die Seite ist grundsätzlich auch auf kleinen Geräten erreichbar, wird aber ausschließlich für Desktop-Bedienung optimiert.

Der Editor definiert nur das **Aussehen und räumliche Verhalten** eines Gebäudes: Sprite, Sprite-Anchor, Gebäudegrundriss, blockierte Zellen und genau eine begehbare Eingangszelle. Begehbare Gebäudezellen ergeben sich automatisch aus Grundriss minus blockierten Zellen.

Produktionsregeln, Waren, Arbeiter, Lagerkapazitäten, Baukosten, Technologie und andere Gameplay-Funktionen sind ausdrücklich nicht Teil des Editors.

Im veröffentlichten Editor werden `building.json` und Sprite heruntergeladen. Dieses Dateipaar kann anschließend gemeinsam wieder importiert und vollständig weiterbearbeitet werden; ungültige oder unvollständige Imports überschreiben den aktuellen Editorzustand nicht. Bei lokaler Entwicklung kann derselbe Stand direkt nach `src/assets/buildings/<id>/` gespeichert werden. Bestehende Gebäude werden nicht automatisch auf dieses Format migriert; neue Runtime-Integration kann schrittweise erfolgen.

## Wege

Die bestehende Regel bleibt: **8 Überquerungen innerhalb von 32 simulierten Sekunden** erzeugen einen dauerhaften Weg. Auf Wegen bewegen sich Bewohner mit dem bestehenden Faktor **1,3×**.

Weder manuell gesetzte noch automatisch entstehende Wege dürfen eine aktive natürliche Ressourcenfläche überdecken. Das gilt für den kompletten Ressourcen-Grundriss, nicht nur für dessen Mittelpunkt.

## Hunger

Die eigentliche Simulation und Bewegung laufen weiterhin mit 60 Schritten pro Sekunde. **Hunger wird nur einmal pro simulierter Sekunde aktualisiert und geprüft.** Erst bei diesem Sekundenschritt werden Hungergrenzen bewertet und bei Bedarf ein Essensziel gesucht.

Hat eine Person bereits ein Essensziel und ist unterwegs, behält sie dieses Ziel und ihre Route bei, solange die Reise läuft. Auch eine durch Hunger oder Schlaf unterbrochene Warenabholung kann danach zur selben physischen Abholposition fortgesetzt werden, solange der Auftrag noch gültig ist.

## Berufserfahrung und Technologien

Erfahrung wird pro Person und Beruf von 0 bis 100 gespeichert und bleibt bei Berufswechsel erhalten. Jede erfolgreich abgeschlossene berufliche Tätigkeit gibt genau 1 Erfahrungspunkt; abgebrochene Tätigkeiten geben keinen Punkt.

Eine Technologie wird dauerhaft freigeschaltet, sobald irgendeine Person erstmals 10 XP im zugeordneten Beruf erreicht. Wohnhaus, Farm und Brunnen sind von Anfang an verfügbar; weitere Gebäude werden über die bestehenden Berufsregeln freigeschaltet.

## Ereignisbasierte Entscheidungen

Autonome Bewohner treffen teure Zielentscheidungen nicht laufend neu. Ein Ziel bleibt während der Reise bestehen und wird an Aufgabenübergängen neu bewertet. Hunger und fehlende Arbeitsziele werden höchstens einmal pro Sekunde erneut geprüft. Für Abbauer findet diese Arbeitssuche ausschließlich innerhalb der bestehenden Arbeitsflagge statt.

## Darstellung, Zoom und Eingabe

Bewohner werden visuell ungefähr so groß wie eine einzelne Mikrozelle dargestellt. Ihr Fußpunkt liegt leicht unterhalb der autoritativen Simulationsposition, damit spätere Personen-Sprites natürlich auf der Weltposition stehen können. Die Karte lässt sich per Mausrad und Pinch bis 10× vergrößern.

Gebäudeplatzierung bleibt für Desktop und Touch getrennt bedienbar, verwendet aber dieselbe autoritative Platzierungslogik. Für Arbeitsflaggen gilt ebenfalls: kurzer Klick/Tap setzt die Flagge, Drag bleibt Kartenbewegung.

## Neues Spiel, Speichern und Laden

Über ein eigenes **Spiel**-Menü kann der Spieler jederzeit ein neues Spiel starten, speichern oder laden. Das Menü ist auf Desktop und Touch identisch erreichbar.

**Spiel speichern** friert den vollständigen autoritativen Zustand des aktuellen Simulationsticks als menschenlesbare JSON-Datei ein und lädt diese Datei auf das Gerät herunter. Dazu gehören laufende Arbeit und Transporte, Hunger und Schlaf, Arbeitsflaggen, Inventare, Berufs-XP, dauerhaft freigeschaltete Technologien, Zufallszustand und laufende ID-Zähler.

Räumliche Objekte werden im Spielstand **immer nur über genau einen Ankerpunkt** gespeichert. Gebäude, Äcker, natürliche Ressourcen und lose Waren enthalten keine gespeicherten Footprints oder Listen aller belegten Zellen. Auch der normale statische Untergrund der Welt wird nicht vollständig in die Datei kopiert. Beim Laden werden Gebäude- und Ressourcenformen deterministisch aus Typ und Ankerposition neu aufgebaut.

Dynamische Änderungen der Welt werden nur so weit gespeichert, wie sie nicht aus einem Anker ableitbar sind: bestehende Wege, relevante Verkehrshistorie und Büsche werden als sparsame Einträge mit jeweils genau einer Position abgelegt. Gebäude- und Feld-Terrain sowie Ressourcen-Kollisionen werden beim Laden neu erzeugt und sind nicht Teil der gespeicherten Weltzellen.

Jede gespeicherte Person erhält eine lesbare String-ID; laufende Personentätigkeiten werden zusätzlich als Klartext-Zustand wie `moving`, `transporting-good` oder `sleeping` ausgewiesen. Diese Klartextangabe dient der Lesbarkeit; geladen wird der vollständige zugrunde liegende Simulationszustand.

**Spiel laden** öffnet die lokale Dateiauswahl des Geräts und akzeptiert nur die aktuell unterstützte Save-Version. Nach dem Laden muss die Simulation am gespeicherten Zustand weiterlaufen, als wäre sie nicht unterbrochen worden. Alte Save-Versionen werden ausdrücklich **nicht migriert oder rückwärtskompatibel geladen**.

**Neues Spiel** erzeugt wieder denselben initialen Weltzustand wie beim Start der Anwendung. Vor dem Zurücksetzen wird bestätigt, dass ein ungespeicherter Spielstand verloren geht.

## Noch offene spätere Produktentscheidungen

Nicht Teil des abgeschlossenen Raster-/Ressourcenumbaus sind:

- unterschiedliche Arbeitsradien nach Beruf oder Upgrade,
- Arbeitsflaggen für Produktions-Träger,
- gemeinsam genutzte Flaggen,
- Wegweiser/High-Level-Navigation,
- Ressourcen-Regeneration und neue prozedurale Clusterregeln,
- mehrere Gebäudeeingänge, Animationen oder komplexere Editor-Hitboxen.

## Unveränderte Produktbereiche

Für den vollständigen aktuellen Stand gelten zusätzlich die Details in [`concept-detail.md`](./concept-detail.md), insbesondere Startzustand, Schlaf, Beeren, 60-Hz-Simulation, Produktionsketten, Händler, Personenansicht, Technologiebaum und Handbuch.

Alte Aussagen in `concept-detail.md` über das grobe Raster, Wald als Terrain, alte Rohstofflagerung, versteckte HQ-Lagerlogik, physische Waren als Rohstoff-Proxies, direktes Betreten blockierender Ressourcen, global wandernde Abbauer, tickweise Hungerplanung oder einen festen gebäudezentrierten Lagerträger-Sammelradius sind durch diese Datei überholt.
