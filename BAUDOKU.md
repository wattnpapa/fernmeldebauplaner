# Was gebaut wurde, festhalten

Wie aus dem Planungswerkzeug eines wird, das den Bau begleitet: der Trupp hält
am Bauort fest, was er tatsächlich gebaut hat, und meldet es an den Planer
zurück, der die Meldungen mehrerer Trupps zu einer Lage zusammenfügt. Dieses
Papier hält die Entscheidung und ihre Begründung fest; was am Quelltext zu
beachten ist, steht in `CLAUDE.md`, die Zusage an den Nutzer in
`datenschutz.html`, die beiden Wege nach draußen in `TEILEN.md` und `CLOUD.md`.

Stand: Stufen 1, 2 und 4 gebaut. Stufe 1 – Datenmodell, Umschalter,
Bauabschnitte, Ist-Punkte auf drei Wegen, die gebaute Trasse auf der Karte und
der Rückweg über Datei, Link und Speicher. Stufe 2 – Materialnachweis nach
festem Katalog, Baumeldungen als Zeitschiene, Prüfung je Leitungsstamm und die
Übergabe. Stufe 4 – die Anwendung startet ohne Netz, und die Karte lässt sich
für den Bauort mitnehmen. Damit ist der Baumodus draußen brauchbar und der Bau
vollständig dokumentierbar. Die Stufen 3, 5 und 6 stehen aus.

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
3. Baumeldung als Link und Datei zurück; Einspielen beim Planer mit Vorschau;
   Zusammenführen mehrerer Trupps.
4. ~~Offline: Service Worker und Kachelvorrat.~~ **Gebaut.** Der Wächter in
   `sw.js` legt ab, was die Anwendung lädt – keine Dateiliste, die jemand
   nachpflegen müsste –, der Vorrat liegt in `js/kacheln.js`, und die Karte
   liest ihn über `vorratsEbene()` in `js/map.js`. Geprüft mit
   `node scripts/offline-pruefen.mjs`, das das Netz im Browser wirklich
   abschaltet.
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
