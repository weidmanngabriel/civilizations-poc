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

Natürliche Ressourcen dürfen weder den Grundriss noch diesen Freiraum schneiden. Lose Waren dürfen im Freiraum liegen bleiben, aber nicht unter dem eigentlichen Gebäudegrundriss.

Beim Abriss wird die komplette belegte Fläche wieder frei. Eine zuvor überbaute Straße kehrt nicht zurück; die Fläche wird wie bisher zu Gras.

## Gebäudeeditor

Unter `/building-editor/` steht das interne Authoring-Werkzeug als eigene Unterseite zur Verfügung. Es wird für Desktop-Bedienung optimiert.

Die Arbeitsfläche soll die spätere Spielansicht räumlich zuverlässig vorwegnehmen. Rasterzentren und sichtbare Hex-Geometrie verwenden dieselbe Projektion wie das Spiel. Der Editor vergrößert Raster und Sprite nur gemeinsam für die Bearbeitung; dadurch bleibt ihre Größenrelation identisch zur späteren Runtime.

Die Sprite-Größe wird als Breite in der Spielwelt eingestellt, nicht mehr als Multiplikator der Bildpixel. Der Sprite-Anchor wird relativ zur Bildgröße gespeichert. So bleiben WYSIWYG-Ausrichtung und Größe auch dann identisch, wenn dieselbe Grafik später in einer anderen Auflösung vorliegt.

Im veröffentlichten Editor werden `building.json` und das **unveränderte** Sprite heruntergeladen. Der Export verkleinert oder recomprimiert die gewählte Bilddatei nicht. Dieses Dateipaar kann gemeinsam wieder importiert und vollständig weiterbearbeitet werden, sofern es dem aktuellen Schema entspricht. Bei lokaler Entwicklung kann derselbe Stand direkt nach `src/assets/buildings/<id>/` gespeichert werden.

Ältere Editor-/Building-Visual-Schemata werden nicht unterstützt oder migriert. Nur der aktuelle Schemastand ist verbindlich.

## Warten, Gebäude und Personal

Bewohner warten sichtbar außerhalb von Gebäuden, wenn gerade keine sinnvolle Tätigkeit ansteht. In der Personenansicht heißt dieser Zustand ausdrücklich **„Wartet“** statt „Arbeitet“. Freie Bewohner und untätige Bauarbeiter sammeln sich locker beim Hauptquartier. Abbauer warten bei ihrer persönlichen Arbeitsflagge. Zugewiesene Arbeiter und Träger warten bei ihrem Gebäude. Dabei wählen sie freie Standplätze in der näheren Umgebung, statt aufeinander oder starr am Eingang zu stehen. Ein bereits gewählter Warteplatz bleibt bei allgemeinen Neuberechnungen erhalten; freie Bewohner laufen deshalb nicht zwischendurch unnötig zum Hauptquartier zurück. Laufwege dürfen sich weiterhin kreuzen.

Während einer tatsächlichen Tätigkeit im Inneren eines **fertigen** Gebäudes ist die komplette normale Bewohnerdarstellung auf der Karte ausgeblendet, einschließlich Name, Tätigkeit und getragener Ware. Baustellen gelten noch nicht als Innenraum; Bauarbeiter und andere Personen bleiben dort auch während Warenübergaben sichtbar. Das gilt für passende Arbeits-, Ess- und Schlafvorgänge sowie für die drei Sekunden dauernde Abhol- oder Abladephase an einem Gebäude. Abholen von Bodenware oder natürlichen Ressourcen bleibt sichtbar, weil diese Tätigkeit außerhalb eines Gebäudes stattfindet. Auch am Brunnen bleibt der Bewohner sichtbar, da er ihn visuell nicht betritt. Bloßes Durchqueren begehbarer Gebäudeflächen blendet Bewohner ebenfalls nicht aus. Eine bestehende Auswahl bleibt erhalten; nur der Auswahlmarker bleibt am Eingang sichtbar. Beim Verlassen erscheint die Person wieder am Eingang.

Fertige Gebäude zeigen ihre Zuweisung zusätzlich direkt in der Welt: eine kleine blaue Flagge je Arbeiter und eine rote Flagge je Träger neben dem Eingang. Mehrere Flaggen werden kompakt gestapelt. Die Flaggen sind reine Darstellung und beeinflussen weder Kollision noch Wegfindung.

Wird ein Gebäude abgerissen, werden davon abhängige Tätigkeiten sofort beendet. Personen im Gebäude werden unmittelbar wieder sichtbar und planen anschließend aus dem neuen Weltzustand weiter.

## Arbeitsflaggen

Holzfäller, Lehmgräber, Steinbrecher, Fischer sowie Lager- und HQ-Träger besitzen einen lokalen Arbeitsbereich mit persönlicher Flagge. Der gemeinsame Radius beträgt **2,5 Weltkacheln**.

Abbauer wählen nur passende freie Rohstoffquellen innerhalb ihrer Flagge. **Jede einzelne abgebaute Einheit** wird vom Abbauer persönlich zur eigenen Arbeitsflagge getragen und erst dort als lose Ware gestapelt; erst danach arbeitet er weiter. Bei vollen Stapeln entstehen weitere Stapel möglichst dicht an der Flagge. Lager-/HQ-Träger holen nur Nicht-Lager-Quellen innerhalb ihrer Flagge. Wird eine Flagge verschoben, wird ein noch nicht abgeholtes Ziel außerhalb des neuen Bereichs verworfen; bereits getragene Ware wird noch zur aktuellen persönlichen Flagge gebracht.

Produktions-Träger behalten ihre bedarfsgetriebene Beschaffung. Arbeitsflaggen und Wegweiser bleiben getrennte Systeme.

## Wegweiser

Beim Spielstart steht ungefähr eine Weltkachel vor dem Hauptquartier ein erster Wegweiser. Weitere Wegweiser werden über das Baumenü platziert. Bereits beim Öffnen des Platzierungsmodus werden alle aktuell gültigen Positionen hervorgehoben. Auf dem Desktop folgt der Ghost der Maus und Linksklick platziert; Rechtsklick, Escape oder „Abbrechen“ beendet den Modus. Auf Touch wählt ein Tap die Position, Ziehen verschiebt weiter die Karte und „Platzieren“ bestätigt.

Jeder Wegweiser besitzt einen eigenen **Orientierungsradius von 2,5 Weltkacheln**. Dieser Wert ist fachlich getrennt vom gleich großen Arbeitsflaggen-Radius. Zwischen zwei Wegweisern müssen mindestens **2,5 Weltkacheln** liegen. Liegen zwei erreichbare Wegweiser höchstens **5 Weltkacheln** auseinander, werden sie miteinander verbunden.

Für jede Verbindung trägt ein Wegweiser ein eigenes kleines Richtungsschild, das in der isometrischen Kartenansicht auf den verbundenen Wegweiser zeigt.

Bewohner verwenden das Wegweisernetz verpflichtend für die grobe Navigation. Start → erster Wegweiser, Wegweiser → Wegweiser und letzter Wegweiser → Ziel werden weiterhin lokal über das feine Raster berechnet. Gibt es mehrere Netzrouten, wird die reale Reisezeit inklusive vorhandener Wege verglichen und die günstigste Route gewählt. Es gibt in der Spielerwelt keine globale Direktnavigation mehr. Fehlt ein gültiger Weg, bleibt die Person stehen und erhält einen gelben Hinweis. Derselbe erfolglose Weg wird nicht laufend neu gesucht; erst eine Änderung des Wegweisernetzes erlaubt für dieses Ziel wieder einen neuen Versuch.

### Fischer

Fischer sind Freiluftarbeiter ohne eigenes Gebäude. Ihre persönliche Arbeitsflagge begrenzt das Angelgebiet. Innerhalb dieses Bereichs suchen sie eine erreichbare, begehbare Zelle direkt am Wasser.

Sobald ein Fischer seinen Angelplatz erreicht, beginnt ein **fünf Sekunden langer Fangzyklus**: Die Angel wird ungefähr eine halbe Sekunde ausgeworfen, liegt rund vier Sekunden im Wasser und wird ungefähr eine halbe Sekunde eingeholt. Erst beim Einholen wird der Fang ausgewertet. Danach sucht der Fischer möglichst einen anderen Angelplatz innerhalb seiner Flagge. Wasser besitzt vorerst keinen erschöpfbaren Fischbestand.

Die Fangchance beträgt bei null Berufserfahrung **30 %** und steigt linear bis auf **80 %** bei voller Fischererfahrung. **Nur ein erfolgreicher Fang** zählt als abgeschlossene Berufsaktion und erhöht die Fischer-Erfahrung um einen Punkt; ein erfolgloser Fangversuch gibt keine Erfahrung.

Bei Erfolg trägt der Fischer genau **einen Fisch** persönlich zu seiner Arbeitsflagge. Erst dort wird der Fisch als physische lose Ware gestapelt und kann anschließend von geeigneten Trägern eingesammelt werden. **Jeder vollständig eingeholte Angelvorgang ist eine Aufgabengrenze:** Ist der Fischer dann hungrig, kümmert er sich zuerst um Essen, unabhängig davon, ob der Versuch erfolgreich war. Ein bereits gefangener Fisch bleibt dabei bei ihm und wird nach dem Essen zur Arbeitsflagge gebracht.

## Farmen und Felder

Die bestehenden Farmregeln bleiben unverändert. Ein Acker belegt vollständig seine feine Rasterfläche und darf beim Säen keine natürliche Ressource oder lose Ware überschreiben. Bereits reservierte Feldflächen und besetzte Zellen bleiben ebenfalls tabu.

Wird eine Farm abgerissen, verschwinden ihre aktiven Felder und die belegten Zellen werden wieder zu Gras.

## Wege

Die Grundgeschwindigkeit der Bewohner beträgt **5/6 Weltkachel pro Sekunde**. Die bestehende Regel bleibt: **8 Überquerungen innerhalb von 32 simulierten Sekunden** erzeugen einen dauerhaften Weg. Auf Wegen bewegen sich Bewohner mit Faktor **1,3×**.

Weder manuell gesetzte noch automatisch entstehende Wege dürfen eine aktive natürliche Ressourcenfläche überdecken.

## Hunger und Schlaf

Simulation und Bewegung laufen mit 60 Schritten pro Sekunde. Hunger wird nur einmal pro simulierter Sekunde aktualisiert und geprüft. Bestehende Ziele bleiben während einer Reise stabil, solange der Auftrag gültig ist. Bei **40 %** Hunger beziehungsweise Schlaf beginnt eine Person, an einer passenden Aufgabengrenze nach Essen oder Schlaf zu suchen. Diese Suchschwelle ist bewusst von der Warnanzeige getrennt.

Essen benötigt weiterhin fünf simulierte Sekunden am Ziel. Brot stellt 80 Hungerpunkte wieder her, Fisch 60 und ein Busch 40; Hunger bleibt immer auf maximal 100 begrenzt. Fisch kann aus Hauptquartier oder Lager sowie direkt von einem losen Fischstapel gegessen werden. Schlaf folgt den bestehenden Haus-/Natur-/Bodenregeln: zwei fünfsekündige Schlafphasen geben im Haus jeweils 50, unter Baum oder Busch jeweils 15 und auf dem Boden jeweils 5 Schlafpunkte. Schlaf bleibt ebenfalls auf maximal 100 begrenzt. Die Abnahme von Hunger und Schlaf verwendet wieder die ursprüngliche Geschwindigkeit. Schlaf pausiert die aktuelle Tätigkeit, entfernt aber weder Beruf noch Arbeitsplatz-/Ressourcenzuweisung; nach dem Aufwachen wird die vorhandene Aufgabe fortgesetzt. Bäume und Büsche sind beim Schlafen jeweils nur für eine Person gleichzeitig nutzbar. Dafür gibt es bewusst keine Reservierung: Mehrere Bewohner dürfen denselben Naturplatz ansteuern. Erst bei der Ankunft prüft ein Bewohner, ob dort bereits jemand schläft; ist der Platz belegt, plant er von dort aus ein anderes Schlafziel. Bodenschlaf hat keine solche Exklusivität.

## Berufserfahrung und Technologien

Erfahrung wird pro Person und Beruf von 0 bis 100 gespeichert und bleibt bei Berufswechsel erhalten. Jede erfolgreich abgeschlossene berufliche Tätigkeit gibt genau 1 Erfahrungspunkt; abgebrochene Tätigkeiten geben keinen Punkt.

Produktionsgebäude werden über die Qualifikation des vorgelagerten Berufs freigeschaltet: Sobald irgendeine Person 10 XP im zugeordneten Beruf erreicht, ist die entsprechende Produktionsstätte dauerhaft bekannt. So schaltet beispielsweise **Abbauer Stein** die Steinmetzhütte frei.

Zusätzlich koppelt die Gebäudeprogression an die tatsächlich aufgebaute Produktionskette. Benötigt ein Gebäude verarbeitete Bauwaren, wird es erst freigeschaltet, wenn für jede dieser Waren mindestens eine passende Produktionsstätte **fertig gebaut** ist. Rohstoffe wie Holz benötigen keine Produktionsstätte. Beispiel: Der Brunnen benötigt Quader und wird daher erst nach einer fertigen Steinmetzhütte freigeschaltet. Eine Baustelle genügt nicht. Bei Gebäuden mit eigener Berufsanforderung müssen Berufsqualifikation und alle nötigen Produktionsstätten erfüllt sein.

Freischaltungen sind dauerhaft. Wird die auslösende Produktionsstätte später abgerissen, bleibt das bereits bekannte Gebäude verfügbar. Wohnhaus und Farm sind von Anfang an verfügbar; der Brunnen nicht mehr.

## Gebäudehinweise

Gebäudehinweise sind Teil der Gebäudeübersicht und nicht in einem allgemeinen Benachrichtigungsmenü gesammelt. Analog zur Personenübersicht zeigt der Gebäude-Button kompakte Hinweiszähler und die Gebäudeübersicht kann nach Hinweisstufe filtern. Beim Schließen der Personen- oder Gebäudeübersicht werden Suche und Filter auf den Ausgangszustand zurückgesetzt, sodass jede neue Öffnung ungefiltert startet. Fertige Gebäude mit mindestens einem Arbeiterplatz zeigen einen wichtigen Hinweis, solange noch kein Arbeiter zugewiesen ist. Auf der Karte erscheint zusätzlich ein Ausrufezeichen am Gebäude. Ein Klick oder Tap auf Eintrag oder Marker zentriert die Kamera und öffnet das Gebäude. Nach einer Arbeiterzuweisung verschwindet der Hinweis; wird später wieder der letzte Arbeiter entfernt, erscheint er erneut.

## Personenhinweise

Die Personenübersicht bündelt aktuelle Probleme und Hinweise in drei Stufen: **kritisch**, **wichtig** und **Info**. Jede Person wird höchstens einmal gezählt und immer nur in ihrer schwersten aktuell zutreffenden Stufe. Hunger oder Müdigkeit erscheinen erst ab **30 %** als gelber wichtiger Hinweis und ab **20 %** als roter kritischer Hinweis. Personen zwischen 31 und 40 % können bereits selbständig nach Versorgung suchen, erscheinen aber noch nicht in diesen Warnfiltern. Freie Personen ohne Aufgabe erscheinen als Information. Holz-, Lehm- und Steinabbauer erhalten einen gelben wichtigen Hinweis **„Nichts mehr abzubauen“**, sobald in ihrem persönlichen Arbeitsbereich kein passendes, nicht erschöpftes Vorkommen mehr vorhanden ist.

Die drei Stufen sind direkt in der Personenübersicht filterbar und werden zusätzlich kompakt am Personen-Button angezeigt, damit dringende Probleme auch bei geschlossener Liste sichtbar bleiben. Die Klassifizierung wird höchstens einmal pro Sekunde aktualisiert. Eine Arbeitsblockade wird nur dann als eigener Hinweis gezeigt, wenn ihre Ursache zuverlässig aus dem Simulationszustand feststeht; bloßes Warten wird nicht als Ressourcenmangel interpretiert.

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
