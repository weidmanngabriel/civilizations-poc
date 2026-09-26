# Produktkonzept

Diese Datei ist der aktuelle Einstieg in das Produktkonzept. Ausführliche unveränderte Regeln bleiben in [`concept-detail.md`](../concept-detail.md) dokumentiert. Bei Widersprüchen beschreibt diese Datei den neueren Stand.

Der abgeschlossene Umbau auf das feine Raster und physische Ressourcen ist in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md) dokumentiert.

Bis Version 1 wird bewusst keine Rückwärtskompatibilität gepflegt, wenn dafür Sonderlogik nötig wäre. Alte Saves, Schemata, Zwischenstände oder Datenformen dürfen bei Änderungen brechen; der jeweils aktuelle Produktstand ist verbindlich.

## PoC 1: personenbasierte Produktionslogistik

Ziel bleibt eine personenbasierte Produktions- und Logistiksimulation auf einem Hex-Grid. Waren liegen physisch an Orten, Personen bewegen sie sichtbar über die Karte und räumliche Planung wirkt direkt auf Produktion, Versorgung und Transport. Hunger und Schlaf konkurrieren mit Arbeit um die Zeit einzelner Personen.

### Benutzerabfragen

Bestätigungen und blockierende Hinweise erscheinen als eigene modale Spielfenster statt als Browser-Dialoge. Während einer solchen Abfrage ist die Karte nicht bedienbar. Bestätigen und Abbrechen sind auf Desktop und Touch gleich verfügbar; bei destruktiven Aktionen liegt der Standardfokus auf **Abbrechen**, um versehentliche Löschaktionen zu vermeiden.

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

Beim Aufheben loser Bodenware bleibt die transportierende Person **eine simulierte Sekunde** am Warenhaufen. Abholen aus Gebäuden, Abholen an natürlichen Ressourcen und Abladen dauern weiterhin jeweils **drei simulierte Sekunden**. Erst danach wechselt die Ware tatsächlich den Besitzer. Pause und Simulationsgeschwindigkeit wirken damit genauso auf diese Interaktion wie auf andere Abläufe.

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

Sobald ein `BuildingKind` im Runtime-Registry eine Editor-Definition besitzt, ist diese Definition für **alle aktuellen Instanzen dieses Gebäudetyps autoritativ**. Es gibt keinen per-Instanz-Migrationsschalter und keinen Kompatibilitätspfad zu älteren Definitionen. Gebäudetypen, für die noch keine Editor-Definition existiert, verwenden weiterhin ihre aktuell im Code definierten Formen; das ist Teil des gegenwärtigen Produktzustands und keine Rückwärtskompatibilität.

Aktuell verwenden Hauptquartier, Bäckerei, Farm, Brunnen und Mühle den generischen Editor-/Runtime-Pfad.

Für ein registriertes Gebäude gilt:

- Der im Editor verwendete Bezugspunkt bleibt der räumliche/visuelle Anker.
- Die Gameplay-Position des Gebäudes liegt an der im Editor definierten Eingangszelle.
- Sprite, Grundriss und blockierte Zellen werden gemeinsam relativ zum Editor-Anker ausgerichtet.
- Nur die explizit als `blocked` markierten Grundrisszellen blockieren Bewohner.
- Alle anderen Grundrisszellen sind begehbar.
- Die Eingangszelle muss Teil des Grundrisses und begehbar sein.

Damit können Bewohner ein Gebäude an einer bewusst definierten Stelle erreichen, während Grafik, belegte Fläche und Kollision exakt dieselbe Editor-Geometrie verwenden.

## Gebäude und Infrastruktur

Nicht jedes baubare Objekt ist ein verwaltbares Gebäude. Normale Gebäude wie Hauptquartier, Produktionsgebäude, Lager und Wohnhäuser erscheinen in der Gebäudeübersicht und können gebäudespezifische Verwaltung, Hinweise und Produktionsfunktionen besitzen.

Palisaden gehören stattdessen zur **Infrastruktur**. Infrastruktur kann Material, Bauzeit, Bauarbeiter, Abriss und Kollision mit Gebäuden teilen, erscheint aber nicht als einzelne Instanz in der normalen Gebäudeübersicht und erzeugt keine normalen Gebäudehinweise. Einzelne Infrastrukturelemente dürfen weiterhin direkt auf der Karte ausgewählt werden, wenn sie dort eigene Aktionen besitzen.

Diese Trennung ist für weitere baubare Infrastruktur vorgesehen, insbesondere Tore und vergleichbare lineare oder netzartige Elemente. Wege können dieselbe Kategorie verwenden, sofern sie als eigenständige konstruierbare Elemente mit Bauzustand modelliert werden; reine Terrain-Wege bleiben dagegen Teil des Kartenuntergrunds.

## Bauen, Freiraum und Abriss

Gebäude brauchen ihren vollständigen Grundriss plus einen freien Ring von zwei Mikrozellen rundherum. Für registrierte Gebäudetypen kommt der Grundriss aus der aktuellen Editor-Definition; für noch nicht registrierte Typen gilt die derzeitige codebasierte Form.

Zusätzlich darf ein Gebäude nur gebaut werden, wenn sein **Eingang innerhalb des 3,5-Weltkachel-Radius mindestens eines platzierten Wegweisers** liegt. Es genügt jeder Wegweiser; er muss nicht mit einem anderen Wegweiser verbunden sein. Damit können bewusst mehrere voneinander getrennte Logistiknetze bestehen, etwa auf unterschiedlichen Inseln.

Natürliche Ressourcen dürfen weder den Grundriss noch diesen Freiraum schneiden. Lose Waren dürfen im Freiraum liegen bleiben, aber nicht unter dem eigentlichen Gebäudegrundriss.

Beim Abriss wird die komplette belegte Fläche wieder frei. Eine zuvor überbaute Straße kehrt nicht zurück; die Fläche wird wie bisher zu Gras.

## Gebäudeeditor

Unter `/building-editor/` steht das interne Authoring-Werkzeug als eigene Unterseite zur Verfügung. Es wird für Desktop-Bedienung optimiert.

Die Arbeitsfläche soll die spätere Spielansicht räumlich zuverlässig vorwegnehmen. Rasterzentren und sichtbare Hex-Geometrie verwenden dieselbe Projektion wie das Spiel. Der Editor vergrößert Raster und Sprite nur gemeinsam für die Bearbeitung; dadurch bleibt ihre Größenrelation identisch zur späteren Runtime.

Die Sprite-Größe wird als Breite in der Spielwelt eingestellt, nicht mehr als Multiplikator der Bildpixel. Der Sprite-Anchor wird relativ zur Bildgröße gespeichert. So bleiben WYSIWYG-Ausrichtung und Größe auch dann identisch, wenn dieselbe Grafik später in einer anderen Auflösung vorliegt.

Im veröffentlichten Editor werden `building.json` und das **unveränderte** Sprite heruntergeladen. Der Export verkleinert oder recomprimiert die gewählte Bilddatei nicht. Dieses Dateipaar kann gemeinsam wieder importiert und vollständig weiterbearbeitet werden, sofern es dem aktuellen Schema entspricht. Bei lokaler Entwicklung kann derselbe Stand direkt nach `src/assets/buildings/<id>/` gespeichert werden.

Ältere Editor-/Building-Visual-Schemata werden nicht unterstützt oder migriert. Nur der aktuelle Schemastand ist verbindlich.

## Warten, Gebäude und Personal

Bewohner warten sichtbar außerhalb von Gebäuden, wenn gerade keine sinnvolle Tätigkeit ansteht. In der Personenansicht heißt dieser Zustand ausdrücklich **„Wartet“** statt „Arbeitet“. Ein erwachsener Bewohner ohne Beruf, Arbeitszuweisung oder andere konkrete Aufgabe erhält den blauen Info-Hinweis **„Keine Aufgabe“**. Personenhinweise werden zusätzlich als kompakte Denkblase dicht über dem Kopf der sichtbaren Person sowie im Detailfenster rechts neben **„Aktuell“** dargestellt. Die Denkblase bleibt bewusst klein; bei einem einzelnen Hinweis ist sie nahezu kreisförmig, bei zwei oder drei gleichrangigen Hinweisen wächst sie nur so weit in die Breite wie für die Symbole nötig. Ihre Symbole zeigen den konkreten Status: 🍴 Hunger, 💤 Schlaf, 🚫 kein Weg, ⛏️ nichts mehr abzubauen und … keine Aufgabe. Die Darstellung folgt immer nur der höchsten gerade vorhandenen Stufe: gibt es mindestens einen roten kritischen Hinweis, erscheinen ausschließlich alle roten Hinweise; sonst ausschließlich alle gelben wichtigen Hinweise; nur wenn weder Rot noch Gelb vorliegt, erscheinen die blauen Infos. Gleich wichtige Hinweise wie Hunger und Schlaf dürfen gemeinsam in derselben Denkblase beziehungsweise Statusgruppe erscheinen. Der Hinweis **„Keine Aufgabe“** hängt nicht davon ab, ob die Person gerade stillsteht, zu einem Warteplatz läuft oder einem direkten Bewegungsbefehl folgt. Beim Start einer neuen Welt werden die Bewohner bereits auf mehreren freien Mikrozellen etwas südlich des Hauptquartiers erzeugt, statt auf dessen Eingang gestapelt zu werden. Freie Bewohner und untätige Bauarbeiter bleiben danach grundsätzlich dort stehen, wo sie gerade sind. Steht eine untätige Person jedoch auf einer begehbaren Zelle, die noch zum Grundriss eines Gebäudes gehört, weicht sie auf einen nahen freien Standplatz außerhalb des Gebäudes aus. Abbauer warten bei ihrer persönlichen Arbeitsflagge. Zugewiesene Arbeiter und Träger warten bei ihrem Gebäude. Ein bereits gewählter Warteplatz bleibt bei allgemeinen Neuberechnungen erhalten. Gibt es nach einer Unterbrechung kein konkretes fortzusetzendes Ziel, erhält eine Person kein Ersatz- oder Standardziel und bleibt an ihrer aktuellen Position stehen. Laufwege dürfen sich weiterhin kreuzen.

Bewegungen innerhalb eines persönlichen Arbeitsbereichs werden lokal geplant und benötigen keinen Wegweiser. Das Wegweisernetz bleibt für die übergeordnete Navigation zwischen Gebieten zuständig. Wird ein Arbeitsbereich versetzt und steht sein Besitzer außerhalb des neuen Bereichs, muss er diesen zunächst über das Wegweisernetz erreichen, bevor dort neue lokale Arbeit beginnt.

Während einer tatsächlichen Tätigkeit im Inneren eines **fertigen** Gebäudes ist die komplette normale Bewohnerdarstellung auf der Karte ausgeblendet, einschließlich Name, Tätigkeit und getragener Ware. Diese Regel gilt allgemein für interne Arbeiterzustände: klassische Produktion ebenso wie gebäudeeigene Arbeitsvorgänge wie die laufende Viehzucht. Baustellen gelten noch nicht als Innenraum; Bauarbeiter und andere Personen bleiben dort auch während Warenübergaben sichtbar. Das gilt für passende Arbeits-, Ess- und Schlafvorgänge sowie für die drei Sekunden dauernde Abhol- oder Abladephase an einem Gebäude. Abholen von Bodenware oder natürlichen Ressourcen bleibt sichtbar, weil diese Tätigkeit außerhalb eines Gebäudes stattfindet. Auch am Brunnen bleibt der Bewohner sichtbar, da er ihn visuell nicht betritt. Bloßes Durchqueren begehbarer Gebäudeflächen blendet Bewohner ebenfalls nicht aus. Eine bestehende Auswahl bleibt erhalten; nur der Auswahlmarker bleibt am Eingang sichtbar. Beim Verlassen erscheint die Person wieder am Eingang.

Fertige Gebäude zeigen ihre Zuweisung zusätzlich direkt in der Welt: eine kleine blaue Flagge je Arbeiter und eine rote Flagge je Träger neben dem Eingang. Mehrere Flaggen werden kompakt gestapelt. Die Flaggen sind reine Darstellung und beeinflussen weder Kollision noch Wegfindung.

Wird ein Gebäude abgerissen, werden davon abhängige Tätigkeiten sofort beendet. Personen im Gebäude werden unmittelbar wieder sichtbar und planen anschließend aus dem neuen Weltzustand weiter.

## Arbeitsflaggen

Holzfäller, Lehmgräber, Steinbrecher, Fischer sowie Lager- und HQ-Träger besitzen einen lokalen Arbeitsbereich mit persönlicher Flagge. Der gemeinsame Radius beträgt **2,5 Weltkacheln**.

Abbauer wählen nur passende freie Rohstoffquellen innerhalb ihrer Flagge. Die Flagge funktioniert für ihren Besitzer als persönlicher lokaler Navigations-Node: befindet sich die Person bereits im Arbeitsbereich, werden Wege zu dort liegenden Arbeitszielen direkt lokal berechnet. Wird die Flagge so versetzt, dass die Person außerhalb des neuen Bereichs steht, muss sie den neuen Bereich zunächst regulär über das globale Wegweisernetz erreichen. **Jede einzelne abgebaute Einheit** wird vom Abbauer persönlich zur eigenen Arbeitsflagge getragen und erst dort als lose Ware gestapelt; erst danach arbeitet er weiter. Bei vollen Stapeln entstehen weitere Stapel möglichst dicht an der Flagge. Lager-/HQ-Träger holen nur Nicht-Lager-Quellen innerhalb ihrer Flagge. Wird eine Flagge verschoben, wird ein noch nicht abgeholtes Ziel außerhalb des neuen Bereichs verworfen; bereits getragene Ware wird noch zur aktuellen persönlichen Flagge gebracht.

Produktions-Träger behalten ihre bedarfsgetriebene Beschaffung. Arbeitsflaggen und Wegweiser bleiben getrennte Systeme.


### Fischschwärme

Fische sind nicht mehr unerschöpflich. Jede zusammenhängende Wasserregion besitzt einen Fischschwarm mit **15 Fischen**. Ein erfolgreicher Angelversuch entnimmt genau einen Fisch aus diesem Bestand. Ist der Bestand bei 0, bleibt der Schwarm bestehen, liefert aber vorübergehend keinen Fang.

Solange der Bestand unter 15 liegt, wächst er alle **60 simulierten Sekunden um genau einen Fisch**, auch von 0 aus. Die Position des sichtbaren Schwarms innerhalb seiner Wasserregion ist rein grafisch: Ein Fischer kann den Schwarm von jeder gültigen Angelstelle derselben Region befischen, unabhängig davon, in welcher Ecke der Schwarm gerade angezeigt wird.

Große Bestände werden als kompakter Schwarm dargestellt. Die sichtbaren Fische behalten beim Zoomen eine konstante Bildschirmgröße und sind gegenüber der bisherigen Darstellung etwas größer. Für die letzten drei Fische ist die Darstellung exakt: Bei 3, 2 beziehungsweise 1 verbleibenden Fischen sind genau 3, 2 beziehungsweise 1 Fische sichtbar; bei 0 ist kein Fisch sichtbar.

## Wegweiser

Beim Spielstart steht ungefähr eine Weltkachel vor dem Hauptquartier ein erster Wegweiser. Weitere Wegweiser werden nicht über das Baumenü, sondern durch einen **Kundschafter** errichtet. Der Kundschafter ist ein frei wählbarer Beruf und kann beliebig viele Wegweiser nacheinander bauen. In seinem Personen-Kontextmenü startet **Wegweiser** den bekannten Platzierungsmodus. Bereits beim Öffnen werden alle aktuell gültigen Positionen hervorgehoben. Wird während einer noch offenen Platzierungsansicht ein zuvor beauftragter Wegweiser fertiggestellt, werden die gültigen Flächen sofort neu berechnet. Das gilt sowohl für die Wegweiser-Platzierung als auch für den normalen Gebäudebaumodus, weil sich durch den neuen Orientierungsradius und Mindestabstand die gültigen Flächen ändern können. Ein bereits gewählter Ghost wird dabei neu validiert. Auf dem Desktop folgt der Ghost der Maus und Linksklick wählt die Zielstelle; Rechtsklick, Escape oder „Abbrechen“ beendet den Modus. Auf Touch wählt ein Tap die Position, Ziehen verschiebt weiter die Karte und der Bestätigungsbutton erteilt den Auftrag.

Nach der Bestätigung läuft der konkrete Kundschafter selbst zur Zielstelle. Kundschafter sind grundsätzlich **nicht an das Wegweisernetz gebunden** und dürfen direkt über begehbares Terrain navigieren, auch wenn das Ziel außerhalb des bestehenden Netzes liegt. Dieselbe Grundregel soll später auch für Soldaten gelten. Erst an der Zielstelle beginnt der Bau. Das Errichten dauert **eine simulierte Sekunde**, verbraucht **keine Ressourcen** und endet mit dem normalen Anlegen und Verbinden des Wegweisers. Der Wegweiser selbst und die sechs direkt angrenzenden Mikrozellen dürfen nicht von einem Gebäudegrundriss belegt werden. Wegweiser können angeklickt und über ihr eigenes Menü wieder abgerissen werden; ihre Verbindungen werden dabei entfernt.

Jeder Wegweiser besitzt einen **Orientierungsradius von 3,5 Weltkacheln**. Der Mindestabstand zwischen zwei Wegweisern entspricht demselben Radius, also **3,5 Weltkacheln**. Die maximale direkte Verbindungsdistanz ist doppelt so groß, also **7 Weltkacheln**. Damit verbinden sich erreichbare Wegweiser bei einem Abstand von 3,5 bis 7 Weltkacheln.

Für jede Verbindung trägt ein Wegweiser ein eigenes kleines Richtungsschild, das in der isometrischen Kartenansicht auf den verbundenen Wegweiser zeigt.

Bewohner verwenden das Wegweisernetz verpflichtend für die grobe Erreichbarkeit, müssen die Wegweiser selbst aber nicht betreten. Liegen Start und Ziel im Bereich desselben Wegweisers oder zweier direkt verbundener Nachbar-Wegweiser, wird der Weg direkt über das feine Raster berechnet. Bei längeren Reisen ab drei beteiligten Wegweisern bestimmt das Wegweisernetz zuerst eine grobe Node-Kette; die eigentliche Wegsuche bleibt anschließend auf den gemeinsamen Korridor dieser Orientierungsbereiche begrenzt. Dadurch bleiben lange Suchen klein, ohne künstliche Schleifen über die Wegweiser-Kacheln zu erzeugen. Eine bereits begonnene Route bleibt stabil: neu entstehende, gesetzte oder entfernte Wege lösen unterwegs keine globale Neuplanung aus und beeinflussen erst die nächste Routenwahl. Es gibt in der Spielerwelt keine Direktnavigation, die fehlende Wegweiser-Verbindungen umgeht. Fehlt ein gültiger Weg, bleibt die Person stehen und erhält einen gelben Hinweis, der das blockierte Ziel benennt, zum Beispiel **„Kein Weg zur Arbeitsstätte“**, **„Kein Weg zur Ressource“**, **„Kein Weg zu Nahrung“** oder **„Kein Weg zum Schlafplatz“**. Derselbe erfolglose Weg wird nicht laufend neu gesucht; erst eine Änderung des Wegweisernetzes erlaubt für dieses Ziel wieder einen neuen Versuch.

Für **Hunger und Schlaf** besitzt jeder normale Bewohner zusätzlich eine lokale Suche mit demselben Radius wie ein Wegweiser, also **3,5 Weltkacheln** um seine Position beim Start der Bedarfssuche. Innerhalb dieses Radius darf er direkt über das feine Raster navigieren, auch wenn der Weg kurz aus der Wegweiserabdeckung herausführt. Beginnt die Bedarfssuche innerhalb einer Wegweiserabdeckung und verlässt der lokale Weg diese Abdeckung, kehrt der Bewohner nach Essen oder Schlafen zuerst zu seiner Startposition zurück und nimmt erst dort seine normale Aufgabe wieder auf. Findet die lokale Suche kein brauchbares Ziel und steht der Bewohner außerhalb der Wegweiserabdeckung, kehrt er zunächst lokal zu einem nahen, abgedeckten Arbeitsanker zurück: zur persönlichen Arbeitsflagge oder zur zugewiesenen Arbeitsstätte. Dieser Anker muss innerhalb desselben 3,5-Weltkachel-Radius liegen. Erst von dort startet die normale globale Wegweiser-Navigation für Hunger oder Schlaf. Damit können insbesondere Farmer von Feldern außerhalb der Abdeckung zur Farm zurückkehren, bevor sie Nahrung oder Schlafplatz im Netz suchen.

**Kundschafter** sind von dieser Einschränkung vollständig ausgenommen: Sie verwenden für alle Ziele globales direktes Pathfinding über begehbares Terrain und benötigen keine Wegweiserverbindung. **Soldaten** sollen dieselbe Navigationsklasse verwenden, sobald dieser Beruf im Prototyp eingeführt wird.

### Fischer

Fischer sind Freiluftarbeiter ohne eigenes Gebäude. Ihre persönliche Arbeitsflagge begrenzt das Angelgebiet. Innerhalb dieses Bereichs suchen sie eine erreichbare, begehbare Zelle direkt am Wasser.

Sobald ein Fischer seinen Angelplatz erreicht, beginnt ein **fünf Sekunden langer Fangzyklus**: Die Angel wird ungefähr eine halbe Sekunde ausgeworfen, liegt rund vier Sekunden im Wasser und wird ungefähr eine halbe Sekunde eingeholt. Erst beim Einholen wird der Fang ausgewertet. Danach sucht der Fischer möglichst einen anderen Angelplatz innerhalb seiner Flagge. Der Fang greift auf den endlichen Fischbestand der zugehörigen Wasserregion zu.

Die Fangchance beträgt bei null Berufserfahrung **30 %** und steigt linear bis auf **80 %** bei voller Fischererfahrung. **Nur ein erfolgreicher Fang** zählt als abgeschlossene Berufsaktion und erhöht die Fischer-Erfahrung um einen Punkt; ein erfolgloser Fangversuch gibt keine Erfahrung.

Bei Erfolg trägt der Fischer genau **einen Fisch** persönlich zu seiner Arbeitsflagge. Erst dort wird der Fisch als physische lose Ware gestapelt und kann anschließend von geeigneten Trägern eingesammelt werden. Nach einem Fehlfang muss er dagegen nicht zur Flagge zurückkehren, sondern darf direkt einen weiteren Angelplatz innerhalb seines lokalen Bereichs ansteuern. **Jeder vollständig eingeholte Angelvorgang ist eine Aufgabengrenze:** Ist der Fischer dann hungrig oder müde genug für die normale Bedarfsschwelle, kümmert er sich zuerst um Essen beziehungsweise Schlaf, unabhängig davon, ob der Versuch erfolgreich war. Ein bereits gefangener Fisch bleibt dabei bei ihm und wird nach dem Bedürfnis zur Arbeitsflagge gebracht.

## Farmen und Felder

Die Farm übernimmt für ihren Farmer dieselbe Rolle wie eine lokale Arbeitsflagge, ohne dass dafür eine sichtbare persönliche Flagge existiert. Die Farm ist der lokale Navigations-Node; die Felder liegen in ihrem Arbeitsumfeld. Die Anreise von außerhalb dieses Bereichs benötigt das globale Wegweisernetz. Innerhalb des Farmbereichs läuft die Arbeitsnavigation lokal. Nach Säen oder Düngen kehrt der Farmer zuerst zur Farm zurück, bevor er eine neue Aufgabe beginnt. Nach einer Ernte bringt er den Weizen ohnehin zur Farm zurück. Sind reife Felder vorhanden, aber das Farmlager einschließlich bereits ankommender Ernte voll, wartet der Farmer außerhalb weiter, statt für eine nicht ausführbare Arbeitsprüfung immer wieder zur Farm zurückzulaufen.

Ein Acker belegt vollständig seine feine Rasterfläche und darf beim Säen keine natürliche Ressource oder lose Ware überschreiben. Bereits reservierte Feldflächen und besetzte Zellen bleiben ebenfalls tabu.

Wird eine Farm abgerissen, verschwinden ihre aktiven Felder und die belegten Zellen werden wieder zu Gras.

## Wege

Die Grundgeschwindigkeit der Bewohner beträgt **5/6 Weltkachel pro Sekunde**. Die bestehende Regel bleibt: **8 Überquerungen innerhalb von 32 simulierten Sekunden** erzeugen einen dauerhaften Weg. Auf Wegen bewegen sich Bewohner mit Faktor **1,3×**.

Weder manuell gesetzte noch automatisch entstehende Wege dürfen eine aktive natürliche Ressourcenfläche überdecken.

## Hunger und Schlaf

Simulation und Bewegung laufen mit 60 Schritten pro Sekunde. Hunger wird nur einmal pro simulierter Sekunde aktualisiert und geprüft. Bestehende Ziele bleiben während einer Reise stabil, solange der Auftrag gültig ist. Bei **40 %** Hunger beziehungsweise Schlaf beginnt eine Person, an einer passenden Aufgabengrenze nach Essen oder Schlaf zu suchen. Diese Suchschwelle ist bewusst von der Warnanzeige getrennt.

Essen benötigt weiterhin fünf simulierte Sekunden am Ziel. Die Personenanzeige verwendet **„Isst“** nur während dieser tatsächlichen Essensphase; ohne aktuelles Essensziel zeigt sie **„Sucht Essen“**. Brot stellt 80 Hungerpunkte wieder her, Fisch und Fleisch jeweils 60 und ein Busch 40; Hunger bleibt immer auf maximal 100 begrenzt. Fisch und Fleisch können aus Hauptquartier oder Lager sowie direkt von einem passenden losen Stapel gegessen werden. Bewohner mit zugewiesener Wohnung schlafen in ihrem eigenen Wohnhaus, sofern es erreichbar ist. Ist kein Weg dorthin möglich, dürfen sie lokal in der Natur oder auf dem Boden schlafen. Zwei fünfsekündige Schlafphasen geben im Haus jeweils 50, unter Baum oder Busch jeweils 15 und auf dem Boden jeweils 5 Schlafpunkte. Schlaf bleibt ebenfalls auf maximal 100 begrenzt. Die Abnahme von Hunger und Schlaf ist gegenüber der vorherigen Balance halbiert, damit die Versorgung trotz lokal begrenzter Wegweiser-Erreichbarkeit im frühen Spiel mehr Spielraum lässt. Schlaf pausiert die aktuelle Tätigkeit, entfernt aber weder Beruf noch Arbeitsplatz-/Ressourcenzuweisung; nach dem Aufwachen wird die vorhandene Aufgabe fortgesetzt. Bäume und Büsche sind beim Schlafen jeweils nur für eine Person gleichzeitig nutzbar. Dafür gibt es bewusst keine Reservierung: Mehrere Bewohner dürfen denselben Naturplatz ansteuern. Erst bei der Ankunft prüft ein Bewohner, ob dort bereits jemand schläft; ist der Platz belegt, plant er von dort aus ein anderes Schlafziel. Bodenschlaf hat keine solche Exklusivität.

## Berufserfahrung und Technologien

Erfahrung wird pro Person und Beruf von 0 bis 100 gespeichert und bleibt bei Berufswechsel erhalten. Jede erfolgreich abgeschlossene berufliche Tätigkeit gibt genau 1 Erfahrungspunkt; abgebrochene Tätigkeiten geben keinen Punkt.

Höherwertige Produktionsberufe sind personenbezogen an 10 XP im direkten Vorgängerberuf gebunden: Abbauer Holz → Sägewerker → Schreiner, Abbauer Lehm → Töpfer, Abbauer Stein → Steinmetz, Farmer → Müller → Bäcker sowie Jäger → Näher. Basisberufe bleiben frei wählbar. Ein Bewohner kann einen Folge-Beruf erst erhalten, wenn er selbst die nötige Erfahrung gesammelt hat. Das Berufe-Menü zeigt nur die für die ausgewählte Person aktuell verfügbaren Berufe; gesperrte Berufe werden dort nicht aufgeführt. Dieselbe Qualifikationsprüfung gilt bei der direkten Personalauswahl an Produktionsgebäuden.

Produktionsgebäude werden über die Qualifikation des vorgelagerten Berufs freigeschaltet: Sobald irgendeine Person 10 XP im zugeordneten Beruf erreicht, ist die entsprechende Produktionsstätte dauerhaft bekannt. So schaltet beispielsweise **Abbauer Stein** die Steinmetzhütte frei. Ein Jäger mit 10 XP schaltet entsprechend die Näherei frei und kann selbst zum Näher werden.

Zusätzlich koppelt die Gebäudeprogression an die tatsächlich aufgebaute Produktionskette. Benötigt ein Gebäude verarbeitete Bauwaren, wird es erst freigeschaltet, wenn für jede dieser Waren mindestens eine passende Produktionsstätte **fertig gebaut** ist. Rohstoffe wie Holz benötigen keine Produktionsstätte. Beispiel: Der Brunnen benötigt Quader und wird daher erst nach einer fertigen Steinmetzhütte freigeschaltet. Eine Baustelle genügt nicht. Bei Gebäuden mit eigener Berufsanforderung müssen Berufsqualifikation und alle nötigen Produktionsstätten erfüllt sein.

Freischaltungen sind dauerhaft. Wird die auslösende Produktionsstätte später abgerissen, bleibt das bereits bekannte Gebäude verfügbar. Wohnhaus und Farm sind von Anfang an verfügbar; der Brunnen nicht mehr.

Die Näherei verarbeitet **1 Leder zu 1 Paar Schuhen**. Leder stammt derzeit aus der Wildschweinjagd. Bewohner besitzen jetzt die Ausrüstungsslots **Werkzeug** und **Schuhe**. Eine neue Spielwelt startet mit **5 Holzwerkzeugen** und **5 Paar Schuhen** im Inventar des Hauptquartiers. Aktuell können ausschließlich **Holzwerkzeug** und **Schuhe** manuell zugewiesen werden. Schuhe erhöhen die Gehgeschwindigkeit um **30 %** und halten **2.500 Microtiles** Wegstrecke. Holzwerkzeug erhöht die Geschwindigkeit produktiver Arbeit einschließlich Bauen, Ressourcenabbau, Produktion, Farmarbeit und Angeln um **30 %** und hält **30 Arbeitsvorgänge**. Die Person-Detailansicht zeigt bei beiden Slots die bisherige **Abnutzung von 0 bis 100 %** statt Rest-Einsätzen beziehungsweise Rest-Microtiles. Nach einer manuellen Zuweisung merkt sich die Person den Ausrüstungstyp und rüstet nach vollständigem Verschleiß automatisch denselben Typ aus einem Lager oder dem Hauptquartier nach, sobald Bestand verfügbar ist. Wird ein Slot in der Person-Detailansicht manuell abgelegt, endet diese automatische Neuausrüstung. Das abgelegte Exemplar bleibt als physischer Gegenstand mit seiner aktuellen Abnutzung erhalten: Ist ein fertiges Hauptquartier oder Lager vorhanden, wird es dort eingelagert; andernfalls entsteht ein physischer Bodenstapel. Nimmt später eine andere Person genau dieses gebrauchte Exemplar auf, übernimmt sie dessen verbleibende Haltbarkeit. Fabrikneue Ausrüstung darf weiterhin als einfache Stückzahl im Lager geführt werden; gebrauchte Exemplare werden wegen ihres individuellen Zustands separat gespeichert. Das Kontextmenü trennt **Werkzeug** und **Schuhe**. Beide Slots öffnen jeweils ein eigenes Auswahlmenü; bei Schuhen bleibt dieses Menü auch dann erhalten, wenn aktuell nur ein Schuhtyp existiert. Eine Zuweisung reserviert die Ware in einem erreichbaren Lager oder Hauptquartier. Die Person läuft anschließend dorthin und rüstet den Gegenstand erst bei Ankunft aus; Ausrüstung wird nicht zur Person teleportiert. Ein laufender Abholauftrag wird in der Detailansicht als **„Wird geholt“** angezeigt. Bereits vollständig belegte beziehungsweise bereits laufend versorgte Slots sind im Ausrüstungsmenü deaktiviert. Ablegen erfolgt ausschließlich in der Detailansicht. Die Struktur ist bewusst um weitere spätere Slots wie Rüstung erweiterbar.

## Gebäudehinweise

Gebäudehinweise sind Teil der Gebäudeübersicht und nicht in einem allgemeinen Benachrichtigungsmenü gesammelt. Analog zur Personenübersicht zeigt der Gebäude-Button kompakte Hinweiszähler und die Gebäudeübersicht kann nach Hinweisstufe filtern. Beim Schließen der Personen- oder Gebäudeübersicht werden Suche und Filter auf den Ausgangszustand zurückgesetzt, sodass jede neue Öffnung ungefiltert startet. Fertige Gebäude mit mindestens einem Arbeiterplatz zeigen einen wichtigen Hinweis, solange noch kein Arbeiter zugewiesen ist. Auf der Karte erscheint zusätzlich ein Ausrufezeichen am Gebäude. Ein Klick oder Tap auf Eintrag oder Marker zentriert die Kamera und öffnet das Gebäude. Nach einer Arbeiterzuweisung verschwindet der Hinweis; wird später wieder der letzte Arbeiter entfernt, erscheint er erneut.

## Personenhinweise

Die Personenübersicht bündelt aktuelle Probleme und Hinweise in drei Stufen: **kritisch**, **wichtig** und **Info**. Jede Person wird höchstens einmal gezählt und immer nur in ihrer schwersten aktuell zutreffenden Stufe. Hunger oder Müdigkeit erscheinen erst ab **30 %** als gelber wichtiger Hinweis und ab **20 %** als roter kritischer Hinweis. Personen zwischen 31 und 40 % können bereits selbständig nach Versorgung suchen, erscheinen aber noch nicht in diesen Warnfiltern. Freie Personen ohne Aufgabe erscheinen als Information. Holz-, Lehm- und Steinabbauer erhalten einen gelben wichtigen Hinweis **„Nichts mehr abzubauen“**, sobald in ihrem persönlichen Arbeitsbereich kein passendes, nicht erschöpftes Vorkommen mehr vorhanden ist.

Die drei Stufen sind ausschließlich in der normalen Personenübersicht filterbar und werden zusätzlich kompakt am Personen-Button angezeigt, damit dringende Probleme auch bei geschlossener Liste sichtbar bleiben. In anderen Personenauswahlen, etwa bei der Personalzuweisung eines Gebäudes, werden diese Hinweisfilter nicht angezeigt oder angewendet; Berufsfilter bleiben dort verfügbar. Die Klassifizierung wird höchstens einmal pro Sekunde aktualisiert. Eine Arbeitsblockade wird nur dann als eigener Hinweis gezeigt, wenn ihre Ursache zuverlässig aus dem Simulationszustand feststeht; bloßes Warten wird nicht als Ressourcenmangel interpretiert.

## Direkte Personensteuerung

Bewohner werden einzeln ausgewählt. Die normale Auswahl zeigt nur kompakte Personeninformationen; die eigentlichen Befehle liegen in einem separaten Kontextmenü. Auf Mobile bleibt dieses Personen-Flyout bewusst kompakt und ohne internes Scrollen: es sitzt direkt am unteren Bildschirmrand, der Aktionsbutton steht links oben, Schließen rechts oben und die Stammdaten bleiben einzeilig ohne Umbruch. Die Pfeilnavigation zwischen Personen ist dort nicht Teil des Flyouts. Am Desktop öffnet die **Leertaste** dieses Menü, zusätzlich steht auf allen Eingabegeräten der sichtbare Aktionsbutton zur Verfügung.

Das Kontextmenü besitzt dauerhaft **16 feste Slots** als hohles Quadrat ohne Ecken. Nicht verfügbare Aktionen werden nicht als aktive Buttons angezeigt. Ihre festen Positionen bleiben als sehr dezente, nicht klickbare Kacheln sichtbar, damit der Rahmen des Kontextmenüs als Quadrat ohne Ecken erkennbar bleibt und spätere Aktionen ergänzt werden können, ohne gelernte Positionen zu verschieben.

Der erste verbindliche Aktionssatz ist:

- oben: **Beruf**, **Arbeitsplatz**, **Wohnung**, **Arbeitsbereich**;
- rechts: **Bewegen**, **Essen**, **Schlafen** sowie kontextabhängig **Wegweiser**;
- unten rechts: **Ausrüstung** als gemeinsames Zuweisungsmenü für die aktuell unterstützten Ausrüstungstypen;
- alle übrigen Slots bleiben vorerst leer.

Arbeitsbereich erscheint nur bei Personen mit persönlicher Arbeitsflagge. Arbeitsplatz und Wohnung wechseln in einen Karten-Auswahlmodus, in dem nur gültige Ziele hervorgehoben werden. Bewegen wartet auf eine Zielzelle. Direkte Bewegungsbefehle haben bis zur Ankunft Vorrang vor normaler Autonomie; danach setzt die Person ihre reguläre Tätigkeit fort. Ein bewusst ausgelöster Ess- oder Schlafbefehl startet die bereits vorhandene Bedürfnislogik sofort. Eine zugewiesene Wohnung wird beim Schlafen gegenüber anderen Häusern bevorzugt.

Beruf und Arbeitsplatz sind getrennte Entscheidungen. Ein Bewohner kann daher einen Beruf besitzen, ohne bereits einen passenden Arbeitsplatz zu haben. Berufserfahrung bleibt wie bisher personenbezogen erhalten.

Gebäude weisen Personal **nicht mehr über Plus/Minus-Regler automatisch zu**. Stattdessen zeigen fertige Gebäude ihre vorhandenen Personalplätze je Rolle. Besetzte Plätze zeigen Name und aktuelle Tätigkeit als anklickbaren Personeneintrag; Tippen oder Klicken wählt diese konkrete Person und zentriert die Kamera auf sie. Ein freier Platz öffnet über **Geeignete Personen** die Personenübersicht in einem Zuweisungsmodus. Solange keine zusätzlichen Eignungsregeln existieren, stehen dort alle anderen Bewohner zur Auswahl. Die Liste priorisiert zuerst Bewohner mit bereits passendem Beruf aber ohne Arbeitsplatz, danach freie Bewohner ohne Beruf und zuletzt alle übrigen geeigneten Bewohner; innerhalb jeder Gruppe wird alphabetisch nach Name sortiert. Wird eine bereits beschäftigte Person gewählt, muss der Wechsel bestätigt werden.

Auswahllisten werden nach sichtbarer Bezeichnung alphabetisch sortiert. Größere Auswahloberflächen wie **Beruf**, **Ausrüstung** und **Geeignete Personen** öffnen sich als großzügige, nahezu bildschirmfüllende Dialoge unabhängig von der Größe des zuvor geöffneten Personen- oder Gebäude-Detailfensters. Auf Touch nutzen sie fast die gesamte sichere Bildschirmfläche; auf Desktop bleibt ein kleiner Rand zur Karte sichtbar. **Wegweiser** ist kein Baumenü-Eintrag mehr, sondern eine kontextsensitive Aktion des Berufs **Kundschafter**. **Pause/Fortsetzen**, Simulationsgeschwindigkeit und **Debug** liegen im Spielmenü statt dauerhaft über der Karte. Zusätzlich zu den festen Tempostufen kann im freien Eingabefeld ausschließlich eine **Ganzzahl von 1× bis 9×** eingestellt werden; die feste 0,5×-Stufe bleibt davon unabhängig verfügbar. Die zuletzt gewählte Simulationsgeschwindigkeit gehört zum Spielstand und wird beim Laden wiederhergestellt. Das Personen-Kontextmenü schließt sich nach einer erfolgreich gestarteten Aktion sowie immer dann, wenn ein anderes Hauptmenü geöffnet wird. Während eines kartenbezogenen Aktionsmodus – etwa Bewegen, Arbeitsplatz-/Wohnortwahl, Arbeitsbereich versetzen, Händlerziel, Ausbauprüfung oder Bauplatzierung – wird die übrige UI ausgeblendet. Sichtbar bleiben nur Karte und die zum aktiven Modus gehörenden Aktionsbuttons wie Abbrechen, Bauen oder Zurück.

## Jäger und Kleinwild

Der Jäger ist ein freier Außenberuf mit eigener Arbeitsflagge. Sein Jagdradius beträgt 10 Weltkacheln und ist damit viermal so groß wie der Bereich eines normalen Abbauers oder Fischers. Jäger nehmen nicht an der allgemeinen Idle-Standplatzlogik teil; sobald sie neue Beute erfassen, wird ein eventuell noch vorhandener alter Idle-Weg verworfen und die Verfolgung direkt neu geplant. Die Bogenschussweite bleibt davon unabhängig bei 2 Weltkacheln. Der Jäger erkennt neue Beute nur innerhalb seines Jagdgebiets. Hat er ein Tier einmal als Ziel gewählt, verfolgt er genau dieses Tier jedoch auch über die Grenze des Jagdgebiets hinaus, bis es erlegt wurde, verschwunden oder nicht erreichbar ist. Das Erreichen einer neu versetzten Arbeitsflagge vor Beginn der Jagd ist normale übergeordnete Navigation und benötigt das Wegweisernetz. Erst wenn der Jäger den Arbeitsbereich erreicht und dort ein Wild als Ziel gewählt hat, beginnt die freie Jagdverfolgung. Diese Verfolgung sowie das anschließende Holen und Zurücktragen der Jagdbeute sind nicht an Wegweiser gebunden; der Jäger findet auf direktem globalem Weg zur Beute und zu seiner Arbeitsflagge. Wird er während dieser freien Verfolgung hungrig, sucht er zuerst lokal nach Nahrung. Findet er dort nichts, kehrt er direkt zu seiner Arbeitsflagge zurück und startet erst dort die normale, an Wegweiser gebundene Nahrungssuche. Nach dem Essen übernimmt das Jagdsystem wieder das vorhandene Jagd- oder Beuteziel. Erst für die Auswahl eines neuen Ziels gilt wieder der Jagdradius. Er läuft bis in Bogenschussweite. Sobald ein Ziel in Reichweite ist, bleibt er zwei simulierte Sekunden stehen und zielt. Dieser Zielvorgang bindet den begonnenen Schuss an das Tier: Läuft es während der zwei Sekunden wieder aus der Bogenschussweite, wird der Schuss trotzdem ausgeführt. Erst nach dem Schuss wird die Entfernung neu bewertet; ist das Ziel dann zu weit entfernt, läuft der Jäger erneut näher heran und beginnt anschließend einen neuen Zielvorgang.

Die Trefferchance steigt mit der Jägererfahrung linear von 20 % auf 95 %. Wird auf ein bereits fliehendes Tier geschossen, gilt nur die Hälfte der normalen Trefferchance. Ein Treffer erlegt Kleinwild sofort. Jägererfahrung entsteht ausschließlich durch tatsächlich erlegtes Wild. Jeder Pfeil fliegt sichtbar zum beim Abschuss festgelegten Einschlagpunkt und bleibt dort nach dem Einschlag zehn simulierte Sekunden im Boden sichtbar.

Ein erlegter Hase hinterlässt genau eine Fleischkeule als physische Bodenware. Ein erlegtes Wildschwein hinterlässt eine Fleischkeule und einmal Leder. Die Beute ist zunächst für den erfolgreichen Jäger reserviert. Er hebt immer nur eine Ware auf, trägt sie persönlich zu seiner Arbeitsflagge zurück und läuft danach für die nächste reservierte Beute erneut zum Abschussort. Darf er nach dem Ablegen des Fleisches essen, bleibt die noch reservierte Beute sein fortzusetzender Auftrag; danach holt er beispielsweise das Leder. Erst wenn alle Beute abgelegt ist, beginnt er wieder zu jagen. Fleisch kann danach eingelagert, transportiert und gegessen werden und sättigt mit 60 Hungerpunkten genauso stark wie Fisch; Leder ist eine normale nicht essbare Ware. Hasen und Pfeile werden rein visuell mit halbierter Größe gegenüber dem vorherigen Stand gezeichnet; Reichweite, Trefferlogik und Simulationspositionen ändern sich dadurch nicht.

Hasen leben in kleinen Gruppen mit einem gemeinsamen Heimatpunkt, bleiben aber einzelne Simulationsobjekte. Wildschweine sind Einzelgänger. Technisch nutzen sie dieselbe Bewegungs- und Fluchtlogik, werden aber immer als einzelne Tiere ohne weitere Gruppenmitglieder erzeugt. Im Normalzustand bewegen sie sich alle 4–8 Sekunden einige Schritte in einem leicht zick-zack-förmigen Hoppelmuster. Etwa alle 30 Sekunden erhält die Gruppe ein neues gemeinsames Wanderziel 10–15 Mikrozellen vom aktuellen Gruppenzentrum entfernt. Neue Ziele bevorzugen ungefähr die bisherige Wanderrichtung, damit die Gruppe über längere Bögen durch die Landschaft zieht statt alle 30 Sekunden zufällig umzudrehen. Der ursprüngliche Heimatpunkt zieht die Gruppe erst zurück, wenn sich ihr Zentrum ungefähr 30 Mikrozellen davon entfernt hat. Dieses Ziel beeinflusst jedes Tier nur leicht. Hasen halten dabei einen lockeren persönlichen Abstand: In der Nähe des Schwarms werden sie nicht zusätzlich ins Zentrum gezogen, sehr nahe Tiere weichen voneinander weg und erst weiter entfernte Tiere werden wieder stärker zur Gruppe gezogen. Zwei Hasen sollen nicht auf derselben Mikrozelle stehen bleiben; würde ein geplanter Hoppelweg dort enden, wird bis zu einem freien Platz weitergehoppelt. Dadurch wandert die Gruppe als Ganzes langsam weiter, ohne als starre Formation oder enger Klumpen zu laufen.

Wird ein Tier der Gruppe beschossen, flieht dieses Tier und nur Gruppenmitglieder in höchstens 10 Mikrozellen Entfernung für fünf Sekunden individuell vom Angriff weg. Weiter entfernte Gruppenmitglieder bleiben unbeeinflusst. Während dieser Zeit gibt es keine Gruppensammelbewegung. Danach greift die normale Gewichtung wieder, sodass sich die Tiere mit der Zeit erneut sammeln.

Kühe und Schafe leben ebenfalls in kleinen Herden. Sie bewegen sich zielgerichteter und weniger zick-zack-förmig als Hasen; Schafe legen im Normalverhalten etwas weitere Strecken zurück als Kühe. Wilde Kühe und Schafe können vom Jäger gejagt werden. Eine Kuh hinterlässt Fleisch und Leder, ein Schaf Fleisch und Wolle.

Ein Kundschafter fängt wilde Kühe und Schafe ohne zusätzlichen Spielerbefehl ein: Sobald er höchstens **2 Micro-Tiles** von einem solchen Tier entfernt ist, wechselt es in Spielerbesitz. Ein kleines **❤️-Emoji** über dem Tier markiert den Besitz. Eigene Nutztiere sind keine Jagdziele mehr und laufen unmittelbar zu einem freien Platz in der Umgebung des Hauptquartiers. Nach der Ankunft bleiben sie als zählbare Tiere sichtbar und grasen dort ruhig: Sie stehen die meiste Zeit, laufen nur kurze Strecken und verteilen sich auf mehrere Plätze, statt sich direkt vor dem HQ zu stapeln. Ist ihr nächster Schritt kurzzeitig von einem anderen Tier belegt, warten sie zunächst; erst bei einer anhaltenden Blockade wählen sie einen neuen Weg. Kühe bewegen sich seltener und kürzer als Schafe. Das Hauptquartier zeigt die aktuelle Zahl eigener Kühe und Schafe. Tierarten und Fernangriffe sind bewusst allgemein modelliert. Weitere Tiere können eigene Bewegungs- und Fluchtparameter erhalten. Dieselbe Projektil-/Schussbasis soll später auch Fernkampfsoldaten tragen.

## Handbuch und Hilfe

Das In-App-Handbuch bleibt eine einzige modale Oberfläche mit einer Hauptnavigation zwischen den Themen-Seiten. Innerhalb der aktuellen Seite gibt es zusätzlich eine kompakte Schnellnavigation: Ein runder Listen-Button öffnet die vorhandenen Abschnitte und springt per Klick oder Tap direkt zur gewählten Überschrift. Die zweite Navigationsebene wird aus den Abschnittsüberschriften des Handbuchtexts abgeleitet, damit Inhalt und Navigation nicht getrennt gepflegt werden müssen.

## Darstellung, Zoom und Eingabe

Bewohner bleiben ungefähr so groß wie eine Mikrozelle. Namen, Beruf/Tätigkeit und getragene Waren liegen in Weltkoordinaten und skalieren mit der Karte. Bewohner werden visuell vor natürlichen Ressourcen, Büschen und losen Waren dargestellt, damit sie beim Überqueren nicht von diesen verdeckt werden.

Die Bedienoberfläche verwendet durchgehend ein Light-Theme für interaktive Komponenten. Menüs, Personen- und Gebäudeansichten, Kontextauswahl, Technologiebaum, Update-Hinweise und Dialoge nutzen helle Flächen mit dunkler Schrift; dunkle transparente Flächen dienen nur noch als Hintergrundabdunklung, wenn ein modaler oder fokussierter Modus die Karte visuell zurücknehmen soll.

Die Karte lässt sich per Mausrad und Pinch von 0,7× bis 10× zoomen. Gebäude-Sprites sollen deshalb genügend Quellauflösung für starken Zoom behalten; die Runtime skaliert sie auf ihre definierte Weltgröße, ohne den Master im Editor herunterzurechnen. Desktop und Touch bleiben getrennte Eingabemodelle mit derselben autoritativen Spielregel. Kurzer Tap/Klick und Drag dürfen sich nicht gegenseitig verschlechtern. Im normalen Kartenmodus selektiert ein kurzer Tap beziehungsweise Klick Personen, Gebäude oder Wegweiser, aber keine Bodenkachel. Auf Touch öffnet ein Long Press von ungefähr 450 ms direkt auf einer Person deren vorhandenes Kontextmenü; eine deutliche Fingerbewegung bricht den Long Press ab und bleibt normales Karten-Panning. Im Baumodus folgt der Ghost am Desktop der Maus und ein Linksklick platziert direkt; ein zusätzlicher „Bauen“-Button wird dort nicht angezeigt. Abbrechen funktioniert über den sichtbaren Abbrechen-Button oder `Esc`. Auf Touch verschiebt ein Tap nur den Ghost, Drag bewegt weiterhin die Karte und ein eigener „Bauen“-Button bestätigt die Platzierung.

## Neues Spiel, Speichern und Laden

Über das Spielmenü kann ein neues Spiel gestartet, gespeichert oder geladen werden. **Speichern legt den Spielstand immer direkt im Browser ab.** Ein noch nie gespeichertes neues Spiel öffnet dafür den Speichern-Dialog und erhält einen frei wählbaren Namen. Wurde die aktuelle Partie dagegen aus einem Browser-Spielstand geladen oder durch einen Datei-Import als Browser-Spielstand angelegt, aktualisiert **Spiel speichern** denselben Spielstand unmittelbar ohne weiteren Dialog und ohne Überschreib-Bestätigung. Der vorhandene Name und die stabile Save-ID bleiben dabei erhalten; Speicherzeit, Vorschaubild und gespeicherter Weltzustand werden aktualisiert. Das bewusste Ersetzen eines anderen vorhandenen Spielstands bleibt eine getrennte Aktion mit Bestätigung. Spielstände werden im Ladefenster mit Speicherzeit, Bewohnerzahl, Gebäudezahl und einem Vorschaubild angezeigt. Beim Speichern über den Dialog kann optional zusätzlich dieselbe JSON-Datei heruntergeladen werden.

Das Ladefenster zeigt die im Browser gespeicherten Spielstände. Zusätzlich kann dort eine Spielstand-Datei importiert werden. Ein erfolgreicher Import wird geladen und zugleich als neuer Browser-Spielstand gespeichert, sodass die Datei für spätere Ladevorgänge nicht erneut ausgewählt werden muss. Danach gilt auch dieser importierte Browser-Spielstand als aktuelle Partie und kann mit **Spiel speichern** direkt fortgeschrieben werden.

Jeder Browser-Spielstand erhält beim Speichern automatisch ein Vorschaubild der Siedlung. Für dessen Ausschnitt zählen ausschließlich alle nicht abgerissenen **Gebäude einschließlich Hauptquartier und Baustellen**. Felder, Wege, Bewohner, Ressourcen und lose Waren vergrößern den Bildausschnitt nicht. Die Vorschau lässt einen kleinen Rand um die äußeren Gebäude, behält das aktuelle Seitenverhältnis des Spiel-Canvas unverändert bei und verändert die aktuelle Spieler-Kamera nach dem Speichern nicht dauerhaft.

Lose Waren, die ein Freiluftarbeiter zu seiner persönlichen Arbeitsfahne zurückbringt, erhalten zuerst einen konkreten freien Ablageplatz **rund um die Fahne**. Der Arbeiter läuft selbst zu diesem Platz, bleibt dort für eine **einsekündige Ablageaktion** stehen und erzeugt erst danach den Bodenstapel. Die Fahnenzelle selbst bleibt frei; passende, noch nicht volle Stapel in der Umgebung dürfen weiterhin aufgefüllt werden. Das Aufheben physischer Bodenware dauert ebenfalls **eine Sekunde**; normale Übergaben an Gebäude und Lager behalten ihre eigene Transferzeit.

Der vollständige autoritative Simulationszustand bleibt menschenlesbares JSON. Browser-Speicherung, Download und Datei-Import verwenden dasselbe Saveformat. Dazu gehören auch die zuletzt gewählte Simulationsgeschwindigkeit sowie individuelle Zustände gebrauchter Werkzeuge und Schuhe in Personeninventaren, Lagern, Bodenstapeln und laufenden Transporten.

Räumliche Objekte werden weiterhin kompakt über ihre logische Position gespeichert; abgeleitete Tile- und Footprint-Snapshots sowie das Vorschaubild sind nicht Teil des autoritativen World-State-JSON. Für registrierte Gebäudetypen werden Grundriss, visueller Anker und blockierte Zellen beim Laden aus der **aktuellen** Registry-Definition rekonstruiert.

Die aktuelle Save-Version ist **6**. Die Version des visuellen Building-Schemas ist davon unabhängig. Frühere Save-Versionen oder ältere Datenformen werden bis v1 nicht migriert oder durch besondere Kompatibilitätslogik unterstützt.

## Noch offene spätere Produktentscheidungen

Nicht Teil dieses Schritts sind unter anderem:

- Umstellung der übrigen Gebäudetypen auf Editor-Definitionen,
- mehrere Gebäudeeingänge,
- Gebäudeanimationen oder komplexere Hitboxen,
- unterschiedliche Arbeitsradien nach Beruf oder Upgrade,
- Arbeitsflaggen für Produktions-Träger,
- gemeinsam genutzte Flaggen,
- Regeneration weiterer natürlicher Ressourcen und neue prozedurale Clusterregeln.

## Unveränderte Produktbereiche

Für den vollständigen aktuellen Stand gelten zusätzlich die Details in [`concept-detail.md`](../concept-detail.md), insbesondere Produktionsketten, Händler, Personenansicht, Technologiebaum und Handbuch. Wo ältere Detailtexte dem hier beschriebenen feinen Raster, den physischen Waren, lokalen Arbeitsbereichen, den aktuellen Gebäude-Definitionen oder den hier beschriebenen Freischaltregeln widersprechen, ist diese Datei maßgeblich.


## Character Lab

Neben dem Hauptspiel existiert unter `/character-lab/` ein eigenständiges Entwicklungswerkzeug für 3D-Bewohner. v1 dient ausschließlich dazu, blockige Charaktere, orthografisch-isometrische Darstellung, Posen und datengetriebene Animationen zu testen.

Der erste Charakter besteht aus Kopf, Torso, zwei Armen und zwei Beinen. Arme und Beine bewegen sich nur vorwärts/rückwärts; der Kopf kann seitlich sowie oben/unten drehen; der Torso kann kippen und sich seitlich eindrehen. Das Character Lab verwendet keine künstlichen Gelenkwinkelgrenzen. Animationen verwenden einen Fortschritt von 0 bis 1, können ihre Interpolation zwischen Linear und Ease-Varianten wählen und sind unabhängig von Gameplay-Dauer oder Simulationsregeln.

Das Tool kann Animations-JSON laden und exportieren und stellt seine Kernfunktionen zusätzlich über `window.characterLab` für spätere Agent-Automatisierung bereit. Das Beispiel `woodcut` zeigt eine etwa zehnsekündige Sequenz mit Axt, Root-Bewegung um drei Arbeitspositionen und insgesamt sechs Schlägen. Oberkörper-Gewichtsverlagerung, Torso-Yaw und seitliche, zum Baum orientierte Schritte machen den Ablauf dynamischer; die Blickrichtung wird aus jeder Arbeitsposition zum Baumzentrum berechnet. CI erzeugt dafür Übersichtsframes, dichte Bursts für alle sechs Schläge und ein WebM. Eine Integration ins Hauptspiel ist ausdrücklich ein späterer Schritt.

## Viehzüchterei und Nutztiere

Die Viehzüchterei ist der zentrale Betrieb für eingefangene Kühe und Schafe. Pro Spieler darf aktuell höchstens **eine** aktive Viehzüchterei einschließlich Baustelle existieren. Eine fertige Viehzüchterei ersetzt das Hauptquartier als Sammelpunkt für beide Nutztierrassen; nach ihrem Abriss sammeln sich die Tiere wieder beim Hauptquartier.

Die Viehzüchterei beschäftigt einen **Viehzüchter** und bis zu zwei **Träger**. Sie lagert höchstens zehn Weizen und zehn Wasser. Eine Zucht verbraucht vier Weizen und vier Wasser und benötigt zwei ausgewachsene, zuchtfähige Tiere derselben Art. Kühe und Schafe verwenden dieselbe Mechanik. Die Viehzüchterei versucht grundsätzlich abwechselnd Kühe und Schafe zu züchten; ist die nächste Art nicht zuchtfähig oder besitzt der Spieler bereits mindestens zwölf Tiere dieser Art, wird die andere Art versucht.

Bevor Tiere abgeholt werden, müssen **4 Weizen und 4 Wasser tatsächlich in der Viehzüchterei eingelagert** sein; reservierte oder noch transportierte Waren zählen nicht. Solange davon etwas fehlt, darf der Viehzüchter die fehlenden Zuchtressourcen selbst über die normale Warenbeschaffung holen und arbeitet dabei parallel zu den Trägern. Erst wenn die vollständige Menge im Gebäude liegt, holt der Viehzüchter die beiden ausgewählten Elterntiere **nacheinander physisch von der Weide ab**. Er läuft zum Tier und führt es anschließend zurück zur Viehzüchterei; das Tier folgt ihm sichtbar. Erst wenn beide Elterntiere im Gebäude angekommen sind, beginnt die eigentliche Zuchtzeit. Während dieser Phase gilt der Viehzüchter selbst als intern arbeitend: Sein Status ist **„Arbeitet“**, er wird nicht durch die Idle-Logik nach draußen geschickt und seine normale Bewohnerdarstellung bleibt wie bei anderen internen Produktionsarbeiten ausgeblendet. Nach Abschluss verlassen Eltern und Jungtier die Viehzüchterei wieder und verteilen sich auf der Weide rund um das Gebäude.

Nach zehn simulierten Sekunden eigentlicher Zucht entsteht ein Jungtier. Direkt nach Abschluss wird der Viehzüchter wieder in die normale Arbeitsplanung gegeben: Fehlen für die nächste Zucht Ressourcen, beschafft er sie wieder selbst; sind Ressourcen und passende Tiere vorhanden, beginnt der nächste Zuchtzyklus; nur wenn aktuell keine sinnvolle Folgeaufgabe möglich ist, wartet er. Es startet deutlich kleiner und wächst innerhalb von drei simulierten Minuten linear auf die volle Tiergröße. Eines der beiden Elterntiere erhält nach jeder erfolgreichen Zucht drei simulierte Minuten Zuchtpause. Jungtiere zählen bereits zum spielerweiten Bestand. Die Zahl zwölf ist eine Startgrenze für neue Zuchten und kein hartes Populationslimit: durch bereits laufende Vorgänge oder andere Zugänge darf der Bestand darüber liegen.

## Produktionsgebäude Stufe 2

Töpferei und Steinmetzhütte besitzen jeweils eine zweite Gebäudestufe. Sobald mindestens ein Bewohner **10 Erfahrungspunkte als Töpfer** erreicht hat, wird **Töpferei 2** dauerhaft freigeschaltet. Entsprechend schalten **10 Erfahrungspunkte als Steinmetz** die **Steinmetzhütte 2** dauerhaft frei.

Eine vorhandene Töpferei beziehungsweise Steinmetzhütte kann am bestehenden Standort ausgebaut werden. Der Ausbau ersetzt dieselbe Gebäudeinstanz; Personalzuweisungen und vorhandene Lagerinhalte bleiben grundsätzlich erhalten. Für den Ausbau werden nur die zusätzlichen Ausbauwaren benötigt:

- Töpferei → Töpferei 2: 2 Holz, 2 Bruchstein, 2 Backsteine.
- Steinmetzhütte → Steinmetzhütte 2: 2 Holz, 2 Bruchstein, 2 Steinquader.

Die zweite Stufe kann nach ihrer Freischaltung auch direkt neu gebaut werden. Ihre direkten Baukosten entsprechen den Kosten der ersten Stufe plus den Ausbaukosten. Damit kostet Töpferei 2 insgesamt 6 Holz, 2 Bruchstein und 2 Backsteine; Steinmetzhütte 2 kostet 6 Holz, 2 Bruchstein und 2 Steinquader.

Töpferei 2 behält die Backsteinproduktion und erhält zusätzlich **Dachziegel** aus 2 Lehm und 1 Holz. Steinmetzhütte 2 behält die Steinquaderproduktion und erhält zusätzlich **Marmor** aus 2 Bruchstein. Bei Gebäuden mit mehreren Rezepten wählt der Spieler die aktive Produktion. Ein Wechsel ist erst möglich, wenn kein laufender Produktionsvorgang und kein fertiger Output des bisherigen Rezepts mehr im Gebäude liegt.

Vor einem Ausbau wird der Grundriss der Zielstufe an genau demselben visuellen Anker geprüft. Das Bestandsgebäude selbst blockiert seinen Ausbau nicht; alle sonstigen normalen Platzierungsregeln gelten weiterhin. Ist der Zielgrundriss blockiert, kann der Spieler eine Blocker-Ansicht öffnen. Sie zeigt den Zielgrundriss und markiert blockierende Gebäude, natürliche Ressourcen, Gelände, Wegweiser, Bewohner oder lose Waren. Blockierende Gebäude können aus dieser Ansicht direkt ausgewählt werden. Der Ausbau verschiebt oder dreht ein Gebäude niemals automatisch. Soll die zweite Stufe an einem anderen Ort stehen, muss sie dort neu gebaut oder das Bestandsgebäude vorher abgerissen werden.

## Palisaden

Palisaden werden im Baumenu als Linienauftrag geplant. Der Spieler wählt zuerst einen Startpunkt und danach einen Zielpunkt. Beim Öffnen des Modus wird wie bei der Gebäudeplatzierung die gesamte aktuell gültige Wegweiser-Bauregion hervorgehoben; diese Anzeige bleibt beim Wählen von Start und Ziel sichtbar. Zwischen beiden Punkten verwendet die Vorschau die normale räumliche A*-Wegplanung auf grundsätzlich begehbarem Gras oder Weg und darf dadurch um Hindernisse herumführen. Bereits vorhandene Palisaden gelten für diese Planungs-A* ausdrücklich als durchquerbare Routenzellen und dürfen auch Start- oder Zielpunkt sein. Wie Gebäude dürfen Palisaden ausschließlich innerhalb der Orientierung eines platzierten Wegweisers liegen. Die A*-Vorschau verlässt diese Abdeckung nicht; liegt das Ziel außerhalb, endet der weiterhin gültige Bauabschnitt am letzten abgedeckten Schritt. Die Vorschau ist zusätzlich auf **höchstens 50 Routenschritte inklusive bestehender Palisaden** begrenzt. Liegt das Ziel weiter entfernt, ist das kein Fehler: Die Vorschau endet nach 50 Schritten und genau dieser Teil kann gebaut werden.

Jedes neu anzulegende Segment belegt genau eine Mikrokachel und kostet **1 Holz**. Bereits vorhandene Palisaden im geplanten Verlauf werden nicht erneut gebaut und verursachen keine Kosten. Die neuen Segmente werden als einzelne Baustellen angelegt. An einem Palisadensegment arbeitet höchstens **ein Bauarbeiter**; nach vollständig angeliefertem Holz dauert der eigentliche Bau **eine Simulationssekunde**. Bauarbeiter und Materialanlieferung benutzen eine erreichbare Nachbarzelle des Segments als Arbeitsposition. Dadurch kann bei parallelen oder eng benachbarten Palisaden automatisch von der jeweils erreichbaren Seite gebaut werden. Eine unfertige Palisade bleibt begehbar. Erst das fertige Segment blockiert Bewegung und beeinflusst danach normale Wegfindung.

Benachbarte fertige Palisaden verbinden sich automatisch in der Darstellung. Unfertige Segmente, die aktuell einem Bauarbeiter zugewiesen sind, tragen eine kleine blaue Flagge; diese Markierung verschwindet bei Verlust der Zuweisung oder Fertigstellung. Die Verbindung und die Reservierungsflagge sind rein visuell; Kosten, Blocking, Abriss und Speicherung bleiben segmentweise. Ein Segment kann einzeln abgerissen werden.


## Schule und Berufsausbildung

Die Schule ist ein verwaltbares Gebäude. Sie kostet **4 Holz, 2 Backsteine, 2 Steinblöcke und 2 Dachziegel**. Weil Dachziegel von Töpferei 2 hergestellt werden, setzt der Schulbau die fortgeschrittene Baustoffkette voraus.

Ausbildung wird von einem konkreten Schüler aus dessen Beruf-Menü gestartet. Wenn mindestens eine fertige Schule existiert, steht dort oben **„Erlernen in …“**. Bei mehreren Schulen wird zuerst die Schule gewählt, danach der Zielberuf und schließlich ein geeigneter Lehrer. Der bereits ausgewählte Bewohner ist automatisch der Schüler; eine gesonderte Schülerauswahl gibt es in dieser Version nicht. Als Ausbildungsziel erscheinen ausschließlich Berufe mit einer Erfahrungs-Voraussetzung, die der Schüler noch nicht auf normalem Weg wählen kann. Berufe ohne Erfahrungs-Voraussetzung sind direkt verfügbar und werden nicht über die Schule gelehrt.

Ein Unterricht besteht aktuell aus genau **einem Lehrer und einem Schüler**. Als Lehrer können Bewohner gewählt werden, die den Zielberuf nach den normalen Berufsregeln ausüben könnten und nicht bereits an einem anderen Unterricht beteiligt sind. Ein Lehrer kann während eines laufenden Unterrichts keinen zweiten Schüler oder weiteren Beruf unterrichten.

Lehrer und Schüler laufen physisch zur ausgewählten Schule. Der Unterricht beginnt erst, wenn beide dort angekommen sind, und dauert **60 simulierte Sekunden**. Währenddessen zeigt der Lehrer die Tätigkeit **„Unterrichtet“**, der Schüler **„Lernt“**. Hunger und Schlaf sinken mit derselben Rate wie während normaler Arbeit. Muss einer der beiden essen oder schlafen, pausiert der Unterricht; nach dem Bedürfnis kehrt die Person zur Schule zurück und der vorhandene Fortschritt wird fortgesetzt.

Der Gebäude-Dialog der Schule zeigt einen laufenden Unterricht direkt an: **Fortschritt in Prozent**, Zielberuf, Lehrer, Schüler und den aktuellen Zustand. Der Prozentwert basiert ausschließlich auf den bereits absolvierten Unterrichtsticks; Anmarsch und Bedürfnispausen erhöhen ihn nicht. Der Zustand unterscheidet laufenden Unterricht, Warten auf Teilnehmer und Pausen durch Hunger oder Schlaf. Ohne aktive Ausbildung steht dort **„Kein Unterricht“**.

Nach erfolgreichem Abschluss hat der Schüler den gewählten Beruf dauerhaft erlernt und kann ihn auch nach späteren Berufswechseln wieder auswählen. Er startet darin aber ohne zusätzliche praktische Berufserfahrung. Der Lehrer wird anschließend wieder seinem vorherigen Beruf und, sofern weiterhin möglich, seinem vorherigen Arbeitsplatz zugewiesen. Zusätzliche Waren werden während des Unterrichts aktuell nicht verbraucht.

## Verlinktes Handbuch und Wiki

Das Handbuch ist aktuell bewusst auf die vier datengetriebenen Kataloge **Berufe**, **Gebäude**, **Tiere** und **Waren** reduziert. Die Haupttabs sind alphabetisch nach ihrem deutschen Anzeigenamen sortiert. Reine allgemeine Textseiten werden vorerst nicht angeboten. Aus den vier Übersichten führen dynamisch erzeugte Detailseiten zu den jeweiligen Wissensobjekten.

Warenartikel zeigen produzierende und verwendende Gebäude, Produktionsrezepte sowie direkte Quellen aus Berufen und Tieren. Gebäudeartikel zeigen Baukosten, Produktion oder Funktion, Personal und vorhandene Ausbaukanten. Berufsartikel zeigen Voraussetzungen, Arbeitsplätze und Freischaltungen. Tierseiten zeigen Jagdbeute, relevante Berufe und bei Nutztieren die Viehzüchterei. Die Inhalte werden soweit möglich direkt aus den aktuellen Simulationsregeln erzeugt.

Im Spiel werden Wissensbegriffe dort verlinkt, wo sie bereits als UI-Information erscheinen. Im Baumenü bleiben Platzierung und Wiki getrennte Aktionen. Konkrete Gebäude und Personen bleiben Weltobjekte und sind keine Wiki-Artikel.

Das Handbuch pausiert die Simulation, solange es geöffnet ist, und stellt beim Schließen den vorherigen Laufzustand wieder her. Mehrfachlisten werden nach dem deutschen Anzeigenamen alphabetisch sortiert.

## Debug-Cheats

Das Debug-Menü besitzt zwei voneinander unabhängige, nur für die aktuelle Sitzung geltende Cheat-Schalter. **Technologien** behandelt alle implementierten Gebäudetechnologien als freigeschaltet, ohne den dauerhaften Freischaltzustand des Spielstands zu verändern. **Materialien** sorgt dafür, dass neu platzierte Gebäude, neu gestartete Gebäudeausbauten und neu angelegte Palisaden ihre vollständigen Baustoffe sofort als angeliefert erhalten; die normale Bauzeit bleibt bestehen. Bereits bestehende Baustellen werden beim Einschalten nicht nachträglich befüllt. Die Cheat-Schalter werden nicht im Savegame gespeichert.


### Menübedienung

In scrollenden Menüs bleibt die jeweilige Kopfzeile mit dem Schließen-Button beim Scrollen sichtbar. Im Debug-Menü stehen die beiden Cheat-Schalter direkt unter der festen Kopfzeile und damit vor Performance-, Aufnahme- und Personeninformationen.

## Gebäude-Freischaltungen

Gebäude werden erst freigeschaltet, wenn alle für sie geltenden Voraussetzungen erfüllt sind. Dazu gehören sowohl Voraussetzungen aus der Produktionskette als auch Qualifikation beziehungsweise Berufserfahrung der Bewohner. Benötigt ein Gebäude etwa eine Ware aus einer bestimmten Produktionsstätte, muss diese Produktionsstätte zuvor fertig errichtet worden sein; verlangt die Freischaltung einen ausreichend qualifizierten Bewohner, muss auch diese Voraussetzung erreicht sein.

Eine einmal erhaltene Gebäudefreischaltung bleibt dauerhaft bestehen. Wird später eine ursprünglich benötigte Produktionsstätte abgerissen oder ist kein entsprechend qualifizierter Bewohner mehr vorhanden, wird das bereits freigeschaltete Gebäude nicht wieder gesperrt.

Besitzt ein Gebäudetyp mehrere Stufen, wird jede Stufe separat freigeschaltet. Jede Stufe prüft ihre eigenen Voraussetzungen; eine niedrigere freigeschaltete Stufe schaltet spätere Stufen nicht automatisch mit frei.

## Wohnhäuser, Wohnungen und Haushalte

Wohnhäuser stellen Wohnungen statt einzelner Bewohnerplätze bereit. Eine Wohnung wird genau von einem Haushalt belegt. Ein Single, ein Ehepaar oder später ein Ehepaar mit beliebig vielen Kindern verbraucht jeweils genau eine Wohnung. Kinder erhöhen den Wohnungsverbrauch ihres Haushalts nicht.

Es gibt fünf Wohnhaus-Stufen: Stufe 1 hat 2 Wohnungen, Stufe 2 hat 3, Stufe 3 hat 4, Stufe 4 hat 5 und Stufe 5 hat 6 Wohnungen. Die Stufen sind bewusst als erweiterbare Hausstufen modelliert, damit spätere zusätzliche Vorteile wie Komfort oder andere Familienboni ergänzt werden können; aktuell erhöht eine Stufe nur die Wohnungszahl.

Die Bau- und Ausbaukosten sind:
- Stufe 1: 2 Bruchstein, 2 Holz, 1 Weizen und 2 Lehm.
- Stufe 2: zusätzlich 2 Holz und 2 Backsteine.
- Stufe 3: zusätzlich 2 Holz, 1 Backstein und 3 Steinblöcke.
- Stufe 4: zusätzlich 2 Holz, 1 Backstein, 1 Steinblock und 4 Dachziegel.
- Stufe 5: zusätzlich 2 Holz, 1 Backstein, 1 Steinblock, 1 Dachziegel und 5 Marmor.

Wohnhaus-Stufen erscheinen erst im Baumenü, wenn alle Produktionsgebäude vorhanden sind, die für ihre bis dahin benötigten Bauwaren erforderlich sind. Stufe 1 benötigt damit zuerst eine fertige Farm; Stufe 2 zusätzlich die Töpferei, Stufe 3 zusätzlich die Steinmetzhütte, Stufe 4 zusätzlich Töpferei 2 und Stufe 5 zusätzlich Steinmetzhütte 2 für Marmor. Eine einmal freigeschaltete Wohnhaus-Stufe bleibt dauerhaft freigeschaltet, auch wenn ein dafür ursprünglich nötiges Produktionsgebäude später abgerissen wird.

Eine höhere Stufe kann direkt gebaut werden. In diesem Fall werden die Kosten aller Stufen bis zum gewählten Ziel aufsummiert. Beim Ausbau eines bestehenden Wohnhauses werden nur die Kosten der nächsten Stufe verlangt. Die bereits vorhandenen Wohnungen bleiben während eines Ausbaus bewohnbar. Die zusätzliche Wohnung wird erst nach Abschluss des Ausbaus verfügbar.

Die Wohnungszuweisung erfolgt bewusst durch den Spieler über den Personenbefehl „Wohnung“. Im Kartenmodus werden nur fertige Wohnhäuser mit einer freien Wohnung sowie das bereits bewohnte Haus hervorgehoben. Die konkrete freie Wohnung innerhalb des Hauses wird automatisch gewählt. Der Wohnhausdialog zeigt jede Wohnung und ihren Haushalt; die dort aufgeführten Bewohner sind direkt anklickbar.

Bewohner mit zugewiesener Wohnung schlafen in ihrem eigenen Wohnhaus, sofern es erreichbar ist. Ist kein Weg dorthin möglich, dürfen sie lokal in der Natur oder auf dem Boden schlafen. Wohnungslose Erwachsene bleiben vollständig handlungsfähig und belegen kein Wohnhaus automatisch.

Für das spätere Familiensystem gilt bereits als Modellregel: Ein Kind bleibt Teil des Haushalts seiner Eltern und benötigt keine zusätzliche Wohnung. Mit der Volljährigkeit verlässt es den Elternhaushalt automatisch und erhält ausdrücklich keine automatische neue Wohnung.



## Fehlerzustand und Diagnose

Ein fataler Laufzeit- oder Startfehler darf das Spiel nicht in einem teilweise funktionsfähigen Zustand weiterlaufen lassen. In diesem Fall wird die Simulation angehalten und eine eindeutige Fehleransicht über das Spiel gelegt. Von dort kann der Spieler einen Crash-Report als JSON herunterladen und die Seite neu laden.

Der Crash-Report wird ausschließlich lokal erzeugt und nicht automatisch übertragen. Er enthält technische Diagnoseinformationen und, falls die Welt bereits angelegt war, einen Snapshot des aktuellen Spielzustands, damit ein gemeldeter Fehler reproduziert werden kann. Bei einem fatalen Laufzeitfehler versucht das Spiel zusätzlich, denselben aktuellen Weltzustand als separaten Browser-Crash-Spielstand zu sichern.

Browser-Spielstände unterscheiden manuelle Spielstände, Autosaves und die Crash-Sicherung. Autosaves laufen alle fünf realen Minuten unabhängig von Pause oder Simulationsgeschwindigkeit. Es existieren genau drei rollierende Autosave-Slots; nach dem dritten Slot wird jeweils der älteste überschrieben. Die Crash-Sicherung besitzt einen eigenen einzelnen Slot und überschreibt nur eine frühere Crash-Sicherung.

## Familie, Heirat und Kinder

Männer und Frauen funktionieren in der Simulation vollständig gleich: Beide können dieselben Berufe lernen, arbeiten, Bedürfnisse erfüllen und Wohnungen beziehen. Das Geschlecht ist nur für die derzeitige biologische Nachwuchsregel relevant, für die ein verheiratetes Paar aus Mann und Frau benötigt wird.

Der Spieler ordnet keine konkrete Ehe an. Ein unverheirateter Erwachsener erhält den Befehl „Partner suchen“. Sobald die aktuelle Arbeit sauber beendet werden kann, sucht die Person einen erreichbaren, unverheirateten Erwachsenen des anderen Geschlechts, reserviert diesen Kandidaten und läuft zu ihm. Beim Treffen wird sofort und dauerhaft geheiratet. Eltern und Kinder sowie Geschwister sind als Partner ausgeschlossen. Die Simulationsschnittstelle unterstützt denselben Auftrag für mehrere Personen, auch wenn die aktuelle Kartenauswahl weiterhin einzelne Personen fokussiert.

Nach der Heirat wohnen beide nach Möglichkeit zusammen: Hat nur einer eine Wohnung, zieht der andere dort ein. Haben beide verschiedene Wohnungen, wird zufällig eine der beiden Wohnungen als gemeinsamer Haushalt behalten und die andere frei. Haben beide keine Wohnung, bleiben beide wohnungslos. Eine Ehe bleibt unabhängig vom späteren Verlust einer Wohnung bestehen.

Die globale Nachwuchsstrategie wird im Hauptquartier als „Wenig“, „Mittel“ oder „Viele“ gesetzt. Wenig prüft geeignete Paare alle 3 Minuten mit 15 Prozent Chance, Mittel alle 2 Minuten mit 30 Prozent, Viele jede Minute mit 50 Prozent. Nach einer erfolgreichen Geburt gilt pro Haushalt ein fester Cooldown von 5 Minuten. Die Einstellung bestimmt nicht die Kinderzahl einer einzelnen Geburt.

Bei einer Geburt entstehen zu 90 Prozent ein Kind, zu 9 Prozent zwei Kinder und zu 1 Prozent drei Kinder. Ein geeignetes Paar muss verheiratet sein, einen gemeinsamen Haushalt und damit eine gemeinsame Wohnung besitzen. Wenn die automatische Geburtsentscheidung fällt, warten beide Eltern auf einen sauberen Aufgabenübergang und gehen gemeinsam nach Hause. Dort läuft eine feste 15-sekündige Familienzeit: In den ersten 5 Sekunden erscheinen nur Herzen über dem Haus und verschwinden exakt mit Beginn der nächsten Phase. Von Sekunde 5 bis 10 fliegt der Storch auf einer deutlich längeren, echten kreisförmigen und nach unten gewölbten Bogenbahn über das Haus. Er bewegt sich an den äußeren Bereichen der Bahn am schnellsten und wird zur Mitte über dem Haus nur moderat langsamer, ohne dort beinahe stehenzubleiben. In der ersten Hälfte trägt der Storch das Baby sichtbar im Schnabel; exakt bei 7,5 Sekunden, also in der Mitte des Flugs direkt über dem Haus, entstehen die Kinder und die Darstellung wechselt auf denselben Storch ohne Baby. Eltern und Kinder bleiben bis Sekunde 15 im Haus; erst dann endet die Familienzeit und normales Verhalten wird fortgesetzt. Beim Ende der Familienzeit steht der Schlafwert beider Eltern auf 100. Hunger und Schlaf dürfen die Familienaufgabe auf dem Weg zum Haus unterbrechen; nach erfülltem Bedürfnis wird sie fortgesetzt. Schwangerschaft, Elternzeit und geschlechtsspezifische Arbeitsausfälle werden bewusst nicht simuliert.

Kinder sind eigene Figuren, aber nicht steuerbar. Sie haben keine Bedürfnisse, keinen Beruf und keine Arbeit. Ihr Detailmenü ist vollständig read-only und zeigt ausschließlich Name, Eltern und Wohnhaus; Aktionsmenü, Ausrüstung und alle übrigen Erwachsenendaten werden ausgeblendet. Die Kindheit dauert exakt 5 simulierte Minuten. In den ersten 2,5 Minuten wird das Kind als Krabbelbaby dargestellt, in den zweiten 2,5 Minuten als laufendes Kind. Kinder wandern nur in der näheren Umgebung ihres Elternhauses (Radius 4 Weltkacheln). Sie benötigen keine zusätzliche Wohnung und bleiben Mitglied des Haushalts ihrer Eltern.

Mit Erreichen der Volljährigkeit verlässt die Person den Elternhaushalt automatisch. Sie wird zu einem normalen steuerbaren Erwachsenen mit normalen Hunger- und Schlafwerten, erhält aber ausdrücklich keine Wohnung automatisch. Eine Wohnung muss später durch den Spieler oder eine zukünftige Familienregel zugewiesen werden.

