# Was gebaut wurde, festhalten

Wie aus dem Planungswerkzeug eines wird, das den Bau begleitet: der Trupp hält
am Bauort fest, was er tatsächlich gebaut hat, und meldet es an den Planer
zurück, der die Meldungen mehrerer Trupps zu einer Lage zusammenfügt. Dieses
Papier hält die Entscheidung und ihre Begründung fest; was am Quelltext zu
beachten ist, steht in `CLAUDE.md`, die Zusage an den Nutzer in
`datenschutz.html`, die beiden Wege nach draußen in `TEILEN.md` und `CLOUD.md`.

Stand: Stufen 1 bis 5 gebaut. Stufe 1 – Datenmodell, Umschalter,
Bauabschnitte, Ist-Punkte auf drei Wegen, die gebaute Trasse auf der Karte und
der Rückweg über Datei, Link und Speicher. Stufe 2 – Materialnachweis nach
festem Katalog, Baumeldungen als Zeitschiene, Prüfung je Leitungsstamm und die
Übergabe. Stufe 3 – die Baumeldung als Rückweg, mit Vorschau beim Planer und
abschnittsweisem Einspielen mehrerer Trupps. Stufe 4 – die Anwendung startet
ohne Netz, und die Karte lässt sich für den Bauort mitnehmen. Damit ist der
Kreis geschlossen: Planung hin, Baumeldung zurück. Stufe 5 – die
Baudokumentation als viertes Druckblatt. Stufe 6 – die Lichtbilder – steht
aus.

## Warum überhaupt

Das Werkzeug endet heute mit dem gedruckten Bauauftrag. Was danach passiert,
verlässt es: der Truppführer fertigt nach Bauende die Technische
Fernmeldeskizze für den Kabelbau an – „durch Einzeichnen der befohlenen
Angaben in eine Karte, Planpause oder Handskizze“ (Hdb Feldfernkabelbau, 1.3.2),
und sie verbleibt beim Trupp (3.5). Der Planer bekommt eine
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
  abschnitte: [ { id, name, trupp, fuehrer, vonPunkt, bisPunkt,
                  beginn, ende, farbe } ],
  punkte:     [ { id, lat, lng, art, name, bemerkung,
                  abschnitt, sollPunkt, quelle, genauigkeit, zeit } ],
  material:   [ { id, artikel, menge, abschnitt, bemerkung } ],
  meldungen:  [ { id, zeit, text, abschnitt } ],
  pruefung:   { staemme: [ { id, stamm, art, ergebnis, bestanden, zeit, pruefer } ],
                uebergabeAn, uebergabeZeit, uebergabeName },
  abweichung: ''
}
```

Drei Felder tragen mehr, als sie aussehen:

**`vonPunkt` und `bisPunkt`** sind Punkt-KENNUNGEN und keine Punktnummern. Im
ersten Entwurf standen dort Nummern; das hätte nicht gehalten. Drei Griffe im
Bestand numerieren um – „Richtung umkehren“ und das Löschen eines Punktes in
`js/ui.js`, der Einfügegriff in `js/strecken.js` –, und der Bauabschnitt hätte
danach auf eine andere Stelle der Trasse gezeigt, ohne dass jemand etwas an ihm
geändert hat. Im Link ist es umgekehrt: dort reisen die Kennungen nicht mit,
und der Codec rechnet sie in die Stelle in der Punktliste um und wieder zurück
(`js/teilen.js`). Innen die Kennung, im Transport die Stelle.

**`sollPunkt`** hält die Kennung des geplanten Punktes, den dieser Ist-Punkt
bestätigt. Er ist der einzige Weg, „Punkt 7 liegt 40 m weiter westlich“ von
„hier kam ein Punkt dazu“ zu unterscheiden. Ohne ihn bliebe nur ein Vergleich
über die Entfernung, und der rät bei eng gesetzten Punkten falsch.

**`quelle`** sagt, woher die Koordinate stammt: `plan` (geplanter Punkt
bestätigt), `standort` (vom Gerät geortet) oder `karte` (auf
der Karte angetippt). Die drei sind unterschiedlich genau – der Standort auf
etwa 5 bis 10 m unter freiem Himmel, deutlich schlechter unter Bewuchs. Wer
später eine Abweichung von 15 m beurteilt, muss wissen, ob sie gemessen oder
getippt ist.

## Wie der Verlauf entsteht

Drei Handgriffe, mehr nicht:

- **Geplanten Punkt bestätigen** – der Regelfall. Der Punkt wird in der Liste
  angetippt, die Koordinate aus dem Plan übernommen.
- **Punkt hier** – der Standort des Geräts wird als Ist-Punkt übernommen.
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

**Die drei Spalten des Blattes werden nicht nachgebaut.** Auf Papier sind sie
der Platz für drei Baustrecken nebeneinander; digital gibt es diesen Zwang
nicht – jede Strecke hat ihren eigenen Bogen, und wo mehrere Trupps an einer
bauen, trägt jede Zeile ihren Bauabschnitt. Eine Spalte, die nur deshalb da
ist, weil das Papier drei nebeneinander tragen musste, wäre ein leeres Feld
mehr, das am Bauort jemand mit dem Handschuh treffen muss.

Wo die Planung eine Zahl hergibt, steht sie als Soll neben dem Ist. Das ist
genau **eine** Zeile: die Kabelart dieser Strecke, mit dem Bedarf aus
`kennzahlen()` einschließlich Bauzuschlag und Reserve. Trommeln, Muffen und
Querungen rechnet die Planung zwar auch – nur hat der Katalog dafür keine
Zeile, sie werden nicht als Material nachgewiesen. Für Bauhaken, Abspannringe,
Erder und Anschlussleisten rechnet sie gar nichts; dort steht nichts daneben,
und das ist Absicht.

Vorbelegt wird das Eingabefeld **nicht**: eine vorausgefüllte Menge, die
niemand ändert, ist keine Dokumentation, sondern eine Abschrift des Plans. Und
das Soll steht in der Einheit der Zeile – das Feld nimmt Meter, „542,37 km“
daneben verleitete dazu, 542 zu tippen.

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
Trupps, dazu der Name der Planung und je Strecke die Zahl der geplanten Punkte.

Die **Kennung** der Planung reist ausdrücklich NICHT mit – sie könnte es gar
nicht, siehe unten. Und **neu am Bauort angelegte Strecken** reisen vorerst
ebenfalls nicht mit: sie brauchten ihre ganze Soll-Geometrie im Gepäck, also
genau das, was die Baumeldung klein hält, und beim Planer eine zweite
Entscheidung („anlegen oder verwerfen“). Das steht unter „Offen“. Das hält sie klein – Ist-Punkte und Materialzeilen wiegen weniger als
die Planung, die hingeschickt wurde, und die reist heute in gut 2 000 Zeichen.

**Zusammenführen ist erlaubt**, eng geschnitten: eine Baumeldung ersetzt genau
die Bauabschnitte, die sie nennt, und rührt die Soll-Geometrie nicht an. Vor
dem Einspielen zeigt ein Dialog, welche Strecken und welche Abschnitte
betroffen sind, von welchem Trupp die Meldung stammt und was überschrieben
wird.

**Zugeordnet wird über den NAMEN der Strecke.** Das ist keine Bequemlichkeit,
sondern die einzige Möglichkeit: `verschlanken()` wirft die Streckenkennungen
weg, weil sie ein Achtel der Linklänge kosten, `planungAusFragment()` löscht
sogar die Projektkennung, und der Teilexport in `io.js` vergibt selbst eine
neue. Die Planung beim Trupp trägt also von Anfang an andere Kennungen als die
beim Planer – über sie ließe sich nichts zuordnen. Was beide Seiten teilen, ist
der Name. Gefunden wird nur, was eindeutig ist; bei zwei gleichnamigen Strecken
bleibt der Vorschlag leer, und der Planer entscheidet im Dialog. Ein
Zufallstreffer legte die Aufnahme eines Trupps auf die falsche Trasse.

**Mitgeschickt wird die Zahl der geplanten Punkte.** Die Verweise der
Baudokumentation stehen als Stelle in der Punktliste, und die stimmen nur,
solange der Plan derselbe ist. Hat der Planer seit der Übergabe einen Punkt
eingefügt, sagt die Zahl das – die Vorschau warnt, und was sich nicht sicher
auflösen lässt, wird gelöst statt auf den falschen Punkt gelegt. Der
aufgenommene Punkt bleibt stehen; er bestätigt dann nur nichts mehr.

**Was nicht abschnittsweise ersetzt wird:** Prüfung und Übergabe gehören der
ganzen Leitung und nicht einem Abschnitt – eine Meldung über einen Teil der
Strecke trägt sie nur ein, wo beim Planer noch nichts steht. Der Baustand der
Strecke wird der niedrigere von beiden: meldet ein Trupp „gebaut“ für seinen
Abschnitt, kann der andere noch unterwegs sein. Und zwei Abweichungsmeldungen
werden aneinandergehängt statt ersetzt, denn der S 6 braucht beide.

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
wie `bildspeicher.js` es mit den Lichtbildern tut.

Gemessen mit `js/kacheln.js`, gerade Trasse, 300 m Puffer:

| Trasse | Zoom 13–17 | Zoom 13–18 | Zoom 12–16 |
|---|---|---|---|
| 2 km | 146 Kacheln ≈ 2,9 MB | 425 ≈ 8,3 MB | 75 ≈ 1,5 MB |
| 5 km | 271 Kacheln ≈ 5,3 MB | 829 ≈ 16,2 MB | 123 ≈ 2,4 MB |
| 10 km | 470 Kacheln ≈ 9,2 MB | 1 505 ≈ 29,4 MB | 192 ≈ 3,8 MB |
| 20 km | 896 Kacheln ≈ 17,5 MB | 2 894 ≈ 56,5 MB | 354 ≈ 6,9 MB |

Der Überschlag von 3 bis 5 MB für die übliche Trasse hat gehalten. Vorgabe ist
Zoom 13 bis 17; Stufe 18 vervierfacht die Zahl und zeigt nichts, was am
Bauplatz jemand braucht. Abgetastet wird der Linienzug und nicht sein
umschließendes Rechteck – bei einer quer über die Karte laufenden Trasse ist
das der Unterschied zwischen 6 km² Korridor und 100 km² Rechteck.

**Der Vorrat hält die Karte, mit der gearbeitet wird – und nur die.** Der
Bauauftrag zeichnet die Graustufenvariante (`grauVariante()` in `js/map.js`),
und das sind andere Adressen. Wer am Bauort ein Blatt am Schirm aufschlägt,
sieht die Karte darin deshalb leer. Das ist hingenommen: am Bauplatz wird nicht
gedruckt, das Blatt kommt aus der Unterkunft mit. Den doppelten Vorrat bezahlte
sonst der Kachelserver.

**Die Menge ist gedeckelt, und zwar nicht aus Sparsamkeit.** Die
Nutzungsbedingungen von OpenStreetMap untersagen das massenhafte Vorabladen
ausdrücklich. Ein Werkzeug, das auf Knopfdruck zehntausend Kacheln zieht, wird
ausgesperrt – und dann steht der ganze FMBauplaner ohne Karte da, nicht nur der
Vorrat. Deshalb 2 000 Kacheln als Obergrenze, vier Abrufe nebeneinander und
eine Pause dazwischen.

Das Vorladen berührt die Zusage in `datenschutz.html`, und beim Bauen hat sich
gezeigt, dass der erste Entwurf dieses Absatzes die Sache beschönigt hat. Es
stimmt nicht, dass nur „die Gegend“ hinausgeht: die Kacheln kommen in einem Zug
und liegen in einem schmalen Band, und dieses Band **ist** die Trasse, auf
Kachelbreite gerundet – bei Zoom 17 rund 190 m (nachgerechnet mit
`kachelMeter()`). Der Anbieter kann daraus den Weg ablesen, nicht die Punkte. Das steht jetzt so in `datenschutz.html` unter
den Ausnahmen, neben den beiden Overpass-Abfragen, und ebenso im Klartext über
dem Knopf. Wer es nicht will, baut ohne mitgenommene Karte.

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

1. ~~`bau`-Block, Schemaerhöhung, Umschalter Planungsmodus / Baumodus,
   Bauabschnitte und Trupps, Ist-Punkte auf drei Wegen.~~ **Gebaut.**
   Datenmodell in `js/state.js` (Schema 13, Weißliste `bauNormalisieren()`),
   Fachlogik in `js/baudoku.js`, Liste in `js/ui.js`, Ist-Ebene der Karte in
   `js/strecken.js` hinter der Option `mitIst`, Codec in `js/teilen.js`.
   Geprüft mit `node scripts/baumodus-pruefen.mjs`.
2. ~~Materialliste mit Katalog und Soll-Gegenüberstellung, Baumeldungen,
   Messungen und Übergabe.~~ **Gebaut.** Katalog und Prüfarten in
   `js/vorschrift.js` (`MATERIALKATALOG`, `PRUEFARTEN`), Fabriken und Weißliste
   in `js/state.js` (Schema 14), Fachlogik in `js/baudoku.js`, drei Blöcke im
   Bau-Reiter von `js/ui.js`, Codec in `js/teilen.js`. Geprüft mit
   `node scripts/baumodus-pruefen.mjs`.
3. ~~Baumeldung als Link und Datei zurück; Einspielen beim Planer mit Vorschau;
   Zusammenführen mehrerer Trupps.~~ **Gebaut.** Format und Codec in
   `js/teilen.js` (`alsBaumeldung`, Kennung `m1.`), Einordnen und Einspielen in
   `js/baumeldung.js`, Vorschau und Rückwegblock in `js/ui.js`, Dateierkennung
   in `js/io.js`. Geprüft mit `node scripts/baumodus-pruefen.mjs`.
4. ~~Offline: Service Worker und Kachelvorrat.~~ **Gebaut.** Der Wächter in
   `sw.js` legt ab, was die Anwendung lädt – keine Dateiliste, die jemand
   nachpflegen müsste –, der Vorrat liegt in `js/kacheln.js`, und die Karte
   liest ihn über `vorratsEbene()` in `js/map.js`. Geprüft mit
   `node scripts/offline-pruefen.mjs`, das das Netz im Browser wirklich
   abschaltet.
5. ~~Druckerzeugnis Baudokumentation, alle vier Formate.~~ **Gebaut.** Eigener
   Modus `baudoku` in `js/bauauftrag.js` mit eigenem Optionsprofil
   (`fbp.baudoku.v1`, A4 hoch), Kartenblatt über `mitIst` und Nachweisblätter
   über denselben Blattfluss wie die Datenblätter des Bauauftrags. Geprüft mit
   `node scripts/baumodus-pruefen.mjs`; die vier Formate im Browser gegengemessen,
   Firefox auf macOS steht aus.
6. Lichtbilder: Aufnahme am Punkt, Speicher, Rückweg.

Die Stufen 1 bis 3 sind am Schreibtisch prüfbar, Stufe 4 nur am Gerät.

## Vermessen am Gerät

Die Anwendung ist am Rechner entstanden und am Rechner bedient worden. Der
Baumodus steht aber auf einem Telefon, im Stehen, einhändig, oft mit
Handschuh. Vor Stufe 6 ist sie deshalb einmal vollständig am Gerät vermessen
worden – fünf Durchgänge in echtem Chromium mit Fingerbedienung, in 360×740,
390×844, 844×390 und 820×1180: Planungsmodus, Baumodus, Dialoge und Menüs,
Druckansicht, Breitenwechsel. Gemessen wurden wirksame Trefferzonen, nicht
Kastenmaße.

Vier Befunde waren Sackgassen, also Stellen, an denen die Bedienung nicht nur
mühsam, sondern unmöglich war:

- Jedes Eingabefeld lag unter 16 px. Safari auf iOS zoomt beim Fokus hinein
  und kehrt nicht zurück – wer am Bauort eine Materialmenge einträgt, arbeitet
  danach in einer vergrößerten Ansicht weiter, deren Rand er nicht mehr sieht.
- Das Dateimenü hatte weder `max-height` noch `overflow`. Quer auf dem Telefon
  ist es 693 px hoch bei 390 px Schirm: sichtbar war ein Eintrag, und nichts
  deutete an, dass Sammel-PDF, Lagekarte und die drei Ausgabeformate darunter
  stehen.
- `.dialog { max-height: 88vh }` stand gegen eine feste Hülle, die keine
  Rollbewegung annahm. `vh` misst die große Ansicht; solange die Adressleiste
  steht, fehlen 60 bis 100 px, und zwar unten, beim Fußknopf.
- `env(safe-area-inset-*)` stand an zwei Stellen, beide in
  `@media (max-width: 900px)`, während `viewport-fit=cover` ohne Bedingung im
  Kopf der Seite steht. Unter dem Bedienbalken lagen die Gitterangabe der
  Statusleiste und, in der Druckansicht, „Drucken“ und „Schließen“.

Dazu kam eine Stelle, an der die Oberfläche eine Entscheidung verdeckte: die
Vorschau einer Baumeldung öffnete auf dem Telefon 117 px weggerollt, weil der
Fokus auf das erste Bedienelement sprang. Weg war der Satz „Zusammengeführt
wird nichts“ – der Planer entschied über ein Überschreiben, ohne ihn gelesen
zu haben. Der Fokus setzt jetzt `preventScroll`.

Festgehalten ist das in `scripts/geraete-pruefen.mjs`. Zwei Regeln dieser
Prüfung sind selbst aus Fehlern entstanden: `offsetParent` taugt in der
Schmalansicht nicht als Sichtbarkeitsprobe (ein fest positionierter Vorfahr
macht sie für jedes Feld null, und die Prüfung fand deshalb kein einziges und
bestand genau deshalb), und seit CSS-Nesting trägt jede Stilregel eine leere –
also wahre – `cssRules`-Liste, was eine Suche über die Stilbögen still ins
Leere laufen lässt.

## Getroffene Festlegungen

| Frage | Entscheidung |
|---|---|
| Soll und Ist | nebeneinander, Soll unangetastet |
| Zugang | Umschalter Planungsmodus / Baumodus, eine Anwendung |
| Einheit der Dokumentation | die Strecke, also der Bauauftrag |
| Mehrere Trupps | Bauabschnitte je Strecke, jede Eintragung trägt ihren Abschnitt |
| Erfassung des Verlaufs | bestätigen, „Punkt hier“, antippen – kein Mitschnitt |
| Änderungsrecht des Trupps | unbegrenzt, auch neue Strecken |
| Materialliste | fester Katalog nach dem Extranet-Blatt, Soll daneben, nicht vorbelegt; die drei Spalten des Papierbogens entfallen |
| Rückweg | Baumeldung als Link oder Datei, nur die `bau`-Blöcke |
| Zusammenführen | ja, abschnittsweise ersetzend, mit Vorschau; Kollision fragt |
| Offline | Service Worker plus Kachelvorrat, vor dem ersten Einsatz |
| Viertes Blatt | Baudokumentation, ersetzt die Technische Fernmeldeskizze |
| Lichtbilder | vertagt in Stufe 6 |

## Offen

- **Die Fundstelle des Materialblattes.** Für `js/vorschrift.js` fehlen
  genauer Titel und Stand der im THW-Extranet veröffentlichten Fassung. Der
  Katalog steht deshalb ohne `quelle` und `fundstelle` dort – als einziger
  fachlicher Bestand der Datei. Eine erfundene Gliederungsnummer wäre schlimmer
  als keine: am Bauort wird nach der Nummer gesucht, und eine, die es nicht
  gibt, kostet Zeit. `fundstelleText()` gibt für einen Eintrag ohne Fundstelle
  eine leere Zeichenkette, die Oberfläche trägt also nichts Falsches. Sobald
  die Angabe vorliegt, gehört sie an jede Zeile.

- **Neu angelegte Strecken kommen noch nicht zurück.** Der Trupp darf am Bauort
  eine Strecke anlegen, weil der Weg anders lief – auf seinem Gerät steht sie
  dann, die Baumeldung nimmt sie aber nicht mit. Sie braucht ihre volle
  Soll-Geometrie und beim Planer einen eigenen Entschluss; bis dahin ist der
  Weg für diesen Fall die ganze Planungsdatei.

- **Die Werkzeugleiste deckt am Telefon ein Fünftel der Karte.** Sie steht
  bewusst im Daumenbereich und mit Beschriftung – vier Glyphen allein sind
  nicht auseinanderzuhalten, und `title` zeigt kein Touchgerät an. Quer nimmt
  sie damit aber 53 % der Kartenhöhe im linken Drittel ein, und ein
  Einfügegriff darunter war mit keiner Geste zu erreichen. Der Ausweg wäre
  derselbe Klappkopf, den die Kartenoptionen daneben schon haben; das ist
  Markup, Zustand und eine Entscheidung darüber, wie sie startet, und gehört
  nicht in eine Runde, die Maße nachzieht.

- **Der Bau-Reiter ist 5 090 px lang.** In einem 578 px hohen Fenster sind das
  8,8 Bildschirmhöhen, auf einem kleinen Android 10,9. Bis „Meldung jetzt“ sind
  es 4,7, bis zur Übergabe 7,5. Die ersten anderthalb Bildschirme gehören dem
  Kachelvorrat – einer Handlung, die im Depot stattfindet und nie am Bauort.
  Ein Sprungstreifen unter den Reitern und der Vorratsblock nach hinten wären
  zusammen die größte Verbesserung; beides ändert die Anordnung und nicht die
  Maße.

- **Drei Löschgriffe ohne Rückfrage, 4 px neben einem Eingabefeld.**
  Bauabschnitt, Baumeldung und Prüfzeile löschen sofort. Der Rückweg ist
  „Rückgängig“ in der Kopfzeile – jetzt 44 px breit statt 31, aber weiterhin
  eine Kopfzeile weit weg von der Stelle, an der der Fehlgriff geschah. Ein
  Rückholhinweis in der Hinweisbox („Meldung gelöscht · Rückgängig“) wäre die
  Antwort, und die gehört zur Hinweisbox und nicht zum Bau-Reiter.

- **Die Tooltips der Karte gibt es mit dem Finger nicht.** Punkt, Linie,
  Zeichen, Fläche und Relais tragen ihre Angabe in einem `mouseover`-Tooltip;
  am Telefon erscheint keiner. Bei den Bildmarken ist der Fall schon gelöst
  (`js/bilder.js`, „Am Bauort gibt es kein Überfahren“); die anderen fünf
  brauchen dieselbe Entsprechung.

- **Tipps unter 200 ms Abstand gehen beim Zeichnen verloren.** Gemessen: bei
  0 ms Abstand kommen 2 von 6 Punkten an, bei 100 ms 5 von 6. Ursache ist die
  Doppeltipp-Unterdrückung, und nichts in der Oberfläche sagt es an. Der saubere
  Weg wäre, die Punkte im Zeichenmodus aus `touchend` statt aus dem abgeleiteten
  `click` zu setzen.

- **Das Soll steht nur an einer einzigen Zeile.** Die Planung rechnet den
  Kabelbedarf, und damit hat genau die Kabelzeile ein Soll. Bauhaken,
  Abspannringe, Erder und Anschlussleisten rechnet sie nicht – dort steht
  nichts daneben, und das ist Absicht: eine hergeleitete Zahl („zwei Ableiter
  je Strecke über 40 m“) sähe am Bauort wie eine Vorgabe aus und wäre doch nur
  geraten.
- **Wie lange der Vorrat liegen bleibt.** Er wird nie von selbst abgeräumt.
  Nach einem halben Jahr liegen die Kacheln von zehn Baustellen im Gerät, und
  niemand weiß mehr, welche wozu gehörten. Ein Vorrat je Planung – oder eine
  Verfallszeit – wäre der nächste Schritt; bis dahin gibt es den Knopf
  „Vorrat löschen“.
