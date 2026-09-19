# Produktkonzept

Diese Datei ist der aktuelle Einstieg in das Produktkonzept. Ausführliche unveränderte Regeln bleiben in [`concept-detail.md`](./concept-detail.md) dokumentiert. Bei Widersprüchen beschreibt diese Datei den neueren Stand.

Der abgeschlossene Umbau auf das feine Raster und physische Ressourcen ist in [`FINE_GRID_RESOURCE_REWORK_PLAN.md`](./FINE_GRID_RESOURCE_REWORK_PLAN.md) dokumentiert.

Bis Version 1 wird bewusst keine Rückwärtskompatibilität gepflegt, wenn dafür Sonderlogik nötig wäre. Alte Saves, Schemata, Zwischenstände oder Datenformen dürfen bei Änderungen brechen; der jeweils aktuelle Produktstand ist verbindlich.

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

Bewohner warten sichtbar außerhalb von Gebäuden, wenn gerade keine sinnvolle Tätigkeit ansteht. In der Personenansicht heißt dieser Zustand ausdrücklich **„Wartet“** statt „Arbeitet“. Beim Start einer neuen Welt werden die Bewohner bereits auf mehreren freien Mikrozellen etwas südlich des Hauptquartiers erzeugt, statt auf dessen Eingang gestapelt zu werden. Freie Bewohner und untätige Bauarbeiter bleiben danach grundsätzlich dort stehen, wo sie gerade sind. Steht eine untätige Person jedoch auf einer begehbaren Zelle, die noch zum Grundriss eines Gebäudes gehört, weicht sie auf einen nahen freien Standplatz außerhalb des Gebäudes aus. Abbauer warten bei ihrer persönlichen Arbeitsflagge. Zugewiesene Arbeiter und Träger warten bei ihrem Gebäude. Ein bereits gewählter Warteplatz bleibt bei allgemeinen Neuberechnungen erhalten. Laufwege dürfen sich weiterhin kreuzen.

Bewegungen innerhalb eines persönlichen Arbeitsbereichs werden lokal geplant und benötigen keinen Wegweiser. Das Wegweisernetz bleibt für die übergeordnete Navigation zwischen Gebieten zuständig.

Während einer tatsächlichen Tätigkeit im Inneren eines **fertigen** Gebäudes ist die komplette normale Bewohnerdarstellung auf der Karte ausgeblendet, einschließlich Name, Tätigkeit und getragener Ware. Baustellen gelten noch nicht als Innenraum; Bauarbeiter und andere Personen bleiben dort auch während Warenübergaben sichtbar. Das gilt für passende Arbeits-, Ess- und Schlafvorgänge sowie für die drei Sekunden dauernde Abhol- oder Abladephase an einem Gebäude. Abholen von Bodenware oder natürlichen Ressourcen bleibt sichtbar, weil diese Tätigkeit außerhalb eines Gebäudes stattfindet. Auch am Brunnen bleibt der Bewohner sichtbar, da er ihn visuell nicht betritt. Bloßes Durchqueren begehbarer Gebäudeflächen blendet Bewohner ebenfalls nicht aus. Eine bestehende Auswahl bleibt erhalten; nur der Auswahlmarker bleibt am Eingang sichtbar. Beim Verlassen erscheint die Person wieder am Eingang.

Fertige Gebäude zeigen ihre Zuweisung zusätzlich direkt in der Welt: eine kleine blaue Flagge je Arbeiter und eine rote Flagge je Träger neben dem Eingang. Mehrere Flaggen werden kompakt gestapelt. Die Flaggen sind reine Darstellung und beeinflussen weder Kollision noch Wegfindung.

Wird ein Gebäude abgerissen, werden davon abhängige Tätigkeiten sofort beendet. Personen im Gebäude werden unmittelbar wieder sichtbar und planen anschließend aus dem neuen Weltzustand weiter.

## Arbeitsflaggen

Holzfäller, Lehmgräber, Steinbrecher, Fischer sowie Lager- und HQ-Träger besitzen einen lokalen Arbeitsbereich mit persönlicher Flagge. Der gemeinsame Radius beträgt **2,5 Weltkacheln**.

Abbauer wählen nur passende freie Rohstoffquellen innerhalb ihrer Flagge. Die Flagge funktioniert für ihren Besitzer als persönlicher lokaler Navigations-Node: befindet sich die Person bereits im Arbeitsbereich, werden Wege zu dort liegenden Arbeitszielen direkt lokal berechnet. Wird die Flagge so versetzt, dass die Person außerhalb des neuen Bereichs steht, muss sie den neuen Bereich zunächst regulär über das globale Wegweisernetz erreichen. **Jede einzelne abgebaute Einheit** wird vom Abbauer persönlich zur eigenen Arbeitsflagge getragen und erst dort als lose Ware gestapelt; erst danach arbeitet er weiter. Bei vollen Stapeln entstehen weitere Stapel möglichst dicht an der Flagge. Lager-/HQ-Träger holen nur Nicht-Lager-Quellen innerhalb ihrer Flagge. Wird eine Flagge verschoben, wird ein noch nicht abgeholtes Ziel außerhalb des neuen Bereichs verworfen; bereits getragene Ware wird noch zur aktuellen persönlichen Flagge gebracht.

Produktions-Träger behalten ihre bedarfsgetriebene Beschaffung. Arbeitsflaggen und Wegweiser bleiben getrennte Systeme.

## Wegweiser

Beim Spielstart steht ungefähr eine Weltkachel vor dem Hauptquartier ein erster Wegweiser. Weitere Wegweiser werden nicht über das Baumenü, sondern durch einen **Kundschafter** errichtet. Der Kundschafter ist ein frei wählbarer Beruf und kann beliebig viele Wegweiser nacheinander bauen. In seinem Personen-Kontextmenü startet **Wegweiser** den bekannten Platzierungsmodus. Bereits beim Öffnen werden alle aktuell gültigen Positionen hervorgehoben. Auf dem Desktop folgt der Ghost der Maus und Linksklick wählt die Zielstelle; Rechtsklick, Escape oder „Abbrechen“ beendet den Modus. Auf Touch wählt ein Tap die Position, Ziehen verschiebt weiter die Karte und der Bestätigungsbutton erteilt den Auftrag.

Nach der Bestätigung läuft der konkrete Kundschafter selbst zur Zielstelle. Kundschafter sind grundsätzlich **nicht an das Wegweisernetz gebunden** und dürfen direkt über begehbares Terrain navigieren, auch wenn das Ziel außerhalb des bestehenden Netzes liegt. Dieselbe Grundregel soll später auch für Soldaten gelten. Erst an der Zielstelle beginnt der Bau. Das Errichten dauert **eine simulierte Sekunde**, verbraucht **keine Ressourcen** und endet mit dem normalen Anlegen und Verbinden des Wegweisers. Der Wegweiser selbst und die sechs direkt angrenzenden Mikrozellen dürfen nicht von einem Gebäudegrundriss belegt werden. Wegweiser können angeklickt und über ihr eigenes Menü wieder abgerissen werden; ihre Verbindungen werden dabei entfernt.

Jeder Wegweiser besitzt einen **Orientierungsradius von 3,5 Weltkacheln**. Der Mindestabstand zwischen zwei Wegweisern entspricht demselben Radius, also **3,5 Weltkacheln**. Die maximale direkte Verbindungsdistanz ist doppelt so groß, also **7 Weltkacheln**. Damit verbinden sich erreichbare Wegweiser bei einem Abstand von 3,5 bis 7 Weltkacheln.

Für jede Verbindung trägt ein Wegweiser ein eigenes kleines Richtungsschild, das in der isometrischen Kartenansicht auf den verbundenen Wegweiser zeigt.

Bewohner verwenden das Wegweisernetz verpflichtend für die grobe Erreichbarkeit, müssen die Wegweiser selbst aber nicht betreten. Liegen Start und Ziel im Bereich desselben Wegweisers oder zweier direkt verbundener Nachbar-Wegweiser, wird der Weg direkt über das feine Raster berechnet. Bei längeren Reisen ab drei beteiligten Wegweisern bestimmt das Wegweisernetz zuerst eine grobe Node-Kette; die eigentliche Wegsuche bleibt anschließend auf den gemeinsamen Korridor dieser Orientierungsbereiche begrenzt. Dadurch bleiben lange Suchen klein, ohne künstliche Schleifen über die Wegweiser-Kacheln zu erzeugen. Eine bereits begonnene Route bleibt stabil: neu entstehende, gesetzte oder entfernte Wege lösen unterwegs keine globale Neuplanung aus und beeinflussen erst die nächste Routenwahl. Es gibt in der Spielerwelt keine Direktnavigation, die fehlende Wegweiser-Verbindungen umgeht. Fehlt ein gültiger Weg, bleibt die Person stehen und erhält einen gelben Hinweis. Derselbe erfolglose Weg wird nicht laufend neu gesucht; erst eine Änderung des Wegweisernetzes erlaubt für dieses Ziel wieder einen neuen Versuch.

Für **Hunger und Schlaf** besitzt jeder normale Bewohner zusätzlich eine lokale Suche mit demselben Radius wie ein Wegweiser, also **3,5 Weltkacheln** um seine Position beim Start der Bedarfssuche. Innerhalb dieses Radius darf er direkt über das feine Raster navigieren, auch wenn der Weg kurz aus der Wegweiserabdeckung herausführt. Beginnt die Bedarfssuche innerhalb einer Wegweiserabdeckung und verlässt der lokale Weg diese Abdeckung, kehrt der Bewohner nach Essen oder Schlafen zuerst zu seiner Startposition zurück und nimmt erst dort seine normale Aufgabe wieder auf. Findet die lokale Suche kein brauchbares Ziel, gilt wieder die normale globale Wegweiser-Navigation.

**Kundschafter** sind von dieser Einschränkung vollständig ausgenommen: Sie verwenden für alle Ziele globales direktes Pathfinding über begehbares Terrain und benötigen keine Wegweiserverbindung. **Soldaten** sollen dieselbe Navigationsklasse verwenden, sobald dieser Beruf im Prototyp eingeführt wird.

### Fischer

Fischer sind Freiluftarbeiter ohne eigenes Gebäude. Ihre persönliche Arbeitsflagge begrenzt das Angelgebiet. Innerhalb dieses Bereichs suchen sie eine erreichbare, begehbare Zelle direkt am Wasser.

Sobald ein Fischer seinen Angelplatz erreicht, beginnt ein **fünf Sekunden langer Fangzyklus**: Die Angel wird ungefähr eine halbe Sekunde ausgeworfen, liegt rund vier Sekunden im Wasser und wird ungefähr eine halbe Sekunde eingeholt. Erst beim Einholen wird der Fang ausgewertet. Danach sucht der Fischer möglichst einen anderen Angelplatz innerhalb seiner Flagge. Wasser besitzt vorerst keinen erschöpfbaren Fischbestand.

Die Fangchance beträgt bei null Berufserfahrung **30 %** und steigt linear bis auf **80 %** bei voller Fischererfahrung. **Nur ein erfolgreicher Fang** zählt als abgeschlossene Berufsaktion und erhöht die Fischer-Erfahrung um einen Punkt; ein erfolgloser Fangversuch gibt keine Erfahrung.

Bei Erfolg trägt der Fischer genau **einen Fisch** persönlich zu seiner Arbeitsflagge. Erst dort wird der Fisch als physische lose Ware gestapelt und kann anschließend von geeigneten Trägern eingesammelt werden. Nach einem Fehlfang muss er dagegen nicht zur Flagge zurückkehren, sondern darf direkt einen weiteren Angelplatz innerhalb seines lokalen Bereichs ansteuern. **Jeder vollständig eingeholte Angelvorgang ist eine Aufgabengrenze:** Ist der Fischer dann hungrig, kümmert er sich zuerst um Essen, unabhängig davon, ob der Versuch erfolgreich war. Ein bereits gefangener Fisch bleibt dabei bei ihm und wird nach dem Essen zur Arbeitsflagge gebracht.

## Farmen und Felder

Die Farm übernimmt für ihren Farmer dieselbe Rolle wie eine lokale Arbeitsflagge, ohne dass dafür eine sichtbare persönliche Flagge existiert. Die Farm ist der lokale Navigations-Node; die Felder liegen in ihrem Arbeitsumfeld. Die Anreise von außerhalb dieses Bereichs benötigt das globale Wegweisernetz. Innerhalb des Farmbereichs läuft die Arbeitsnavigation lokal. Nach Säen oder Düngen kehrt der Farmer zuerst zur Farm zurück, bevor er eine neue Aufgabe beginnt. Nach einer Ernte bringt er den Weizen ohnehin zur Farm zurück.

Ein Acker belegt vollständig seine feine Rasterfläche und darf beim Säen keine natürliche Ressource oder lose Ware überschreiben. Bereits reservierte Feldflächen und besetzte Zellen bleiben ebenfalls tabu.

Wird eine Farm abgerissen, verschwinden ihre aktiven Felder und die belegten Zellen werden wieder zu Gras.

## Wege

Die Grundgeschwindigkeit der Bewohner beträgt **5/6 Weltkachel pro Sekunde**. Die bestehende Regel bleibt: **8 Überquerungen innerhalb von 32 simulierten Sekunden** erzeugen einen dauerhaften Weg. Auf Wegen bewegen sich Bewohner mit Faktor **1,3×**.

Weder manuell gesetzte noch automatisch entstehende Wege dürfen eine aktive natürliche Ressourcenfläche überdecken.

## Hunger und Schlaf

Simulation und Bewegung laufen mit 60 Schritten pro Sekunde. Hunger wird nur einmal pro simulierter Sekunde aktualisiert und geprüft. Bestehende Ziele bleiben während einer Reise stabil, solange der Auftrag gültig ist. Bei **40 %** Hunger beziehungsweise Schlaf beginnt eine Person, an einer passenden Aufgabengrenze nach Essen oder Schlaf zu suchen. Diese Suchschwelle ist bewusst von der Warnanzeige getrennt.

Essen benötigt weiterhin fünf simulierte Sekunden am Ziel. Brot stellt 80 Hungerpunkte wieder her, Fisch 60 und ein Busch 40; Hunger bleibt immer auf maximal 100 begrenzt. Fisch kann aus Hauptquartier oder Lager sowie direkt von einem losen Fischstapel gegessen werden. Schlaf folgt den bestehenden Haus-/Natur-/Bodenregeln: zwei fünfsekündige Schlafphasen geben im Haus jeweils 50, unter Baum oder Busch jeweils 15 und auf dem Boden jeweils 5 Schlafpunkte. Schlaf bleibt ebenfalls auf maximal 100 begrenzt. Die Abnahme von Hunger und Schlaf ist gegenüber der vorherigen Balance halbiert, damit die Versorgung trotz lokal begrenzter Wegweiser-Erreichbarkeit im frühen Spiel mehr Spielraum lässt. Schlaf pausiert die aktuelle Tätigkeit, entfernt aber weder Beruf noch Arbeitsplatz-/Ressourcenzuweisung; nach dem Aufwachen wird die vorhandene Aufgabe fortgesetzt. Bäume und Büsche sind beim Schlafen jeweils nur für eine Person gleichzeitig nutzbar. Dafür gibt es bewusst keine Reservierung: Mehrere Bewohner dürfen denselben Naturplatz ansteuern. Erst bei der Ankunft prüft ein Bewohner, ob dort bereits jemand schläft; ist der Platz belegt, plant er von dort aus ein anderes Schlafziel. Bodenschlaf hat keine solche Exklusivität.

## Berufserfahrung und Technologien

Erfahrung wird pro Person und Beruf von 0 bis 100 gespeichert und bleibt bei Berufswechsel erhalten. Jede erfolgreich abgeschlossene berufliche Tätigkeit gibt genau 1 Erfahrungspunkt; abgebrochene Tätigkeiten geben keinen Punkt.

Höherwertige Produktionsberufe sind personenbezogen an 10 XP im direkten Vorgängerberuf gebunden: Abbauer Holz → Sägewerker → Schreiner, Abbauer Lehm → Töpfer, Abbauer Stein → Steinmetz sowie Farmer → Müller → Bäcker. Basisberufe bleiben frei wählbar. Ein Bewohner kann einen Folge-Beruf erst erhalten, wenn er selbst die nötige Erfahrung gesammelt hat. Das Berufe-Menü zeigt nur die für die ausgewählte Person aktuell verfügbaren Berufe; gesperrte Berufe werden dort nicht aufgeführt. Dieselbe Qualifikationsprüfung gilt bei der direkten Personalauswahl an Produktionsgebäuden.

Produktionsgebäude werden über die Qualifikation des vorgelagerten Berufs freigeschaltet: Sobald irgendeine Person 10 XP im zugeordneten Beruf erreicht, ist die entsprechende Produktionsstätte dauerhaft bekannt. So schaltet beispielsweise **Abbauer Stein** die Steinmetzhütte frei.

Zusätzlich koppelt die Gebäudeprogression an die tatsächlich aufgebaute Produktionskette. Benötigt ein Gebäude verarbeitete Bauwaren, wird es erst freigeschaltet, wenn für jede dieser Waren mindestens eine passende Produktionsstätte **fertig gebaut** ist. Rohstoffe wie Holz benötigen keine Produktionsstätte. Beispiel: Der Brunnen benötigt Quader und wird daher erst nach einer fertigen Steinmetzhütte freigeschaltet. Eine Baustelle genügt nicht. Bei Gebäuden mit eigener Berufsanforderung müssen Berufsqualifikation und alle nötigen Produktionsstätten erfüllt sein.

Freischaltungen sind dauerhaft. Wird die auslösende Produktionsstätte später abgerissen, bleibt das bereits bekannte Gebäude verfügbar. Wohnhaus und Farm sind von Anfang an verfügbar; der Brunnen nicht mehr.

## Gebäudehinweise

Gebäudehinweise sind Teil der Gebäudeübersicht und nicht in einem allgemeinen Benachrichtigungsmenü gesammelt. Analog zur Personenübersicht zeigt der Gebäude-Button kompakte Hinweiszähler und die Gebäudeübersicht kann nach Hinweisstufe filtern. Beim Schließen der Personen- oder Gebäudeübersicht werden Suche und Filter auf den Ausgangszustand zurückgesetzt, sodass jede neue Öffnung ungefiltert startet. Fertige Gebäude mit mindestens einem Arbeiterplatz zeigen einen wichtigen Hinweis, solange noch kein Arbeiter zugewiesen ist. Auf der Karte erscheint zusätzlich ein Ausrufezeichen am Gebäude. Ein Klick oder Tap auf Eintrag oder Marker zentriert die Kamera und öffnet das Gebäude. Nach einer Arbeiterzuweisung verschwindet der Hinweis; wird später wieder der letzte Arbeiter entfernt, erscheint er erneut.

## Personenhinweise

Die Personenübersicht bündelt aktuelle Probleme und Hinweise in drei Stufen: **kritisch**, **wichtig** und **Info**. Jede Person wird höchstens einmal gezählt und immer nur in ihrer schwersten aktuell zutreffenden Stufe. Hunger oder Müdigkeit erscheinen erst ab **30 %** als gelber wichtiger Hinweis und ab **20 %** als roter kritischer Hinweis. Personen zwischen 31 und 40 % können bereits selbständig nach Versorgung suchen, erscheinen aber noch nicht in diesen Warnfiltern. Freie Personen ohne Aufgabe erscheinen als Information. Holz-, Lehm- und Steinabbauer erhalten einen gelben wichtigen Hinweis **„Nichts mehr abzubauen“**, sobald in ihrem persönlichen Arbeitsbereich kein passendes, nicht erschöpftes Vorkommen mehr vorhanden ist.

Die drei Stufen sind direkt in der Personenübersicht filterbar und werden zusätzlich kompakt am Personen-Button angezeigt, damit dringende Probleme auch bei geschlossener Liste sichtbar bleiben. Die Klassifizierung wird höchstens einmal pro Sekunde aktualisiert. Eine Arbeitsblockade wird nur dann als eigener Hinweis gezeigt, wenn ihre Ursache zuverlässig aus dem Simulationszustand feststeht; bloßes Warten wird nicht als Ressourcenmangel interpretiert.

## Direkte Personensteuerung

Bewohner werden einzeln ausgewählt. Die normale Auswahl zeigt nur kompakte Personeninformationen; die eigentlichen Befehle liegen in einem separaten Kontextmenü. Auf Mobile bleibt dieses Personen-Flyout bewusst kompakt und ohne internes Scrollen: es sitzt direkt am unteren Bildschirmrand, der Aktionsbutton steht links oben, Schließen rechts oben und die Stammdaten bleiben einzeilig ohne Umbruch. Die Pfeilnavigation zwischen Personen ist dort nicht Teil des Flyouts. Am Desktop öffnet die **Leertaste** dieses Menü, zusätzlich steht auf allen Eingabegeräten der sichtbare Aktionsbutton zur Verfügung.

Das Kontextmenü besitzt dauerhaft **16 feste Slots** als hohles Quadrat ohne Ecken. Nicht verfügbare Aktionen werden nicht ausgegraut, sondern gar nicht angezeigt; ihre Position bleibt leer, damit spätere Aktionen ergänzt werden können, ohne gelernte Positionen zu verschieben.

Der erste verbindliche Aktionssatz ist:

- oben: **Beruf**, **Arbeitsplatz**, **Wohnung**, **Arbeitsbereich**;
- rechts: **Bewegen**, **Essen**, **Schlafen**;
- alle übrigen Slots bleiben vorerst leer.

Arbeitsbereich erscheint nur bei Personen mit persönlicher Arbeitsflagge. Arbeitsplatz und Wohnung wechseln in einen Karten-Auswahlmodus, in dem nur gültige Ziele hervorgehoben werden. Bewegen wartet auf eine Zielzelle. Direkte Bewegungsbefehle haben bis zur Ankunft Vorrang vor normaler Autonomie; danach setzt die Person ihre reguläre Tätigkeit fort. Ein bewusst ausgelöster Ess- oder Schlafbefehl startet die bereits vorhandene Bedürfnislogik sofort. Eine zugewiesene Wohnung wird beim Schlafen gegenüber anderen Häusern bevorzugt.

Beruf und Arbeitsplatz sind getrennte Entscheidungen. Ein Bewohner kann daher einen Beruf besitzen, ohne bereits einen passenden Arbeitsplatz zu haben. Berufserfahrung bleibt wie bisher personenbezogen erhalten.

Gebäude weisen Personal **nicht mehr über Plus/Minus-Regler automatisch zu**. Stattdessen zeigen fertige Gebäude ihre vorhandenen Personalplätze je Rolle. Besetzte Plätze zeigen Name und aktuelle Tätigkeit als anklickbaren Personeneintrag; Tippen oder Klicken wählt diese konkrete Person und zentriert die Kamera auf sie. Ein freier Platz öffnet über **Geeignete Personen** die Personenübersicht in einem Zuweisungsmodus. Solange keine zusätzlichen Eignungsregeln existieren, stehen dort alle anderen Bewohner zur Auswahl. Die Liste priorisiert zuerst Bewohner mit bereits passendem Beruf aber ohne Arbeitsplatz, danach freie Bewohner ohne Beruf und zuletzt alle übrigen geeigneten Bewohner; innerhalb jeder Gruppe wird alphabetisch nach Name sortiert. Wird eine bereits beschäftigte Person gewählt, muss der Wechsel bestätigt werden.

Auswahllisten werden nach sichtbarer Bezeichnung alphabetisch sortiert. **Wegweiser** ist kein Baumenü-Eintrag mehr, sondern eine kontextsensitive Aktion des Berufs **Kundschafter**. **Pause/Fortsetzen**, Simulationsgeschwindigkeit und **Debug** liegen im Spielmenü statt dauerhaft über der Karte. Das Personen-Kontextmenü schließt sich nach einer erfolgreich gestarteten Aktion sowie immer dann, wenn ein anderes Hauptmenü geöffnet wird.

## Darstellung, Zoom und Eingabe

Bewohner bleiben ungefähr so groß wie eine Mikrozelle. Namen, Beruf/Tätigkeit und getragene Waren liegen in Weltkoordinaten und skalieren mit der Karte. Bewohner werden visuell vor natürlichen Ressourcen, Büschen und losen Waren dargestellt, damit sie beim Überqueren nicht von diesen verdeckt werden.

Die Karte lässt sich per Mausrad und Pinch von 0,7× bis 10× zoomen. Gebäude-Sprites sollen deshalb genügend Quellauflösung für starken Zoom behalten; die Runtime skaliert sie auf ihre definierte Weltgröße, ohne den Master im Editor herunterzurechnen. Desktop und Touch bleiben getrennte Eingabemodelle mit derselben autoritativen Spielregel. Kurzer Tap/Klick und Drag dürfen sich nicht gegenseitig verschlechtern. Im Baumodus folgt der Ghost am Desktop der Maus und ein Linksklick platziert direkt; ein zusätzlicher „Bauen“-Button wird dort nicht angezeigt. Abbrechen funktioniert über den sichtbaren Abbrechen-Button oder `Esc`. Auf Touch verschiebt ein Tap nur den Ghost, Drag bewegt weiterhin die Karte und ein eigener „Bauen“-Button bestätigt die Platzierung.

## Neues Spiel, Speichern und Laden

Über das Spielmenü kann ein neues Spiel gestartet, gespeichert oder geladen werden. Der vollständige autoritative Simulationszustand wird als menschenlesbare JSON-Datei gespeichert.

Räumliche Objekte werden weiterhin kompakt über ihre logische Position gespeichert; abgeleitete Tile- und Footprint-Snapshots werden nicht persistiert. Für registrierte Gebäudetypen werden Grundriss, visueller Anker und blockierte Zellen beim Laden aus der **aktuellen** Registry-Definition rekonstruiert.

Die aktuelle Save-Version ist **3**. Die Version des visuellen Building-Schemas ist davon unabhängig. Frühere Save-Versionen oder ältere Datenformen werden bis v1 nicht migriert oder durch besondere Kompatibilitätslogik unterstützt.

## Noch offene spätere Produktentscheidungen

Nicht Teil dieses Schritts sind unter anderem:

- Umstellung der übrigen Gebäudetypen auf Editor-Definitionen,
- mehrere Gebäudeeingänge,
- Gebäudeanimationen oder komplexere Hitboxen,
- unterschiedliche Arbeitsradien nach Beruf oder Upgrade,
- Arbeitsflaggen für Produktions-Träger,
- gemeinsam genutzte Flaggen,
- Ressourcen-Regeneration und neue prozedurale Clusterregeln.

## Unveränderte Produktbereiche

Für den vollständigen aktuellen Stand gelten zusätzlich die Details in [`concept-detail.md`](./concept-detail.md), insbesondere Produktionsketten, Händler, Personenansicht, Technologiebaum und Handbuch. Wo ältere Detailtexte dem hier beschriebenen feinen Raster, den physischen Waren, lokalen Arbeitsbereichen, den aktuellen Gebäude-Definitionen oder den hier beschriebenen Freischaltregeln widersprechen, ist diese Datei maßgeblich.


## Character Lab

Neben dem Hauptspiel existiert unter `/character-lab/` ein eigenständiges Entwicklungswerkzeug für 3D-Bewohner. v1 dient ausschließlich dazu, blockige Charaktere, orthografisch-isometrische Darstellung, Posen und datengetriebene Animationen zu testen.

Der erste Charakter besteht aus Kopf, Torso, zwei Armen und zwei Beinen. Arme und Beine bewegen sich nur vorwärts/rückwärts; der Kopf kann seitlich sowie oben/unten drehen; der Torso kann kippen und sich seitlich eindrehen. Das Character Lab verwendet keine künstlichen Gelenkwinkelgrenzen. Animationen verwenden einen Fortschritt von 0 bis 1, können ihre Interpolation zwischen Linear und Ease-Varianten wählen und sind unabhängig von Gameplay-Dauer oder Simulationsregeln.

Das Tool kann Animations-JSON laden und exportieren und stellt seine Kernfunktionen zusätzlich über `window.characterLab` für spätere Agent-Automatisierung bereit. Das Beispiel `woodcut` zeigt eine etwa zehnsekündige Sequenz mit Axt, Root-Bewegung um drei Arbeitspositionen und insgesamt sechs Schlägen. Oberkörper-Gewichtsverlagerung, Torso-Yaw und seitliche, zum Baum orientierte Schritte machen den Ablauf dynamischer; die Blickrichtung wird aus jeder Arbeitsposition zum Baumzentrum berechnet. CI erzeugt dafür Übersichtsframes, dichte Bursts für alle sechs Schläge und ein WebM. Eine Integration ins Hauptspiel ist ausdrücklich ein späterer Schritt.
