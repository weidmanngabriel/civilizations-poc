# PoC 1 – Implementierungsplan

Dieser Plan dient als Übergabedokument für einen separaten Implementierungsagenten. Vor Beginn der Implementierung müssen `agents.md`, `architecture.md` und `concept.md` gelesen werden. Bei Widersprüchen haben `agents.md` und aktuelle Nutzeranweisungen Vorrang.

## Ziel des PoC

PoC 1 soll eine kleine, verständliche, rundenbasierte Produktions- und Logistiksimulation auf einer festen Hex-Karte zeigen. Der Kern ist eine personenbasierte Wirtschaft: Waren entstehen nur durch zugewiesene Personen, Personen bewegen sich sichtbar über das Wegenetz, Produktionsarbeiter beschaffen fehlende Inputs selbst und zugewiesene Träger unterstützen konkrete Arbeitsstätten.

Der PoC ist erfolgreich, wenn eine vollständige Kette von Wald über Sägewerk und Schreinerei bis ins Lager sichtbar funktioniert und der Spieler die Arbeitskräfte während des laufenden Spiels umverteilen kann.

## Verbindliche bestehende Entscheidungen

Die fachlichen Regeln stehen in `concept.md`. Die technischen Grundregeln stehen in `architecture.md`. Insbesondere gelten:

- TypeScript + Vite + Phaser 4.
- Die Simulation bleibt vollständig unabhängig von Phaser.
- `src/simulation/` darf Phaser nicht importieren.
- Die sichtbare Karte ist ein festes Hex-Grid.
- Gebäude belegen genau ein Hexfeld.
- Nur Weg- und Gebäudefelder sind begehbar.
- Wiese, Berg und Fluss sind im PoC nicht begehbar.
- Jede Bewegung über eine benachbarte begehbare Hexkachel kostet eine Runde.
- Produktion dauert immer 5 Runden.
- Verarbeitende Rezepte verbrauchen 2 Input und erzeugen 1 Output.
- Figuren tragen pro Transport genau 1 Wareneinheit.
- Normale Gebäude/Rohstoffquellen haben 10 Input-Plätze und 3 Output-Plätze; das Lager ist unbegrenzt.
- Startbevölkerung: 8 Personen, aber kein dauerhaftes Bevölkerungslimit.
- Wald: 0–2 Produktionsarbeiter.
- Sägewerk: 0–1 Produktionsarbeiter, 0–2 Träger.
- Schreinerei: 0–1 Produktionsarbeiter, 0–2 Träger.
- Lager: 0–2 Lager-Träger.
- Waldarbeiter produzieren je 1 Holz nach 5 Arbeitsrunden.
- Sägewerk: 2 Holz -> 1 Brett in 5 Produktionsrunden.
- Schreinerei: 2 Bretter -> 1 Holzwerkzeug in 5 Produktionsrunden.
- Lager-Träger holen im ersten PoC nur Holzwerkzeuge aus der Schreinerei.
- Freigesetzte Personen laufen zum HQ zurück und können unterwegs neu zugewiesen werden.
- Personen werden nie teleportiert.
- `+1`/`-1` unter dem Spiel verändert die aktuelle Bevölkerung als Debug-Funktion; `-1` entfernt nur eine freie Person am HQ.

## Zusätzliche Implementierungsentscheidungen aus der Planung

Diese Punkte sind bewusst Teil der Implementierungsvorgabe, auch wenn sie nicht als Produktregel in `concept.md` stehen.

### 1. Pfadsuche

Da alle begehbaren Kanten Kosten 1 haben, soll für den kürzesten Weg eine einfache Breadth-First Search (BFS) verwendet werden. Dijkstra oder A* sind für PoC 1 nicht notwendig.

Die Pfadsuche arbeitet auf logischen Hex-Koordinaten, nicht auf Pixelkoordinaten. Bildschirmpositionen werden ausschließlich aus Hex-Koordinaten abgeleitet.

### 2. Eine generische Person statt Berufsklassen

Es soll eine einzige generische `Person`-Entität geben. Rollen wie Waldarbeiter, Produktionsarbeiter, Träger oder Lager-Träger werden über Zuweisung/Zustand modelliert und nicht durch getrennte Klassen wie `Forester`, `Carpenter` oder `Carrier`.

Grund: Eine Person soll später ihren Beruf wechseln können. Die Identität der Person bleibt daher unabhängig von der aktuellen Tätigkeit.

### 3. Kleine explizite Zustandsmaschine

Die Person braucht nur die Zustände, die der aktuelle PoC tatsächlich benötigt. Eine mögliche minimale Menge ist:

- `idle` / frei
- `movingToWorkplace`
- `workingResource`
- `movingToSource`
- `returningWithResource`
- `producing`
- `movingToHeadquarters`

Falls die Implementierung mit weniger oder leicht anders benannten Zuständen klarer wird, ist das in Ordnung. Keine allgemeine KI-/Behavior-Tree-Architektur und kein ECS einführen.

### 4. Datengetriebene Produktion

Sägewerk und Schreinerei sollen dieselbe generische Produktionslogik verwenden. Rezepte sind Daten, keine eigenen Codepfade.

Beispielkonfiguration:

```ts
sawmill: {
  input: { good: 'wood', amount: 2 },
  output: { good: 'plank', amount: 1 },
  duration: 5,
}

carpenter: {
  input: { good: 'plank', amount: 2 },
  output: { good: 'woodenTool', amount: 1 },
  duration: 5,
}
```

Der Wald ist eine Rohstoffquelle mit eigener Produktionsregel, soll aber denselben Runden-/Fortschrittsgedanken nutzen.

### 5. Manuelle Rundensteuerung zuerst

Der erste Stand bekommt einen Button `Nächste Runde`. Ein Klick führt exakt einen Simulationstick aus.

Kein Echtzeitmodus, keine Pause-/Geschwindigkeitslogik und kein automatischer Rundentimer sind für PoC 1 notwendig. Auto-Play kann später leicht ergänzt werden.

### 6. Feste Szenariodaten statt verstreuter Konstanten

Die Startkarte, Startbevölkerung und fachlich veränderbaren PoC-Werte sollen möglichst zentral konfiguriert werden, z. B. in einem kleinen Szenario-/Config-Modul.

Mindestens zentral halten:

- Startbevölkerung = 8
- Produktionsdauer = 5
- Tragkapazität = 1
- Input-Kapazität = 10
- Output-Kapazität = 3
- Arbeitskräfteobergrenzen je Gebäude
- feste Hex-Karte / Gebäudepositionen

Nicht überabstrahieren; ein einfaches TypeScript-Objekt reicht.

## Vorgeschlagene Projektstruktur

Die genaue Dateiaufteilung darf klein bleiben. Eine mögliche Struktur:

```text
src/
  simulation/
    model.ts             # gemeinsame Typen / WorldState
    hex.ts               # Hex-Koordinaten, Nachbarn
    pathfinding.ts       # BFS
    simulation.ts        # ein Tick / Rundenablauf
    people.ts            # Personenzustände und Bewegung
    economy.ts           # Goods, Inventare, Rezepte
    assignments.ts       # Zuweisung/Freisetzen
    scenario.ts          # feste PoC1-Karte und Startwerte
  game/
    MainScene.ts         # Phaser-Darstellung
    hexView.ts           # Hex -> Pixel, Zeichnen
    personView.ts        # visuelle Personen
  ui/
    controls.ts          # Rundenbutton, Besetzung, Bevölkerung
  main.ts
```

Dies ist eine Orientierung, keine Pflicht zu vielen Dateien. Wenn weniger Dateien verständlicher sind, weniger verwenden.

## Konkreter Kartenentwurf

Die Karte soll klein bleiben, ungefähr in der Größenordnung 9 x 7 sichtbare Hexfelder. Die exakten Hex-Koordinaten dürfen beim Implementieren pragmatisch festgelegt werden, solange folgende Topologie erhalten bleibt:

- Hauptquartier im linken unteren Bereich.
- Wald im linken oberen Bereich.
- Sägewerk ungefähr mittig.
- Schreinerei im rechten mittleren Bereich.
- Lager im rechten unteren Bereich.
- Ein zusammenhängendes Wegenetz verbindet alle Gebäude.
- Vom HQ führt ein Weg in Richtung Mitte; ein Zweig führt zum Wald.
- Die Hauptstrecke führt weiter über Sägewerk -> Schreinerei -> Lager.
- Einige Wiesenfelder füllen die Karte.
- Ein kleiner Fluss und ein kleiner Bergbereich blockieren Teile der Karte und machen die Route optisch weniger steril.
- Es muss immer ein gültiger begehbarer Weg zwischen allen für den PoC nötigen Gebäuden existieren.

Der im Chat erzeugte grafische Kartenentwurf ist nur eine visuelle Referenz. Er muss nicht pixelgenau reproduziert werden. Entscheidend sind Hex-Struktur, Gebäudeanordnung, Hindernisse und gut erkennbare Wege.

## Simulation: erwarteter Rundenablauf

Ein Simulationstick soll deterministisch und verständlich sein. Eine sinnvolle Reihenfolge ist:

1. bereits laufende Bewegungen um höchstens eine Hexkante fortsetzen;
2. Ankünfte verarbeiten (Arbeitsstätte, Quelle, HQ);
3. Materialaufnahme/-abgabe verarbeiten;
4. Produktionsfortschritt für anwesende und arbeitsfähige Personen erhöhen;
5. abgeschlossene Produktionen verbuchen;
6. für freie/untätige zugewiesene Personen die nächste notwendige Aktion bestimmen;
7. UI rendert den neuen WorldState.

Die exakte interne Reihenfolge darf angepasst werden, sofern keine Figur in einer Runde unbeabsichtigt mehr als eine Kante läuft oder mehr als einen Produktionsfortschritt erhält.

## Beschaffungslogik

### Produktionsarbeiter

Ein Produktionsarbeiter priorisiert seine eigene Arbeitsstätte:

- Wenn genug Input vorhanden und Output-Platz frei ist: produzieren.
- Wenn Input fehlt: verfügbare Quelle für die benötigte Ware suchen.
- Kürzesten begehbaren Weg zur Quelle berechnen.
- 1 Einheit aufnehmen.
- Zur eigenen Arbeitsstätte zurücklaufen.
- Abliefern und erneut prüfen.

Ein Arbeiter kennt keine komplette Produktionskette, sondern nur den aktuellen Bedarf seiner eigenen Arbeitsstätte.

### Träger einer Produktionsstätte

Träger sind fest einer Arbeitsstätte zugewiesen und beschaffen nur deren benötigte Inputware.

- Quelle mit verfügbarer benötigter Ware finden.
- 1 Einheit holen.
- zur zugewiesenen Arbeitsstätte bringen.
- wiederholen, solange Bedarf und Input-Kapazität vorhanden sind.

Keine globale Trägerbörse für Produktionswaren in PoC 1.

### Lager-Träger

Lager-Träger sind ebenfalls fest dem Lager zugewiesen. Im ersten PoC ist ihre Quelle hart auf die Schreinerei und die Ware auf Holzwerkzeug begrenzt.

- Wenn in der Schreinerei Holzwerkzeug im Output liegt: hinlaufen, 1 Einheit aufnehmen, ins Lager bringen.
- Im Lager wird der Bestand dauerhaft hochgezählt.
- Der Schreiner bringt das Holzwerkzeug nicht selbst weg.

Später kann daraus eine allgemeine Sammellogik werden, aber jetzt nicht vorwegnehmen.

## Reservierungen / Doppelzugriffe

Die Implementierung muss verhindern, dass zwei Personen dieselbe physische Wareneinheit gleichzeitig einplanen und beide erfolgreich abholen.

Für PoC 1 reicht eine einfache Lösung. Zum Beispiel kann beim Start eines Beschaffungswegs eine Einheit logisch reserviert werden oder erst bei Ankunft atomar geprüft/entnommen werden. Bevorzugt wird die kleinste robuste Lösung.

Falls Reservierungen eingeführt werden, müssen sie bei Freisetzung/Umplanung sauber aufgehoben werden. Keine komplexe Job-Queue bauen.

## Arbeitskräfte-Zuweisung

Die UI stellt pro Gebäude die gewünschte Besetzung ein.

Beim Erhöhen:

- eine freie Person verwenden;
- wenn sie am HQ steht, von dort starten;
- wenn sie bereits frei auf dem Rückweg zum HQ ist, direkt von ihrer aktuellen Position zur neuen Arbeitsstätte umplanen;
- erst nach Ankunft als aktiver Arbeiter/Träger zählen.

Beim Reduzieren:

- eine passende Person sofort aus der Zuweisung lösen;
- laufende Produktions-/Transportaufgabe abbrechen;
- falls sie eine Ware trägt, muss die Implementierung einen einfachen konsistenten Umgang wählen (bevorzugt: Ware an aktuelle Quelle/Ziel zurückbuchen oder bis zum nächsten sicheren Übergabepunkt weiterführen, aber keinesfalls duplizieren oder verlieren);
- danach zum HQ laufen;
- unterwegs neu zuweisbar bleiben.

Wichtig: Wenn diese Abbruchregel während der Implementierung konkretisiert werden muss, soll die einfachste konsistente Variante gewählt und bei Bedarf in `concept.md` ergänzt werden, wenn sie sichtbares Produktverhalten definiert.

## UI / Darstellung

Die erste Darstellung soll bewusst simpel sein und keine Asset-Pipeline voraussetzen.

### Karte

- Hexfelder als einfache farbige Polygone.
- Weg: hellbraun.
- Gebäude: deutlich hervorgehoben und beschriftet.
- Wiese: grün.
- Berg: grau.
- Fluss: blau.
- Keine grafischen Spezialeffekte notwendig.

### Personen

- kleine Kreise/Marker reichen.
- Rollen/Zuweisung können über Kürzel, Label oder kleines Symbol lesbar gemacht werden.
- getragene Ware soll möglichst sichtbar sein, z. B. durch ein kurzes Kürzel neben der Figur.

### Gebäudeinformationen

Der Zustand der Simulation muss direkt nachvollziehbar sein. Pro Gebäude sollte mindestens erkennbar sein:

- zugewiesene/aktive Arbeiter;
- zugewiesene/aktive Träger;
- Input-Bestand;
- Output-Bestand;
- Produktionsfortschritt bzw. Grund für Stillstand.

Beispiel:

```text
Sägewerk
Arbeiter: 1/1
Träger: 1/2
Holz: 1/10
Bretter: 2/3
Status: wartet auf Holz
```

### Globale UI

Mindestens anzeigen:

```text
Runde: 37
Bevölkerung: 8
Frei: 2
Holzwerkzeuge im Lager: 4
```

Dazu:

- Button `Nächste Runde`.
- Bevölkerung `-1 / aktuelle Zahl / +1` unter dem Spiel.
- einfache +/- Steuerung für Arbeiter/Träger an den Gebäuden.

## Implementierungsphasen

### Phase A – Karte lebt

Ziel:

- Phaser-App startet.
- feste Hex-Karte wird dargestellt.
- Hex-Nachbarschaft funktioniert.
- BFS findet korrekte Wege nur über begehbare Hexe.
- eine Testfigur kann rundenweise von A nach B laufen.

Akzeptanz:

- kein Phaser-Code in `simulation/`.
- Bewegung beträgt maximal eine Kante je Runde.
- Berge, Fluss und Wiese werden nie betreten.

### Phase B – Menschen leben

Ziel:

- 8 Personen starten frei am HQ.
- Zuweisung per UI funktioniert.
- Personen laufen zur Arbeitsstätte.
- Freisetzung führt zurück zum HQ.
- unterwegs neu zuweisen funktioniert.
- `+1/-1` Bevölkerung funktioniert gemäß Konzept.

Akzeptanz:

- keine Teleportation.
- Personen zählen erst nach Ankunft als aktiv.
- aktuelle Bevölkerung und freie Personen sind sichtbar.

### Phase C – Wirtschaft lebt

Ziel:

- Wald produziert mit 0–2 Arbeitern.
- Sägewerk und Schreinerei verwenden generische Rezeptlogik.
- Produktionsarbeiter holen fehlende Ware selbst.
- lokale Input-/Output-Kapazitäten funktionieren.
- Output-Stau stoppt Produktion.

Akzeptanz:

- `2 Holz -> 1 Brett` in 5 Runden.
- `2 Bretter -> 1 Holzwerkzeug` in 5 Runden.
- Waldarbeiter erzeugen je 1 Holz in 5 Runden.
- keine Ware entsteht ohne anwesenden Arbeiter.

### Phase D – Logistik schließt die Kette

Ziel:

- bis zu zwei Träger pro Produktionsstätte unterstützen die Inputbeschaffung.
- Lager-Träger holen Holzwerkzeuge aus der Schreinerei.
- Lagerbestand zählt dauerhaft nach oben.
- komplette Kette läuft wiederholt über viele Runden.

Akzeptanz:

- Waren werden nie dupliziert.
- Produktions- und Transportengpässe sind sichtbar.
- mit unterschiedlichen Besetzungen verändert sich der Durchsatz nachvollziehbar.

## Tests

Die Simulationslogik soll ohne Phaser testbar sein. Mindestens folgende Fälle automatisiert oder sehr gezielt testen:

- Hex-Nachbarschaft.
- BFS findet kürzesten Weg.
- BFS vermeidet nicht begehbare Kacheln.
- Figur bewegt sich pro Tick höchstens eine Kante.
- Produktion dauert exakt 5 Produktionsrunden.
- Produktion startet nicht ohne Arbeiter.
- Produktion startet nicht ohne 2 Input.
- Produktion startet nicht bei vollem Output.
- Input wird korrekt verbraucht.
- Output wird korrekt erzeugt.
- Träger transportiert genau 1 Einheit.
- Zuweisung zählt erst nach Ankunft als aktiv.
- Freisetzung führt Richtung HQ.
- Bevölkerung `-1` entfernt keine eingesetzte Person.
- Lagerbestand wächst und ist unbegrenzt.

Keine große Testframework-Architektur einführen; das vorhandene Setup bzw. eine kleine etablierte Lösung verwenden.

## Bewusst nicht implementieren

Nicht in PoC 1 hineinziehen:

- freie Gebäudeplatzierung;
- Straßenbau;
- unterschiedliche Bewegungskosten;
- Gelände-Boni;
- Bedürfnisse wie Hunger/Schlaf;
- Familien und Wohnen;
- natürliche Geburten/Todesfälle;
- Berufserfahrung/Qualifikation;
- Bauarbeiter;
- Kampf/Diplomatie/Handel;
- allgemeine Lager-Suchlogik;
- globale Warenauftragsbörse;
- Echtzeitmodus;
- Savegames;
- ECS;
- Behavior Trees;
- komplexe Job-/Task-Scheduler;
- aufwendige Grafik-/Asset-Pipeline.

## Dokumentation während der Implementierung

Der Implementierungsagent muss `agents.md` befolgen.

- Vor Implementierung `architecture.md` und `concept.md` lesen.
- Wenn sichtbares Produktverhalten geändert oder konkretisiert wird: `concept.md` aktualisieren.
- Wenn eine relevante technische/architektonische Entscheidung hinzukommt: `architecture.md` aktualisieren.
- Den Plan nicht als höher priorisiert behandeln als `agents.md`, `concept.md`, `architecture.md` oder eine aktuelle Nutzeranweisung.

## Git-Workflow

Für den Implementierungslauf:

- auf einem temporären Branch arbeiten;
- Zwischenstände dort committen, wenn nötig;
- am Ende alles auf genau einen aussagekräftigen Commit squashen;
- diesen auf `main` bringen;
- dadurch soll der GitHub-Actions-Rebuild nur einmal final ausgelöst werden.

## Definition of Done für PoC 1

PoC 1 ist fertig, wenn ein Nutzer im Browser Folgendes beobachten und steuern kann:

1. Die feste Hex-Karte mit HQ, Wald, Sägewerk, Schreinerei und Lager ist sichtbar.
2. Die Karte enthält nicht begehbare Wiesen-, Berg- und Flussfelder.
3. Acht Personen starten am HQ.
4. Arbeiter und Träger können per +/- auf die Gebäude verteilt werden.
5. Jede Person läuft physisch über den kürzesten begehbaren Hexweg zu ihrem Ziel.
6. Waldarbeiter erzeugen Holz.
7. Das Sägewerk beschafft Holz und produziert Bretter.
8. Die Schreinerei beschafft Bretter und produziert Holzwerkzeuge.
9. Träger unterstützen die jeweilige Arbeitsstätte bei der Beschaffung.
10. Lager-Träger holen Holzwerkzeuge ab und erhöhen den Lagerbestand.
11. Inventargrenzen und Produktionsstopps sind sichtbar wirksam.
12. Ein Button schaltet die Simulation exakt eine Runde weiter.
13. Bevölkerung kann per Debug-Steuerung erhöht und – sofern freie Personen am HQ existieren – reduziert werden.
14. Arbeitskräfte können freigesetzt und ohne Teleportation neu zugewiesen werden.
15. Der Zustand der Wirtschaft ist im UI ausreichend transparent, um Engpässe nachvollziehen zu können.
16. Die Kernsimulation ist ohne Phaser ausführbar/testbar.

Wenn diese Punkte erfüllt sind, soll der Implementierungsagent den Scope nicht eigenständig erweitern.