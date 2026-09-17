# Produktkonzept

Diese Datei ist der aktuelle Einstieg in das Produktkonzept. Ausführliche unveränderte Regeln bleiben in [`concept-detail.md`](./concept-detail.md) dokumentiert. Bei Widersprüchen beschreibt diese Datei den neueren Stand.

Der abgeschlossene Umbau auf das feine Raster und physische Ressourcen ist in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md) dokumentiert.

## PoC 1: personenbasierte Produktionslogistik

Ziel bleibt eine personenbasierte Produktions- und Logistiksimulation auf einem Hex-Grid. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte und räumliche Planung wirkt direkt auf Produktion, Versorgung und Transport. Hunger und Schlaf konkurrieren mit Arbeit um die Zeit einzelner Personen.

## Feineres Raumraster

Die Welt verwendet intern ein **5× feineres Raster pro Raumachse**: aus 41 × 25 werden 205 × 125 Mikrozellen. Die sichtbare Kartengröße bleibt ungefähr gleich. Gebäude und Äcker belegen viele Mikrozellen; Bewohner bewegen sich flüssig und bleiben visuell lesbar.

## Untergrund, Ressourcen und Waren

Terrain beschreibt nur den Untergrund. Bäume, Lehm, Stein und spätere natürliche Ressourcen sind eigenständige Weltobjekte.

Aktueller verbindlicher Stand:

- **Baum:** 1 Mikrozelle, blockierend, 3 Holz.
- **Busch:** 1 Mikrozelle, nicht blockierend.
- **Pilze:** 1 Mikrozelle, nicht blockierend.
- **Lehm:** 4 kompakte Mikrozellen, nicht blockierend.
- **Stein:** 4 kompakte Mikrozellen, blockierend.
- **Erz:** Zielrichtung ungefähr 4 Mikrozellen und blockierend.

Blockierende Ressourcen werden von einer begehbaren Nachbarzelle aus benutzt. Lose Warenhaufen enthalten einen Warentyp und 1–3 Einheiten, sind begehbar und bleiben nach dem Verschwinden ihrer Quelle erhalten.

Holz, Lehm und Bruchstein folgen dem physischen Grundmodell:

**Ressource → Abbauer → Bodenhaufen → Abholung → Verarbeitung/Lagerung.**

## Lager und Hauptquartier

Das Hauptquartier und normale Lager besitzen echte Inventare. Träger liefern direkt in dieses Inventar; es gibt kein verborgenes Hilfslager für das Hauptquartier.

Automatische Lager-zu-Lager-Verteilung bleibt verboten. Händler verbinden Lager weiterhin explizit miteinander. Produktionsgebäude und Bauarbeiter dürfen benötigte Waren nach ihren eigenen Regeln aus Lager/HQ oder von physischen Bodenhaufen beschaffen.

## Gebäude und Editor-Definitionen

Gebäude besitzen weiterhin getrennte **Gameplay-Regeln** und **räumlich-visuelle Definitionen**.

Gameplay-Regeln bleiben im Spielcode und umfassen unter anderem:

- Produktionsrezepte,
- Waren und Lagerkapazitäten,
- Arbeiter und Träger,
- Baukosten und Bauzeit,
- Technologie-Freischaltungen.

Der Gebäudeeditor definiert ausschließlich die räumlich-visuelle Seite:

- Sprite,
- relativen Sprite-Anchor,
- sichtbare Breite in der Spielwelt,
- Gebäudegrundriss,
- blockierte Zellen,
- genau eine begehbare Eingangszelle.

Die Pixelauflösung des Sprites ist kein Teil der Gebäudegröße. Der Editor speichert die sichtbare Breite in Weltkoordinaten und den Anchor relativ zur Bildgröße. Ein identisches Sprite kann dadurch durch eine höher aufgelöste Datei ersetzt werden, ohne dass Größe oder Ausrichtung neu eingestellt werden müssen. Beim Export wird die ausgewählte PNG-/WebP-Datei nicht heruntergerechnet; hohe Quellauflösung bleibt für starken Kartenzoom erhalten.

Ein Gebäudetyp kann im Runtime-Registry bereits eine Editor-Definition besitzen, ohne dass automatisch jede bestehende Instanz darauf umgestellt wird. Konkrete Gebäudeinstanzen werden ausdrücklich an eine Definition gebunden. Dadurch können die Gebäude schrittweise migriert werden, ohne bestehende Logik oder Testwelten gleichzeitig umzubauen.

Das **Hauptquartier der Spielerwelt** ist das erste vollständig gebundene Gebäude. Weitere Gebäude sollen denselben generischen Weg verwenden. Nicht migrierte Gebäude behalten vorerst ihre bisherigen Grundrisse und Darstellungen.

Für ein gebundenes Gebäude gilt:

- Der im Editor verwendete Bezugspunkt bleibt der räumliche/visuelle Anker.
- Die Gameplay-Position des Gebäudes liegt an der im Editor definierten Eingangszelle.
- Sprite, Grundriss und blockierte Zellen werden gemeinsam relativ zum Editor-Anker ausgerichtet.
- Nur die explizit als `blocked` markierten Grundrisszellen blockieren Bewohner.
- Alle anderen Grundrisszellen sind begehbar.
- Die Eingangszelle muss Teil des Grundrisses und begehbar sein.

Damit können Bewohner ein Gebäude an einer bewusst definierten Stelle erreichen, während Grafik, belegte Fläche und Kollision exakt dieselbe Editor-Geometrie verwenden.

Der neutrale interne Test-/Sandbox-Weltzustand darf weiterhin vereinfachte Legacy-Geometrie verwenden. Das ist keine Spielerfunktion, sondern hält Low-Level-Simulationstests unabhängig von der schrittweisen Grafikmigration.

## Bauen, Freiraum und Abriss

Gebäude brauchen weiterhin ihren vollständigen Grundriss plus den bestehenden freien Ring von einer alten Weltkachel rundherum. Für migrierte Gebäudetypen kommt der Grundriss aus der Editor-Definition; für noch nicht migrierte Typen gilt die bestehende Legacy-Form.

Natürliche Ressourcen dürfen weder den Grundriss noch den notwendigen Freiraum schneiden. Lose Waren dürfen im Freiraum liegen bleiben, aber nicht unter dem eigentlichen Gebäudegrundriss.

Beim Abriss wird die komplette belegte Fläche wieder frei. Eine zuvor überbaute Straße kehrt nicht zurück; die Fläche wird wie bisher zu Gras.

## Gebäudeeditor

Unter `/building-editor/` steht das interne Authoring-Werkzeug als eigene Unterseite zur Verfügung. Es wird für Desktop-Bedienung optimiert.

Die Arbeitsfläche soll die spätere Spielansicht räumlich zuverlässig vorwegnehmen. Rasterzentren und sichtbare Hex-Geometrie verwenden dieselbe Projektion wie das Spiel. Der Editor vergrößert Raster und Sprite nur gemeinsam für die Bearbeitung; dadurch bleibt ihre Größenrelation identisch zur späteren Runtime.

Die Sprite-Größe wird als Breite in der Spielwelt eingestellt, nicht mehr als Multiplikator der Bildpixel. Der Sprite-Anchor wird relativ zur Bildgröße gespeichert. So bleiben WYSIWYG-Ausrichtung und Größe auch dann identisch, wenn dieselbe Grafik später in einer anderen Auflösung vorliegt.

Im veröffentlichten Editor werden `building.json` und das **unveränderte** Sprite heruntergeladen. Der Export verkleinert oder recomprimiert die gewählte Bilddatei nicht. Dieses Dateipaar kann gemeinsam wieder importiert und vollständig weiterbearbeitet werden, sofern es dem aktuellen Schema entspricht. Bei lokaler Entwicklung kann derselbe Stand direkt nach `src/assets/buildings/<id>/` gespeichert werden.

Aktuell gibt es bewusst **keine Rückwärtskompatibilität** für ältere Editor-/Building-Visual-Schemata. Alte Exporte dürfen bei Schemaänderungen abgelehnt werden.

## Arbeitsflaggen

Holzfäller, Lehmgräber, Steinbrecher sowie Lager- und HQ-Träger besitzen einen lokalen Arbeitsbereich mit persönlicher Flagge. Der gemeinsame Radius beträgt **2,5 Weltkacheln**.

Abbauer wählen nur passende freie Rohstoffquellen innerhalb ihrer Flagge. Lager-/HQ-Träger holen nur Nicht-Lager-Quellen innerhalb ihrer Flagge. Wird eine Flagge verschoben, wird ein noch nicht abgeholtes Ziel außerhalb des neuen Bereichs verworfen; bereits getragene Ware wird noch ausgeliefert.

Produktions-Träger behalten ihre bedarfsgetriebene Beschaffung. Arbeitsflaggen und spätere Wegweiser bleiben getrennte Systeme.

## Farmen und Felder

Die bestehenden Farmregeln bleiben unverändert. Ein Acker belegt vollständig seine feine Rasterfläche und darf beim Säen keine natürliche Ressource oder lose Ware überschreiben. Bereits reservierte Feldflächen und besetzte Zellen bleiben ebenfalls tabu.

Wird eine Farm abgerissen, verschwinden ihre aktiven Felder und die belegten Zellen werden wieder zu Gras.

## Wege

Die Grundgeschwindigkeit der Bewohner beträgt **5/6 Weltkachel pro Sekunde**. Die bestehende Regel bleibt: **8 Überquerungen innerhalb von 32 simulierten Sekunden** erzeugen einen dauerhaften Weg. Auf Wegen bewegen sich Bewohner mit Faktor **1,3×**.

Weder manuell gesetzte noch automatisch entstehende Wege dürfen eine aktive natürliche Ressourcenfläche überdecken.

## Hunger und Schlaf

Simulation und Bewegung laufen mit 60 Schritten pro Sekunde. Hunger wird nur einmal pro simulierter Sekunde aktualisiert und geprüft. Bestehende Ziele bleiben während einer Reise stabil, solange der Auftrag gültig ist.

Essen benötigt weiterhin fünf simulierte Sekunden am Ziel. Schlaf folgt den bestehenden Haus-/Natur-/Bodenregeln und konkurriert wie bisher mit Arbeit und Hunger. Bäume und Büsche sind beim Schlafen jeweils nur für eine Person gleichzeitig nutzbar. Dafür gibt es bewusst keine Reservierung: Mehrere Bewohner dürfen denselben Naturplatz ansteuern. Erst bei der Ankunft prüft ein Bewohner, ob dort bereits jemand schläft; ist der Platz belegt, plant er von dort aus ein anderes Schlafziel. Bodenschlaf hat keine solche Exklusivität.

## Berufserfahrung und Technologien

Erfahrung wird pro Person und Beruf von 0 bis 100 gespeichert und bleibt bei Berufswechsel erhalten. Jede erfolgreich abgeschlossene berufliche Tätigkeit gibt genau 1 Erfahrungspunkt; abgebrochene Tätigkeiten geben keinen Punkt.

Produktionsgebäude werden über die Qualifikation des vorgelagerten Berufs freigeschaltet: Sobald irgendeine Person 10 XP im zugeordneten Beruf erreicht, ist die entsprechende Produktionsstätte dauerhaft bekannt. So schaltet beispielsweise **Abbauer Stein** die Steinmetzhütte frei.

Zusätzlich koppelt die Gebäudeprogression an die tatsächlich aufgebaute Produktionskette. Benötigt ein Gebäude verarbeitete Bauwaren, wird es erst freigeschaltet, wenn für jede dieser Waren mindestens eine passende Produktionsstätte **fertig gebaut** ist. Rohstoffe wie Holz benötigen keine Produktionsstätte. Beispiel: Der Brunnen benötigt Quader und wird daher erst nach einer fertigen Steinmetzhütte freigeschaltet. Eine Baustelle genügt nicht. Bei Gebäuden mit eigener Berufsanforderung müssen Berufsqualifikation und alle nötigen Produktionsstätten erfüllt sein.

Freischaltungen sind dauerhaft. Wird die auslösende Produktionsstätte später abgerissen, bleibt das bereits bekannte Gebäude verfügbar. Wohnhaus und Farm sind von Anfang an verfügbar; der Brunnen nicht mehr.

## Darstellung, Zoom und Eingabe

Bewohner bleiben ungefähr so groß wie eine Mikrozelle. Namen, Beruf/Tätigkeit und getragene Waren liegen in Weltkoordinaten und skalieren mit der Karte.

Die Karte lässt sich per Mausrad und Pinch von 0,7× bis 10× zoomen. Gebäude-Sprites sollen deshalb genügend Quellauflösung für starken Zoom behalten; die Runtime skaliert sie auf ihre definierte Weltgröße, ohne den Master im Editor herunterzurechnen. Desktop und Touch bleiben getrennte Eingabemodelle mit derselben autoritativen Spielregel. Kurzer Tap/Klick und Drag dürfen sich nicht gegenseitig verschlechtern.

## Neues Spiel, Speichern und Laden

Über das Spielmenü kann ein neues Spiel gestartet, gespeichert oder geladen werden. Der vollständige autoritative Simulationszustand wird als menschenlesbare JSON-Datei gespeichert.

Räumliche Objekte werden weiterhin kompakt über ihre logische Position gespeichert; abgeleitete Tile- und Footprint-Snapshots werden nicht persistiert. Bei an eine Editor-Definition gebundenen Gebäuden werden die Definition-ID und die Gameplay-Interaktionsposition gespeichert. Grundriss, visueller Anker und blockierte Zellen werden beim Laden deterministisch aus der Registry rekonstruiert.

Die aktuelle Save-Version ist **3**. Die Version des visuellen Building-Schemas ist davon unabhängig. Ältere Save-Versionen werden bewusst nicht migriert oder rückwärtskompatibel geladen.

## Noch offene spätere Produktentscheidungen

Nicht Teil dieses Schritts sind unter anderem:

- Migration aller bestehenden Gebäude auf Editor-Definitionen,
- mehrere Gebäudeeingänge,
- Gebäudeanimationen oder komplexere Hitboxen,
- unterschiedliche Arbeitsradien nach Beruf oder Upgrade,
- Arbeitsflaggen für Produktions-Träger,
- gemeinsam genutzte Flaggen,
- Wegweiser/High-Level-Navigation,
- Ressourcen-Regeneration und neue prozedurale Clusterregeln.

## Unveränderte Produktbereiche

Für den vollständigen aktuellen Stand gelten zusätzlich die Details in [`concept-detail.md`](./concept-detail.md), insbesondere Produktionsketten, Händler, Personenansicht, Technologiebaum und Handbuch. Wo ältere Detailtexte dem hier beschriebenen feinen Raster, den physischen Waren, lokalen Arbeitsbereichen, der neuen gebundenen Gebäude-Definition oder den hier beschriebenen Freischaltregeln widersprechen, ist diese Datei maßgeblich.
