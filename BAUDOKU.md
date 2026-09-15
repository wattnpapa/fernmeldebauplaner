# Was gebaut wurde, festhalten

Wie aus dem Planungswerkzeug eines wird, das den Bau begleitet: der Trupp hält
am Bauort fest, was er tatsächlich gebaut hat, und meldet es an den Planer
zurück, der die Meldungen mehrerer Trupps zu einer Lage zusammenfügt. Dieses
Papier hält die Entscheidung und ihre Begründung fest; was am Quelltext zu
beachten ist, steht in `CLAUDE.md`, die Zusage an den Nutzer in
`datenschutz.html`, die beiden Wege nach draußen in `TEILEN.md` und `CLOUD.md`.

Stand: entschieden, noch nicht gebaut.

## Warum überhaupt

Das Werkzeug endet heute mit dem gedruckten Bauauftrag. Was danach passiert,
verlässt es: der Truppführer fertigt nach Bauende die Technische
Fernmeldeskizze für den Kabelbau an – „durch Einzeichnen der befohlenen
Angaben in eine Karte, Planpause oder Handskizze“ (Hdb Feldfernkabelbau
1.3.2), und sie verbleibt beim Trupp (3.5). Der Planer bekommt eine
Baumeldung über Funk und sonst nichts. Was wirklich liegt, wie viel Material
verbaut wurde und wo die Trasse vom Plan abweicht, steht am Ende auf Papier in
einem Fahrzeug.

Die Skizze ist der Teil, den die Karte ohnehin besser kann. Der Verlauf ist
schon da, die Punktarten sind da, die Koordinaten sind da – es fehlt die
zweite Ebene daneben: was davon so gebaut wurde und was nicht.

## Die Entscheidung

**Ist neben Soll, in derselben Planung, umgeschaltet statt abgetrennt.**

Drei Festlegungen, die zusammengehören:

**Der Soll-Verlauf bleibt unangetastet.** Der Trupp legt seine Ausführung
daneben, er überschreibt die Planung nicht. Sonst wäre die Abweichung nach dem
ersten Antippen verschwunden – und genau die schuldet der Truppführer dem S 6
(„Zwingend nötige Abweichungen vom Auftrag muß er oft selbst entscheiden. Er
muß sie umgehend dem S 6 melden“, 1.3.2), und genau die braucht der Planer,
wenn er den nächsten Auftrag auf dieselbe Trasse legt.

**Ein Umschalter Planungsmodus / Baumodus, keine zweite Seite.** Der Baumodus
ist dieselbe Anwendung mit einer anderen Oberfläche: er blendet weg, was am
Bauort niemand braucht (Höhenprofil, Funkrechnung, Frequenzliste,
Druckeinstellungen), und vergrößert, was dort gebraucht wird. Eine eigene
Seite `bau.html` hätte Zustand, Karte, Migration und Cloud-Abgleich ein
zweites Mal anbinden müssen, und der Weg zurück in den Plan wird gebraucht:
der Truppführer schlägt im Fahrzeug im Bauauftrag nach.

**Der Bauauftrag ist die Einheit.** Der Bauauftrag wird je Strecke gedruckt,
also hängt die Dokumentation an der Strecke. Dass mehrere Trupps an einer
Strecke arbeiten, ändert daran nichts – sie teilen sie unter sich auf.

## Mehrere Trupps an einer Strecke

Der Regelfall beim längeren Bau: zwei Trupps bauen von beiden Enden
aufeinander zu und treffen sich in der Mitte, wo eine Längenverbindung
entsteht. Das Handbuch nennt das den abschnittsweisen Bau und überlässt die
Einzelheiten dem S 6 im Baubefehl (3.6).

Deshalb bekommt die Strecke **Bauabschnitte**: je einer für einen Trupp, von
Punkt bis Punkt. Jeder Ist-Punkt und jede Materialzeile trägt die Kennung
ihres Bauabschnitts.

Das ist nicht nur Buchführung, sondern die Naht, an der das Zusammenführen
später schneidet: zwei Trupps schreiben nie in dasselbe Feld, sondern jeder in
seinen Abschnitt. Ohne diese Trennung bliebe nur die Wahl zwischen einer
Meldung, die die andere überschreibt, und einem Verschmelzen, das niemand
nachvollziehen kann.

Der Name ist verwechslungsanfällig: **Einsatzabschnitt** gliedert weiterhin
die ganze Planung in Zuständigkeiten, **Bauabschnitt** teilt eine einzelne
Strecke unter Trupps auf. Beide stehen nie im selben Auswahlfeld.

## Das Datenmodell

Jede Strecke bekommt einen `bau`-Block. Er fehlt, solange niemand im Baumodus
etwas einträgt – eine leere Struktur in jede bestehende Planung zu schreiben
verlängerte Speicher und Link, ohne etwas auszusagen. `SCHEMA` wird trotzdem
hochgezählt, weil neue Felder entstehen, und `migrieren()` verträgt sein
Fehlen.

```
strecke.bau = {
  stand:      'offen' | 'laeuft' | 'gebaut' | 'uebergeben',
  abschnitte: [ { id, name, trupp, fuehrer, vonNr, bisNr, beginn, ende } ],
  punkte:     [ { id, lat, lng, art, name, bemerkung,
                  abschnitt, sollPunkt, quelle, zeit } ],
  material:   [ { artikel, menge, abschnitt, bemerkung } ],
  meldungen:  [ { zeit, text, abschnitt } ],
  pruefung:   { stamm: [ … ], uebergabeAn, uebergabeZeit, uebergabeName },
  abweichung: ''
}
```

Zwei Felder tragen mehr, als sie aussehen:

**`sollPunkt`** hält die Kennung des geplanten Punktes, den dieser Ist-Punkt
bestätigt. Er ist der einzige Weg, „Punkt 7 liegt 40 m weiter westlich“ von
„hier kam ein Punkt dazu“ zu unterscheiden. Ohne ihn bliebe nur ein Vergleich
über die Entfernung, und der rät bei eng gesetzten Punkten falsch.

**`quelle`** sagt, woher die Koordinate stammt: `plan` (geplanter Punkt
bestätigt), `standort` (aus der Gerätepeilung übernommen) oder `karte` (auf
der Karte angetippt). Die drei sind unterschiedlich genau – der Standort auf
etwa 5 bis 10 m unter freiem Himmel, deutlich schlechter unter Bewuchs. Wer
später eine Abweichung von 15 m beurteilt, muss wissen, ob sie gemessen oder
getippt ist.

## Wie der Verlauf entsteht

Drei Handgriffe, mehr nicht:

- **Geplanten Punkt bestätigen** – der Regelfall. Der Punkt wird in der Liste
  angetippt, die Koordinate aus dem Plan übernommen.
- **Punkt hier** – die Gerätepeilung wird als Ist-Punkt übernommen.
- **Punkt auf der Karte** – antippen, wo er wirklich liegt.

**Kein GPS-Mitschnitt.** Er stand im Entwurf und ist gefallen: er erzeugt bei
Fahrt mehrere hundert Punkte je Kilometer, die jemand ausdünnen müsste, und
das tut am Bauort niemand. Was dokumentiert werden soll, sind die Stellen, die
im Bauauftrag stehen – Muffe, Querung, Reserve, Hochführung –, und die werden
angesteuert und nicht überfahren. Die Entscheidung ist nicht endgültig: wenn
sich in der Anwendung zeigt, dass der Verlauf zwischen den Punkten fehlt, ist
der Mitschnitt nachrüstbar, ohne das Datenmodell zu ändern.

Der Trupp darf darüber hinaus alles: Punkte einfügen, Strecken teilen, eine
neue Strecke anlegen, weil der Weg anders lief. Eine im Baumodus neu angelegte
Strecke kommt mit `herkunft` zurück wie ein Abschnittsexport – der Planer
sieht, dass sie draußen entstanden ist.

## Die Materialliste

Ein fester Katalog nach dem Blatt aus dem THW-Extranet, nicht ein Freifeld.
Nur ein Katalog lässt sich über mehrere Trupps addieren, und nur er lässt sich
neben den Bedarf stellen, den `bauauftrag.js` schon rechnet.

| Gruppe | Zeilen |
|---|---|
| Kabel | FKb, FFKb, AKb, VKb (in m) |
| Anschluss | Anschlusspeitsche FFKb, Anschlusspeitsche AKb |
| Hochbau | Bauhaken FKb, Bauhaken FFKb, Abspannring, Ankerpfahl, Ankerseil, Baustangenteil, Verlängerungsstück, Lattenschere |
| Blitzschutz | Anschlussleiste 1-paarig, 2-paarig, 10-paarig, AK 70 |
| Erdung | Schrauberder, Erdungsleitung (in m), Erdungsschiene, Erdungsverbinder, Erdungsverbinderschraube, Erdstecker, Erdungszwinge |
| frei | sonstiges, mehrzeilig |

Die drei Spalten des Blattes werden als **je ein Bauabschnitt** gedeutet – das
ist die Lesart, die zum Mehr-Trupp-Fall passt und zu der Zeile
„Erdungsleitung“, die in jeder Spalte nach einer Länge fragt. Diese Deutung
steht unter Vorbehalt (siehe „Offen“).

Wo die Planung eine Zahl hergibt – Kabelbedarf, Trommeln, Muffen, Querungen –,
steht sie als Soll neben dem Ist. Vorbelegt wird das Eingabefeld **nicht**:
eine vorausgefüllte Menge, die niemand ändert, ist keine Dokumentation,
sondern eine Abschrift des Plans.

Die Werte gehören nach `js/vorschrift.js` mit `quelle` und `fundstelle` wie
alles Fachliche dort. Beides ist noch nachzutragen (siehe „Offen“).

## Prüfen und Übergeben

Die Dokumentation endet nicht mit der letzten Materialzeile. Nach 3.5 sind bei
fertiggestellter Kabelleitung auf allen Leitungsstämmen des Feldfernkabels
Messungen vorzunehmen, bei Verbindungs- und Anschlusskabel alle Stämme durch
Sprechproben zu prüfen; entsprechen die Messwerte den Sollwerten oder war die
Ruf- und Sprechprobe erfolgreich, wird das Kabel der Einheit übergeben, für
die es gebaut wurde – und erst wenn die befohlenen Übernahmemessungen
abgeschlossen sind, ist die Übergabe beendet.

Also je Stamm eine Zeile mit Art der Prüfung, Ergebnis, Zeit und Prüfer, und
darunter die Übergabe: an wen, wann, durch wen. Ohne diesen Teil ist die
Baudokumentation eine Notiz und kein Nachweis.

Dazu die **Baumeldungen** als Zeitschiene: nach einer abgesprochenen Anzahl
Kabellängen oder nach befohlener Zeit ist eine Baumeldung an die Anfangsstelle
durchzugeben (3.5). Wer sie im Werkzeug mitschreibt, hat am Ende die
Bauzeiten, die sonst niemand rekonstruiert.

## Der Weg hin und zurück

**Hin** ändert sich nichts: der Planer schickt den Einsatzabschnitt als Link
oder Datei, wie in `TEILEN.md` beschrieben.

**Zurück** geht eine **Baumeldung**: ein Link oder eine Datei, die nicht die
ganze Planung enthält, sondern nur die `bau`-Blöcke der Strecken dieses
Trupps, dazu neu angelegte Strecken und die Kennung der Planung, zu der sie
gehören. Das hält sie klein – Ist-Punkte und Materialzeilen wiegen weniger als
die Planung, die hingeschickt wurde, und die reist heute in gut 2 000 Zeichen.

**Zusammenführen ist erlaubt**, eng geschnitten: eine Baumeldung ersetzt genau
die Bauabschnitte, die sie nennt, und rührt die Soll-Geometrie nicht an. Vor
dem Einspielen zeigt ein Dialog, welche Strecken und welche Abschnitte
betroffen sind, von welchem Trupp die Meldung stammt und was überschrieben
wird.

Das ist kein Widerspruch zu der Festlegung in `CLOUD.md`, nicht zu
verschmelzen: dort treffen zwei Fassungen **desselben** Feldes aufeinander,
hier schreiben mehrere Trupps in **verschiedene** Abschnitte. Wo doch zwei
Meldungen denselben Bauabschnitt betreffen, wird nicht verschmolzen, sondern
gefragt – wie beim Abgleichskonflikt.

## Offline am Bauort

Am Bauort ist kein Netz, und ohne Kartenkacheln ist der Baumodus blind. Zwei
Stücke fehlen:

**Die Anwendung selbst muss ohne Netz starten.** Heute lädt sie rund fünfzig
Module und `vendor/` vom Server; ein Service Worker, der den Bestand ablegt,
ist der einzige Weg. Es wäre der erste im Projekt.

**Der Kartenausschnitt muss mitgenommen werden können.** Vor dem Ausrücken
holt die Anwendung die Kacheln entlang der Trasse und legt sie in IndexedDB,
wie `bildspeicher.js` es mit den Lichtbildern tut. Überschlägig für eine
5 km lange Trasse mit 300 m Puffer, Zoom 13 bis 18: einige hundert Kacheln,
Größenordnung 3 bis 5 MB. Das ist zu messen, bevor es zugesagt wird.

Das Vorladen berührt die Zusage in `datenschutz.html`: es fragt beim
Kartenanbieter gezielt die Kacheln entlang der geplanten Trasse ab, statt wie
bisher nur die des betrachteten Ausschnitts. Der Verlauf selbst geht nicht
hinaus, die Gegend, in der gebaut wird, schon – sichtbarer als heute. Das
gehört in den Dialog und in `datenschutz.html`.

## Die Baudokumentation als viertes Blatt

Neben Bauauftrag, Sammel-Bauauftrag und Lagekarte tritt die
**Baudokumentation**. Sie ersetzt die Technische Fernmeldeskizze für den
Kabelbau und verbleibt beim Trupp:

Kopf mit Auftrag, Einheit, Trupp, Truppführer, Baubeginn und Bauende als
Datum-Zeit-Gruppe; die Karte mit der Ist-Trasse kräftig und der Soll-Trasse
gestrichelt darunter; die Ist-Punkte mit Koordinaten in MGRS; die
Materialliste Soll gegen Ist; Baumeldungen mit Uhrzeit; Messungen und
Sprechproben je Stamm; Abweichungen im Klartext; Unterschrift.

Es gilt, was für die anderen drei gilt: alle vier Formate, A4 und A3, hoch und
quer, Farbe und Schwarz-Weiß, geprüft in Firefox auf macOS. Im
Schwarz-Weiß-Druck unterscheiden Strichmuster Soll und Ist, nicht Farben.

## Die Oberfläche im Baumodus

Was der Planungsmodus voraussetzt, gilt dort nicht: keine Maus, kein
`title`-Tooltip, Handschuh, Tageslicht, eine Hand am Gerät. Also große
Trefferzonen, der Knopf „Punkt hier“ im Daumenbereich, Listen statt Dialoge,
und nichts, was eine zweite Hand oder ein zweites Fenster verlangt. Die
Grundlagen liegen bereits: `@media (pointer: coarse)` mit 44-px-Zonen, die
Schmalansicht mit ihrem Umschalter Liste ↔ Karte, die Schriftuntergrenze von
11 px.

## Verworfene Wege

**Eigene Seite `bau.html`.** Hätte Zustand, Karte, Migration und
Cloud-Abgleich doppelt anbinden müssen, und der Weg zurück in den Bauauftrag
wird gebraucht.

**Ist ersetzt Soll.** Spart eine Ebene und kostet den Nachweis der Abweichung
– das, was der Truppführer melden muss und der Planer braucht.

**GPS-Mitschnitt als Hauptweg.** Siehe oben; vertagt, nicht ausgeschlossen.

**Automatisches Verschmelzen zweier Meldungen zum selben Bauabschnitt.**
Gleicher Grund wie in `CLOUD.md`: eine falsch verschmolzene Trasse ist
schlimmer als zwei, zwischen denen jemand entscheidet.

**Lichtbilder jetzt.** Vertagt in die letzte Stufe – nicht weil sie unwichtig
wären, sondern weil bis zu 50 Bilder je Strecke den Rückweg bestimmen (ein
verkleinertes Bild wiegt rund 200 kB, im Link das 1,4-fache) und diese Frage
den Rest nicht aufhalten soll.

## Umsetzung in Stufen

1. `bau`-Block, Schemaerhöhung, Umschalter Planungsmodus / Baumodus,
   Bauabschnitte und Trupps, Ist-Punkte auf drei Wegen.
2. Materialliste mit Katalog und Soll-Gegenüberstellung, Baumeldungen,
   Messungen und Übergabe.
3. Baumeldung als Link und Datei zurück; Einspielen beim Planer mit Vorschau;
   Zusammenführen mehrerer Trupps.
4. Offline: Service Worker und Kachelvorrat. **Vor dieser Stufe ist der
   Baumodus nur mit Netz brauchbar** – sie ist die Bedingung für den ersten
   echten Einsatz, nicht eine Verbesserung danach.
5. Druckerzeugnis Baudokumentation, alle vier Formate.
6. Lichtbilder: Aufnahme am Punkt, Speicher, Rückweg.

Die Stufen 1 bis 3 sind am Schreibtisch prüfbar, Stufe 4 nur am Gerät.

## Getroffene Festlegungen

| Frage | Entscheidung |
|---|---|
| Soll und Ist | nebeneinander, Soll unangetastet |
| Zugang | Umschalter Planungsmodus / Baumodus, eine Anwendung |
| Einheit der Dokumentation | die Strecke, also der Bauauftrag |
| Mehrere Trupps | Bauabschnitte je Strecke, jede Eintragung trägt ihren Abschnitt |
| Erfassung des Verlaufs | bestätigen, „Punkt hier“, antippen – kein Mitschnitt |
| Änderungsrecht des Trupps | unbegrenzt, auch neue Strecken |
| Materialliste | fester Katalog nach dem Extranet-Blatt, Soll daneben, nicht vorbelegt |
| Rückweg | Baumeldung als Link oder Datei, nur die `bau`-Blöcke |
| Zusammenführen | ja, abschnittsweise ersetzend, mit Vorschau; Kollision fragt |
| Offline | Service Worker plus Kachelvorrat, vor dem ersten Einsatz |
| Viertes Blatt | Baudokumentation, ersetzt die Technische Fernmeldeskizze |
| Lichtbilder | vertagt in Stufe 6 |

## Offen

- **Die drei Spalten der Materialliste.** Hier als „je Bauabschnitt“ gedeutet.
  Stimmt das nicht, ändert sich das Formular, nicht das Datenmodell.
- **Die Fundstelle des Materialblattes.** Für `js/vorschrift.js` fehlen
  genauer Titel und Stand der im THW-Extranet veröffentlichten Fassung; ohne
  sie steht dort eine Quelle, die am Bauort niemand nachschlagen kann.
- **Die Größe des Kachelvorrats.** Überschlagen, nicht gemessen.
