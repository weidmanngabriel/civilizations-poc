# Waren und Logistik

Waren liegen immer an einem konkreten Ort. Eine Produktionsstätte kann nur arbeiten, wenn benötigte Waren tatsächlich dort ankommen.

Abbauer arbeiten innerhalb ihrer persönlichen Arbeitsflagge. Die Flagge ist ihr lokaler Navigationspunkt: kurze Wege innerhalb des bereits erreichten Arbeitsbereichs benötigen keinen Wegweiser. Versetzt du die Flagge außerhalb des aktuellen Bereichs der Person, muss sie den neuen Arbeitsbereich zuerst über das normale Wegweisernetz erreichen. Jede abgebaute Einheit tragen Abbauer einzeln zurück zur Flagge und stapeln sie dort als lose Ware. Ist im Arbeitsbereich kein passendes Vorkommen mehr verfügbar, kehren sie zur Flagge zurück und warten dort, bis du den Bereich versetzt oder wieder Arbeit verfügbar ist.

Lager- und HQ-Träger sammeln Waren in ihrem eigenen lokalen Arbeitsbereich ein und bringen sie in ihr zugewiesenes Lager.

Normale Träger verschieben Waren nicht automatisch zwischen verschiedenen Lagern. Dafür gibt es Händler mit bewusst eingerichteten Routen.

Produktionsarbeiter und Bauarbeiter dürfen benötigte Waren nach ihren eigenen Regeln beschaffen.

Beim Aufheben loser Bodenware bleibt ein Bewohner eine simulierte Sekunde am Warenhaufen. Abholen an anderen Quellen und Abladen dauern drei simulierte Sekunden. Bei normalen Gebäuden befindet sich der Bewohner während des Warenübergangs im Gebäude und ist auf der Karte nicht sichtbar. Am Brunnen bleibt er sichtbar, weil er diesen nicht betritt.


## Wegweiser

Neue Wegweiser werden von **Kundschaftern** errichtet. Wähle einen Bewohner, gib ihm den Beruf Kundschafter und starte in seinem Aktionsmenü **Wegweiser**. Sobald der Platzierungsmodus offen ist, siehst du alle aktuell gültigen Zielstellen hervorgehoben. Nach der Bestätigung läuft der Kundschafter selbst dorthin und baut fünf simulierte Sekunden lang. Der Wegweiser kostet keine Waren. Beim Start steht bereits ein erster Wegweiser ungefähr eine Weltkachel vor dem Hauptquartier.

Ein Wegweiser dient Bewohnern zur Orientierung in einem Bereich von **3,5 Weltkacheln**. Neue Wegweiser brauchen mindestens denselben Abstand von **3,5 Weltkacheln**. Erreichbare Wegweiser verbinden sich automatisch, wenn sie zwischen **3,5 und 7 Weltkacheln** voneinander entfernt sind.

Für jede Verbindung erscheint am Pfosten ein eigenes Richtungsschild zum verbundenen Wegweiser. Dadurch erkennst du direkt, wie das Netz weiterführt.

Auf dem Desktop zeigt die Maus zuerst den Ghost; Linksklick wählt das Ziel und Rechtsklick oder Escape bricht ab. Auf Touch setzt ein Tap nur die Vorschau, Ziehen verschiebt die Karte und der Bestätigungsbutton erteilt den Auftrag. Kundschafter sind nicht an das Wegweisernetz gebunden und dürfen frei über begehbares Terrain laufen. Dadurch können sie das Netz auch in bisher nicht erschlossene Gebiete erweitern.

Bewohner nutzen das Wegweisernetz für längere Navigation verpflichtend, müssen die Wegweiser selbst aber nicht betreten. Bei ein oder zwei beteiligten Wegweiser-Nodes wird der konkrete Weg direkt lokal berechnet; bei längeren Reisen begrenzt die gewählte Node-Kette den Suchkorridor. Persönliche Arbeitsflaggen und Farmen bilden lokale Arbeits-Nodes: erst nach der globalen Anreise in deren Bereich läuft die eigentliche Arbeit lokal. Farmer kehren zwischen abgeschlossenen Feldaufgaben zur Farm zurück; Fischer kehren nur mit einem erfolgreichen Fang zur Flagge zurück. Gibt es keine gültige Route, bleibt die Person stehen und zeigt einen gelben Hinweis. Erst wenn sich das Wegweisernetz ändert, wird ein zuvor gescheitertes Ziel erneut geprüft.

Wenn eine Produktion stockt, prüfe den tatsächlichen Warenfluss, die Wege und die Arbeitsbereiche der beteiligten Bewohner.
