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
Baudokumentation als viertes Druckblatt. Nach dem Vermessen am Gerät kam die
Karte als Bedienfläche dazu: Bauleiste und Punktkarte (`js/baukarte.js`),
siehe „Die Oberfläche im Baumodus“. Stufe 6 – die Lichtbilder – steht aus.

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
  punkte:     [ { id, lat, lng, art, bauweise, name, bemerkung,
                  abschnitt, sollPunkt, quelle, genauigkeit, zeit } ],
  material:   [ { id, artikel, menge, abschnitt, bemerkung } ],
  meldungen:  [ { id, zeit, text, abschnitt } ],
  pruefung:   { staemme: [ { id, stamm, art, ergebnis, bestanden, zeit, pruefer } ],
                uebergabeAn, uebergabeZeit, uebergabeName },
  abweichung: '',
  abgesetzt:  { zeit, weg: 'link' | 'datei', abdruck } | null
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

**`abgesetzt`** hält fest, dass die Baumeldung dieser Strecke hinausgegangen
ist: wann, auf welchem Weg und mit welchem Inhalt. Der `abdruck` ist eine
Prüfsumme über genau das, was `bauVerschlanken()` verschickt (`bauAbdruck()` in
`js/teilen.js`) – nur über ihn lässt sich „seit dem Absetzen ist etwas
dazugekommen“ von „unverändert abgesetzt“ unterscheiden. Eine Anzahl von
Eintragungen bekäme eine geänderte Menge nicht mit.

Der Vermerk bleibt am Gerät und reist nicht mit: für den Planer wäre er die
Auskunft, wann der Trupp gemeldet hat, und die steht als `gemeldet` in der
Meldung selbst. Ohne ihn sah der Rückmeldeblock vor und nach dem Absetzen
gleich aus – nach einer Unterbrechung war am Bauort nicht zu entscheiden, ob
gemeldet ist. Dann wird entweder doppelt gemeldet, und beim Planer ersetzt die
zweite Meldung Eintragungen, oder gar nicht.

**`art` und `bauweise`** sagen, was an der Stelle gebaut wurde. Die Art kommt
aus derselben Liste wie beim geplanten Punkt (`PUNKTARTEN`), seit Schema 15
um **Sonstiges** ergänzt – der Trupp nimmt auf, was am Ort steht, und nicht
jede Stelle hat im Plan einen Namen. Die Bauweise gibt es nur an der Querung:
Überbau, Unterbau, an einem Bauwerk entlang, wie die Trasse. Sie ist dasselbe
Feld wie am geplanten Punkt, nur mit der Vorgabe `null` statt „wie die
Trasse“: am Bauort heißt kein Eintrag „nicht angegeben“, und eine Vorgabe
stünde auf dem Bogen wie eine Aussage des Trupps. Bestätigt der Trupp eine
geplante Querung „wie geplant“, geht ihre Bauweise mit.

Seit Schema 16 hat die Art einen dritten Zustand: **noch offen**. Ein Punkt,
der über „Punkt hier“ oder den Kartentipp entsteht, trägt sie, bis der Trupp
einen Chip antippt – vorher stand dort „Trassenpunkt“ vorbelegt. Das war
dieselbe Vorbelegung, die bei der Bauweise aus gutem Grund unterblieb: wer an
der Muffe steht, unterbrochen wird und „Fertig“ drückt, hatte damit eine Muffe
als Trassenpunkt dokumentiert – als Aussage des Trupps und nicht als Lücke. Die
offene Art gibt es nur am aufgenommenen Punkt (`nurIst` in `PUNKTARTEN`, die
Planung wählt aus `PLANPUNKTARTEN`), sie trägt auf der Marke ein Fragezeichen
und wird in Liste, Rückmeldeblock und Blatt als offen geführt. Ein Stand von
vor Schema 16 wird NICHT umgeschrieben: was damals als Trassenpunkt eingetragen
wurde, ist eine dokumentierte Aussage und keine Lücke.

## Wie der Verlauf entsteht

Drei Handgriffe, mehr nicht:

- **Geplanten Punkt bestätigen** – der Regelfall. Der Punkt wird angetippt,
  in der Liste oder auf der Karte, die Koordinate aus dem Plan übernommen.
- **Punkt hier** – der Standort des Geräts wird als Ist-Punkt übernommen.
- **Punkt auf der Karte** – antippen, wo er wirklich liegt.

Alle drei gibt es zweimal: in der Liste des Bau-Reiters und auf der Karte
selbst, über die Bauleiste und die Punktkarte (siehe „Die Oberfläche im
Baumodus“). Beide Wege schreiben über dieselben Fabriken in `js/baudoku.js`
in denselben `bau`-Block; die Liste ist der Bogen, die Karte der Griff.

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

## Wer meldet

Trupp und Truppführer standen nur am Bauabschnitt, und der ist freiwillig. Wer
ohne Abschnitt baute – der Regelfall bei einer Strecke, die ein Trupp allein
macht –, setzte damit eine Meldung ab, die niemanden nennt: beim Planer hieß
sie „ohne Bauabschnitt“, und meldete ein zweiter Trupp an derselben Strecke,
trat dessen Aufnahme an die Stelle der ersten. Gewarnt wurde nur der Planer.

Deshalb trägt die Meldung ein Feld `von`, und der Rückmeldeblock fragt danach –
zwei Felder unmittelbar über den Absetzgriffen, keine Pflicht. Der Name liegt
im GERÄTESPEICHER (`fbp.trupp.v1`, verzeichnet in `datenschutz.html`) und nicht
in der Planung: er sagt, wer gerade am Gerät steht, und geht mit der Baumeldung
hinaus, nicht mit einer weitergereichten Planung. Wo Bauabschnitte angelegt
sind, gehen deren Trupps vor – dort steht, wer welchen Teil gebaut hat.

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

**Dieser Dialog geht nicht beiläufig zu.** Er kennt zwei Ausgänge, „Verwerfen“
und „Einspielen“, und sie stehen an den gegenüberliegenden Enden der Fußzeile;
Esc, ein Tipp auf den Schleier und ein Schließkreuz gibt es nicht. Die Meldung
ist nicht zu wiederholen: sie kam über Funk oder aus einer Nachricht, die nicht
noch einmal zur Hand ist, und der Schleier bot am quer gehaltenen Telefon 54 px
genau dort an, wo die Daumen liegen. Aus demselben Grund wird das Fragment der
Adresse erst mit der Entscheidung geräumt und nicht davor: solange niemand
entschieden hat, bringt ein Neuladen die Meldung wieder herein. Die Zusage aus
`datenschutz.html` bleibt gewahrt – die Adresse trägt die Meldung nur, solange
der Dialog offen steht, und `fragmentRaeumen()` schreibt mit `replaceState` in
denselben Verlaufseintrag.

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

Der erste Stand hatte alles in die Liste gelegt, und am Telefon war das eine
Sackgasse: die Liste liegt dort VOR der Karte, der Bau-Reiter war fünftausend
Bildpunkte lang, und wer am Bauort einen Punkt aufnehmen wollte, musste erst
umschalten, dann rollen, dann treffen – und danach in der Liste suchen, wo
der Punkt gelandet war, um zu sagen, was dort steht. Deshalb ist die Karte
seither die Bedienfläche des Baumodus (`js/baukarte.js`); die Liste bleibt der
vollständige Bogen.

**Die Bauleiste.** Im Baumodus trägt die Werkzeugleiste der Karte vier Griffe
in einer Reihe: **Punkt hier**, **Auf Karte**, **Koordinate**, **Standort**.
„Punkt hier“ ist gefüllt gesetzt – er ist der Regelfall und muss mit dem
Daumen gefunden werden, ohne hinzusehen. Schmal ist die Leiste ein Streifen
von gut 50 px statt der zwei Reihen der Planungswerkzeuge; die Beschriftung
bleibt, weil vier Glyphen allein nicht auseinanderzuhalten sind. Beide Griffe
gelten der Strecke, die im Bau-Reiter gewählt ist; die Punktkarte nennt sie
danach im Kopf.

**Die Punktkarte.** Ein Blatt am unteren Kartenrand, an derselben Stelle wie
die Bauleiste – die eine löst die andere ab. Es zeigt EINEN Punkt. Ist er
aufgenommen, fragt es „Was ist hier?“ und bietet die Arten als Chips an:
Trassenpunkt, Muffe, Reserve, Mast, Querung, Verteiler, Sonstiges; an der
Querung folgt „Wie gequert?“ mit den Bauweisen. Ein Tipp schreibt, es gibt
kein „Übernehmen“. Darunter Bemerkung, bei zusätzlichen Punkten die
Bezeichnung, dann Neu orten, Verschieben, Löschen, Fertig. Ist der Punkt
geplant und noch offen, stehen dort die drei Wege ihn aufzunehmen. Kein
Dialog: die Karte bleibt sichtbar und bedienbar, denn der Trupp will sehen,
WO der Punkt liegt, den er benennt; ein Tipp neben das Blatt schließt es.

**Was eine Wahl erst erzeugt, wird ins Bild gerollt.** „Wie gequert?“ entsteht
mit dem Chip „Querung“ – und entstand unterhalb der festgehaltenen
Abschlusszeile: das Blatt misst gedeckelt 313 px, sein Inhalt 636. Wer die
Frage nicht sah, beantwortete sie nicht, drückte „Fertig“, und die eine Angabe,
wegen der die Querung aufgenommen wird, fehlte still. Das Blatt rollt jetzt
hin (`zeigeImBlatt`), sprunghaft und nicht weich – die Bewegung wäre kürzer als
ihre eigene Dauer, und solange sie läuft, steht der Rollstand weder für den
Trupp noch für die Geräteprüfung fest. Die Frage nennt sich selbst offen,
solange keine Bauweise steht, und „Fertig“ sagt beim Schließen, was fehlt.

**Der Rollstand wird gesetzt und nicht dem Browser überlassen.** Ein frisch
aufgeschlagenes Blatt beginnt oben; wer unten bei der Bemerkung war, bleibt
dort. Dazwischen lag der Fall, den die Geräteprüfung fand: die Rollverankerung
des Browsers verschob das Blatt beim Neuaufbau um 2 bis 18 px, und damit stand
das Schließkreuz nicht mehr ungerollt im Bild (`overflow-anchor: none`).

**Ein Blatt für die gescheiterte Ortung.** „Position nicht verfügbar:“ endete
mit einem Doppelpunkt, hinter dem auf dem Telefon oft nichts stand – weder
Ursache noch nächster Schritt. Jetzt nennt jeder der drei Fälle (gesperrt, kein
Fix, Zeitüberschreitung) den Grund, und das Blatt trägt beide Auswege: noch
einmal orten und auf der Karte setzen, Letzteres mit allem, was die Aufnahme
sonst mitbekommen hätte. In die Meldungspille gehört der Griff nicht – die
nimmt seit dem Gerätelauf ausdrücklich keine Tipps mehr entgegen.

**Quer nutzt das Blatt die Breite.** Bei 667×375 blieben ihm 161 px, davon
nahmen Kopf und Abschlusszeile 130: rund 40 px für Befund, Chips und Felder,
und die Chipreihe stand nicht darin – „Querung“ war quer nicht zu beantworten.
Drei Handgriffe zusammen: die Kopfzeile der Anwendung steht quer einreihig
(ohne Wortmarke, das Namensfeld gibt nach) und gibt 46 px frei, der Kopf des
Blattes steht einzeilig, und der Inhalt teilt sich in zwei Spalten – links, was
angetippt wird, rechts, was geschrieben wird. An die Seite gelegt wäre es bei
dieser Höhe der falsche Tausch gewesen: die schmale Spalte bricht die Chipreihe
wieder um. Seit der vierten Runde steht es quer doch an der Seite – siehe dort.

**Kopf und Abschluss bleiben stehen, der Rest rollt.** Das Blatt war höher als
die Karte und rollte als Ganzes: bei 390×690 lag „Fertig“ 56 px unter der
Kante, quer fiel sogar die Chipreihe darunter, derentwegen das Blatt
aufschlägt. Kopf und Abschlusszeile sind deshalb festgehalten – dieselbe
Arbeitsteilung wie `dialog-kopf`/`dialog-inhalt`/`dialog-fuss` –, gerollt wird
nur Befund, Chips und Felder. Beide Ausstiege sind damit immer da, in jedem
Fenster und in jedem Zustand.

**Das Blatt ist gedeckelt, und der Streifen Karte darüber ist Bedienfläche.**
Höchstens 60 % des Kartenbereichs, vorher bis auf 12 px an dessen Oberkante.
Die 12 px waren rechnerisch der Rückweg „ein Tipp neben das Blatt schließt es“
und mit dem Handschuh nicht zu treffen; das Soll-Blatt hat keinen anderen
Ausstieg als Kreuz und Kartentipp. Bei 390×690 sind es jetzt 74 px, und das
Blatt reicht nicht mehr hinter die Zoomsteuerung.

**Das Schließkreuz steht links.** Rechts oben liegt Leaflets Zoomsteuerung
über dem Blatt; von den 44 px des Kreuzes waren dort 25 wirksam, die rechte
Hälfte zoomte aus statt zu schließen. Links steht bei keiner Breite etwas von
Leaflet.

**„Fertig“ hat keinen Nachbarn.** Zurücknehmen und Löschen wirken sofort und
standen mit 6 px Abstand gleich groß daneben – mit dem Handschuh nimmt dieser
Fehlgriff die eben eingetragene Aufnahme zurück, und der Rückweg dafür liegt
oben in der Kopfzeile. Die Korrekturen stehen jetzt in der Zeile darüber, die
Gefahrtaste an deren rechtem Ende, „Fertig“ allein in voller Breite darunter.

**Die Meldung schweigt, wo das Blatt spricht.** Jede Aufnahme meldete
„Aufgenommen: <Gitterangabe> (±7 m)“, und unmittelbar danach schlug die
Punktkarte mit derselben Auskunft auf. Die Pille sagte damit nichts Neues,
stand aber 3,2 s über Maßstab, Quellenzeile und Statusleiste – über der
Gitterangabe also, die nach der Aufnahme abgelesen wird – und fing dabei jeden
Tipp ab, der dem Griff darunter galt; mit Handschuh liest sich das als
kaputter Knopf, und der zweite Tipp zoomt die Karte. Sie nimmt jetzt keine
Tipps mehr entgegen, und wo das Blatt die Auskunft trägt, wird gar nicht erst
gemeldet – „Position wird ermittelt …“ wird dabei abgeräumt statt stehen
gelassen. Aus der Liste heraus schlägt kein Blatt auf; dort bleibt die
Meldung, ohne die Gitterangabe, die eine Zeile weiter in der Liste steht.

**Quer rückt das Blatt über Statusleiste und Maßstab.** Bei 667×375 bleiben
vom Kartenbereich 59 px – weniger, als Kopf und Abschluss zusammen messen.
Solange das Blatt steht, trägt es die Koordinate des Punktes selbst; die
Statusleiste nennt nur die zuletzt angetippte Stelle. Der Umschalter
Liste/Karte bleibt frei, er ist der Rückweg.

Das Blatt schlägt von selbst auf, sobald ein Punkt aufgenommen ist – aus der
Bauleiste, vom Kartentipp, aus dem Koordinaten-Popup –, und auf Tipp auf eine
Marke: an der gebauten mit der Frage, was dort ist, an der geplanten mit den
drei Wegen. Das ersetzt am Bauort die Tooltips, die kein Touchgerät zeigt.

**Die Modusleiste beim Setzen zeigt nur, was wirkt.** „Auf Karte“ startet den
Ist-Setzmodus; schmal weicht die Bauleiste, und die Leiste am unteren
Kartenrand ist dann das einzige Bedienelement. Dort standen „Fertig“ und
„Letzten Punkt zurück“ weiter, obwohl der Code sie längst abgeschaltet hatte –
beide ohne Wirkung und ohne Rückmeldung, der gefüllte „Fertig“ mitten im
Daumenbereich. Im Ist-Setzmodus ist der Kartentipp das „Fertig“; es bleibt der
eine Griff, und er heißt nach seiner Wirkung: „Setzen abbrechen“, nicht
„Abbrechen“, das nach Verwerfen des Aufgenommenen klänge. Der Merker daneben
ist kurz, den ganzen Satz sagt die Meldung beim Beginn des Modus. Die Leiste
misst damit 58 px statt 94 bis 147 – so hoch wie die Bauleiste an derselben
Kante.

**Der Plan wird angetippt, nicht gezogen.** Im Baumodus sind die geplanten
Punkte nicht ziehbar und die Einfügegriffe fehlen. Der Griff, der den Plan
verschöbe, wäre mit dem Handschuh der häufigste Fehlgriff, und der Soll-
Verlauf soll dort unangetastet bleiben; wer den Plan ändern muss, schaltet
in die Planung. Wer beim Setzen eines Ist-Punktes die geplante Marke trifft,
sagt „genau hier“ – der Tipp zählt als Kartentipp an dieser Stelle.

**Die Ist-Marke trägt die Art.** Der gefüllte Kreis bleibt; Muffe, Reserve,
Mast, Verteiler und Sonstiges stehen als Buchstabe darin, an der Querung die
Bauweise – dieselben Buchstaben wie an den geplanten Marken. Der gewöhnliche
Trassenpunkt bleibt der leere Kreis: er ist die Regel, und ein Buchstabe an
jedem Punkt machte die besonderen unsichtbar. Die Zeichenerklärung der
Baudokumentation zählt auf, welche vorkommen.

**Was am Bauort nicht gebraucht wird, geht vom Schirm.** Die Kartenoptionen
zeigen im Baumodus vier Zeilen statt neun (Karte, Gitter, Punktnummern,
Punktbezeichnungen); schmal fällt die Herkunftszeile der Statusleiste weg,
die Gitterangabe bleibt einzeilig. Das Koordinaten-Popup bietet „Punkt hier
aufnehmen“ statt „Zeichen setzen“ und „Neue Strecke“; die Tasten S, T, F, R
der Zeichenwerkzeuge sind aus – sie starteten sonst einen Modus, dessen
Leiste es dort nicht gibt.

**Die Kartenaufsätze halten dasselbe Maß wie die Bauleiste.** Die
Werkzeugleiste der Planung stand in zwei Spalten à drei Zeilen und nahm 152 px
– bei 690 px Fensterhöhe fast ein Drittel der Karte, und wer nur den Verlauf
lesen wollte, bekam sechs Werkzeuge über den Inhalt gelegt. Sie steht jetzt
wie die Bauleiste in einer Reihe, Sinnbild über dem Wort, und zählt ihre
Spalten selbst: vier im Baumodus, sechs in der Planung. Die Kartenoptionen
sitzen an der oberen Kante neben der Zoomsteuerung statt 90 px darunter, sind
an den verfügbaren Kartenraum gedeckelt und rollen innen; ein Tipp auf die
Karte schließt sie wie die Punktkarte. Die Zoomsteuerung trägt ihre 44 px –
Leaflets eigene Touch-Regel hatte sie mit zwei Klassen auf 30 px gehalten –,
und der Maßstab daneben nimmt keine Tipps mehr entgegen, er wird abgelesen.
Das Koordinaten-Popup bekommt schließlich gesagt, wieviel oben und unten
belegt ist, damit es im freien Band landet statt unter den Aufsätzen.

Bei 390×690 bleiben damit 231 von 522 px Karte frei statt 95. Quer bleibt es
bei null: dort liegen 146 von 375 px Fensterhöhe über der Karte, ehe ein
Aufsatz zu zählen beginnt – das ist Kopfzeile und Speicherband, nicht die
Karte. Offen bleibt auch, die Werkzeugleiste erst auf Verlangen zu zeigen;
das gäbe beim bloßen Lesen weitere 54 px frei.

**Der Weg durch den Reiter ist kurz, nicht vollständig sichtbar.** Der
Bau-Reiter maß bei 390×690 mit drei aufgenommenen Punkten 4.002 px und wuchs
mit jeder Bestätigung weiter – rund zehn Schirmhöhen, durch die am Mast
gewischt wird. Drei Dinge verkürzen ihn. Eine bestätigte Punktzeile zeigt nur
noch ihren Befund (Nummer, Art, Herkunft der Koordinate, Abweichung) und ihr
Formular erst auf Tipp: 92 px statt 298 bis 427. Materialnachweis, Prüfung und
Übergabe und der Kachelvorrat stehen eingeklappt – sie werden einmal am Ende
gefüllt oder im Depot geholt, nicht laufend; zusammen maßen sie 2.370 px. Und
der Sprungstreifen trägt zwei Chips mehr: „Zurückmelden“ (anfangs „Absetzen“) für den Rückmeldeblock,
der als Abschluss jedes Bauabschnitts am häufigsten gebraucht wird und
ausgerechnet fehlte, und „▤ Doku“, das die Baudokumentation aufschlägt, deren
einziger Aufruf am Ende der Liste stand. Ein Sprungchip klappt den Block, zu
dem er führt, mit auf. Gemessen bleiben mit drei bestätigten Punkten 2.115 px.

**Was der Trupp tut, wird quittiert.** „✓ wie geplant“ meldete nichts zurück,
obwohl es denselben Eintrag erzeugt wie die Standortaufnahme, die quittiert.
Es meldet jetzt kurz und rollt den nächsten offenen Punkt ins Bild – ohne das
rutschte der nächste Griff nach jeder Bestätigung aus dem Sichtfeld, und zwei
Tipps an derselben Bildschirmstelle träfen zwei verschiedene Punkte. Eine
ungültige Menge im Materialnachweis wird sichtbar abgewiesen, statt still zu
`null` zu werden und die Zeile mitzunehmen; die Löschkreuze nennen den
Rückweg über „Rückgängig“. Ohne Strecke zeigt der Reiter kein leeres
Auswahlfeld mehr, sondern den Weg in den Planungsmodus, und im Baumodus bietet
der Strecken-Reiter kein Zeichnen an – dort wird der Bauauftrag nachgeschlagen.

**Der Bau-Reiter** hat einen Sprungstreifen (Karte mitnehmen, Punkte,
Meldungen, Material, Übergabe, Zurückmelden, ▤ Doku). Der Kachelvorrat steht als
Block am Ende, sein Chip aber vorn: das Mitnehmen geschieht im Depot, solange
Netz da ist, und ist dort der erste Handgriff – im Audit merkte der Trupp erst
am Bauort an der leeren Karte, dass er es versäumt hatte.

**Der Streifen steht VOR den Kennzahlen.** Dahinter lag seine zweite Reihe bei
390×690 in der Grundstellung des Reiters halb unter dem festliegenden
Umschalter Liste/Karte: sichtbar genug, um danach zu greifen, und ein Tipp
darauf traf den Umschalter und warf den Trupp auf die Karte – betroffen war
ausgerechnet der Chip zum Rückmeldeblock. Die Reihenfolge stimmt auch sachlich: erst wohin, dann
die Zahlen. Aus demselben Grund trägt der Rollbereich jedes Reiters schmal eine
Polsterung in Höhe des Umschalters – sonst klebt die letzte Zeile unter ihm.

**Der Chip heißt „Karte mitnehmen“ und nicht „Karte“.** Der Umschalter unten
heißt ebenso und steht gleichzeitig im Bild; ein Tipp auf den falschen führte
in den Kachelvorrat statt auf die Karte.

**Der Zähler nennt beide Zahlen.** „0 von 4 Punkten“ stand neben „gebaut
65 m“, wenn der Trupp zwei zusätzliche Punkte aufgenommen hatte – zwei Angaben
über denselben Sachverhalt, die einander widersprechen. Jetzt steht dort
„0 von 4 geplanten bestätigt · 2 zusätzlich aufgenommen“, dazu die Zahl der
Eintragungen ohne Angabe. Der Längenunterschied wird erst ab dem Baustand
„gebaut“ hervorgehoben: während des Baus ist er keine Abweichung, sondern der
Rest des Weges.

**Die Zeitfelder haben ein „Jetzt“.** Baubeginn, Bauende und der Zeitpunkt der
Übergabe blieben leer, weil Datum und Uhrzeit am Bauplatz die teuerste Eingabe
sind – und damit fehlten im Kopf der Baudokumentation genau die Zeiten, die sie
belegen soll. Den Griff gab es im Bestand schon, aber nur am Planungskopf.

Geprüft wird das in `scripts/baumodus-pruefen.mjs` (der zweite Weg zu
denselben Eintragungen, dazu die offene Art, der Absetz-Vermerk samt Abdruck
und der Absender der Meldung) und `scripts/geraete-pruefen.mjs` (Bauleiste höchstens
64 px, mehr als die Hälfte der Karte frei, jeder Griff der Punktkarte auf
Handschuhmaß, quer rollt das Blatt statt überzulaufen). Dort steht das Blatt
zusätzlich in acht Fenstern auf dem Prüfstand: Kreuz und „Fertig“ ohne Rollen
im Bild und mit `elementFromPoint` zu treffen, auch mit gesetzter Querung,
das Kreuz nie unter der Zoomsteuerung, und 16 px um die Gefahrtaste. Ebenso
die Modusleiste nach „Auf Karte“ – nur der Abbruch sichtbar, höchstens 64 px
hoch – und die Meldungspille, die keinen Tipp abfangen und nach einer Aufnahme
keine Leiste zudecken darf.

## Nach dem Audit der THW-Reviewer

Elf Prüfungen aus Sicht von Helfern – Erstnutzer, Trupp unter Stress, mit
Handschuhen, nachts, im Funkloch, Führungsstelle, Papier zuerst – haben den
Baumodus im September 2026 durchgespielt. Was sich daraus hier geändert hat:

**Ein Stand, eine Marke.** Die Streckenliste der Planung trug an jeder Strecke
mit einem einzigen bestätigten Punkt dasselbe grüne „gebaut“ wie an einer
übergebenen; die Führungsstelle zählte beim Überfliegen sechs fertige Leitungen,
wo eine übergeben war. Die Marke ist jetzt der Baustand selbst, jeder mit eigener
Form (offen umrandet, im Bau gestrichelt, gebaut gefüllt, übergeben mit Haken),
daneben Trupp und Zeit des letzten Eintrags, darunter die Meldung an den S 6 im
Wortlaut. Summenband, Einsatzabschnitte und die Lagekarte zählen die Strecken je
Stand.

**„Übergeben“ fragt.** Der Stand ließ sich ohne Empfänger, Zeitpunkt und Messung
setzen und kam beim Planer als fertige Leitung an. Er ist weiter wählbar – die
Übergabe kann auf Papier geschehen sein –, aber nur nach einer Rückfrage, die
nennt, was fehlt.

**„Abgesetzt“ heißt nicht mehr „kopiert“.** Nach dem Kopieren des Links stand
„Abgesetzt … seither unverändert“, auch im Funkloch. Der Vermerk heißt jetzt
„Link erzeugt“ und sagt, dass das Gerät den Empfang nicht kennt; der Chip
„Absetzen“ heißt „Zurückmelden“, der Knopf „Meldung jetzt“ heißt „Meldung
mitschreiben“ – beide versprachen eine Übertragung, die es nicht gibt.

**Zusätzliche Punkte werden geprüft.** Die Abweichung maß nur bestätigte Punkte.
Ein Zusatzpunkt, 82 km neben der Trasse geortet, machte aus 2,7 km gebauter
Trasse 143 km – und darunter stand „Kein Punkt weicht mehr als 25 m ab“. Liegt
ein Zusatzpunkt mehr als `ABSEITS_SCHWELLE` (300 m) neben der Trasse oder ist die
gebaute Trasse mehr als doppelt so lang wie die geplante, warnt der Kopf des
Reiters, und der beruhigende Satz steht nur noch, wenn er stimmt. Eine Ortung,
die so weit vom gewählten geplanten Punkt liegt, wird als zusätzlicher Punkt
aufgenommen und bestätigt ihn nicht; die Zuordnung in der Punktkarte verlangt
dann eine eigene Bestätigung (siehe unten, zweite Runde).

**Der Link an den Bautrupp führt in den Baumodus.** Nach „Übernehmen“ stand der
Trupp in der Planung vor „+ Neue Strecke zeichnen“. Ein Link mit einer
einzelnen Strecke bietet jetzt „Bau beginnen“ an: Baumodus auf dieser Strecke,
einmal „Wer baut?“ (Trupp und Truppführer, am Gerät gemerkt) und der Hinweis,
die Karte mitzunehmen, solange Netz da ist.

**Doppelte und ältere Meldungen werden benannt.** Der Empfangsdialog sagt, wenn
eine Meldung schon eingespielt oder älter ist. Wie „schon eingespielt“
festgestellt wird, hat die zweite Runde geändert (unten).

**Nachtragen vom Meldeblock.** Die Uhrzeit einer Baumeldung ist ein Feld; wer
abends vom Papier nachträgt, bekommt die Zeit vom Blatt statt der des Eintippens.
Der Bauauftrag trägt dafür ein eigenes Blatt „Baunachweis zum Ausfüllen“ mit
denselben Feldern wie der Baumodus.

## Nach der zweiten Runde der THW-Reviewer

Dieselben elf Prüfungen noch einmal, gegen den veröffentlichten Stand. Alle
sahen ihn besser als zuvor; vier Befunde der Stufe P1 waren aber erst durch die
Änderungen der ersten Runde entstanden. Was sich daraufhin geändert hat:

**Wer einen Link übernommen hat, bekommt keine Begrüßung mehr.** Der Einstieg
galt nur als erledigt, wenn jemand ihn selbst schloss. Der Trupp, der über
„Bau beginnen“ kam, bekam ihn deshalb beim nächsten Öffnen über dem Baumodus,
und dessen blauer Knopf „Strecke planen“ legte im Bauauftrag eine zweite
„Strecke 2“ an. Die Übernahme eines Links merkt den Einstieg jetzt, im
Baumodus erscheint er nie, und eine Strecke ohne Punkt, die beim Schließen
mitten im Zeichnen übrig blieb, räumt der Start weg.

**„Schon eingespielt“ wird ausprobiert, nicht an der Uhr abgelesen.** Der
Empfangsdialog verglich nur den jüngsten Zeitstempel und die Zahl der Punkte.
Eine berichtigte Meldung – 31.200 m Kabel auf 3.120 m korrigiert – galt damit
als doppelt, und darüber stand „verwerfen genügt“. `befund()` spielt die Meldung
jetzt an einer Abschrift der Zielstrecke ein und vergleicht den Fingerabdruck
(`bauAbdruck`) davor und danach. Nur wenn beide gleich sind, heißt es „ändert
nichts“, und dann ist „Verwerfen“ der Hauptknopf. Was verloren ginge, wird über
den Inhalt der Einträge gezählt statt über ihre Zahl.

**Der Empfangsdialog nennt, wessen Aufnahme ersetzt wird.** Die Planung merkt
sich an der Strecke, wer die zuletzt eingespielte Meldung geschickt hat
(`bau.gemeldetVon`, Schema 18; ältere Stände öffnen ohne). Kommt eine Meldung
von einem anderen Absender und würde etwas ersetzen, ist das eine Warnung mit
Namen und nicht mehr „3 Punkte weichen“. „Wer baut?“ verspricht keinen Schutz
mehr, den der Name nicht gibt: getrennt bleiben zwei Aufnahmen nur über
Bauabschnitte. Die Meldung an den S 6 und der Standwechsel stehen jetzt oben im
Dialog, denn entschieden wurde vorher ohne sie.

**Neu Eingegangenes bleibt markiert.** Nach dem Einspielen trägt die Strecke in
der Liste „neu“, bis jemand „gesehen“ tippt – gemerkt im Gerät, nicht in der
Planung. Neben der Uhrzeit des letzten Eintrags steht sein Alter, und nach
zwei Stunden ohne Eintrag wird eine Strecke im Bau hervorgehoben.

**Nachtragen mit Tag.** Tag und Uhrzeit lassen sich an Punkten und Meldungen
setzen. In der Meldungszeile ist für ein Tagesfeld kein Platz; dort gilt: eine
Meldung liegt nie in der Zukunft, wer morgens „14:20“ nachträgt, meint gestern.

**Der Baunachweis bildet den ganzen Reiter ab** – Trupp, Punkte, Meldungen,
Kabel, übriges Material, Abweichungen und Meldung an den S 6, Prüfung je Stamm,
Übergabe – und trägt den Auftrag als QR-Code. Gescannt öffnet er dieselbe
Strecke im FMBauplaner. Der Link entsteht beim Drucken und steht nur auf dem
Papier; bis 900 Zeichen wird er zum Code, darüber steht der Hinweis, den Link
zu verschicken. Jeder Blattkopf trägt dazu die Plan-Kennung (`planKennung`),
dieselbe wie im Bau-Reiter.

**Ferne Punkte brauchen eine eigene Bestätigung.** Der zweite Tipp auf
denselben Chip genügte nicht: mit Handschuh tippt man ohnehin oft doppelt. Die
Rückfrage steht jetzt als Knopf an anderer Stelle, und ein bestätigter Punkt,
der weiter als `ABSEITS_SCHWELLE` von seinem geplanten liegt, heißt „prüfen“
statt „✓ gebaut“ und steht in der Warnung oben.

**Quer und mit offener Tastatur** weichen Zoom, Maßstab und Kartenvermerk,
solange die Punktkarte offen ist. Das korrigiert die Festlegung unten, die
Zoomsteuerung stehen zu lassen, für genau diesen Fall: bei 667×375 lag der
Vermerk über „Fertig“, und ein Randtipp auf „Leaflet“ verließ die Anwendung;
zu zoomen gibt es unter einem Blatt, das die Karte deckt, nichts. Die Verweise
im Kartenvermerk öffnen seitdem ein eigenes Fenster.

## Nach der dritten Runde der THW-Reviewer

Die elf Prüfungen ein drittes Mal. Alle sahen den Stand besser als zuvor;
drei Befunde der Stufe P1 waren neu, keiner davon so schwer wie die der
zweiten Runde.

**Ein Tippfehler im Mengenfeld hält den Wert von vorher.** Geschrieben wird
bei jedem gültigen Anschlag, und aus „3l20“ stand nach dem „3“ schon 3 in der
Planung – das Zurücksetzen „auf den bisherigen Wert“ setzte genau darauf.
Bisher heißt jetzt: vor der Eingabe, und dieser Wert wird beim Verlassen des
Feldes auch wieder geschrieben. Das Leerzeichen gilt in Mengenfeldern als
Tausendertrenner wie der Punkt.

**Mehrere Trupps an einer Strecke vergibt der Planer.** Stehen unter „Auftrag an
(Trupp)“ mehrere Namen, durch Komma getrennt, wählt jeder Trupp beim Übernehmen
des Links seinen Namen und bekommt einen Bauabschnitt dieses Namens. Seine
Meldungen ersetzen beim Planer dann nur diesen Abschnitt (`auftragsTrupps` in
`baudoku.js`). Der Abschnitt nimmt auch nach dem Neuladen auf, obwohl die Wahl
des aktiven Abschnitts sonst eine Sache der Sitzung bleibt – das Gerät weiß
hier, welcher Trupp es ist. Eine allgemeine Regel „ein einziger Abschnitt nimmt
immer auf“ war der naheliegendere Weg und ist verworfen: sie bräche die
Festlegung, dass nach dem Neuladen ohne Wahl nichts einem Abschnitt zufällt.

**Riskantes Einspielen ist nicht mehr der Hauptknopf.** Ist die Meldung älter
als der Stand beim Planer oder ersetzt sie die Aufnahme eines anderen
Absenders, steht „Verwerfen“ vorn, daneben „Erst als Datei sichern“ – der Rat
dazu hatte vorher keinen Griff. Der Abstand steht als Spanne da („4 s älter“),
weil zwei Zeiten derselben Minute nichts erklärten. Geänderte Mengen nennt der
Dialog als „alt → neu“ statt als verlorene Zeile.

**Die Baudokumentation passt zum Auftrag:** dieselbe Plan-Kennung über die eine
Strecke, der Tag an jeder Zeit, die nicht vom Tag des Blattkopfs ist, und der
Trupp aus „Wer baut?“ im Kopf. Der Baunachweis steht am Ende des Auftrags als
eigener Block, getrennt von Bemerkungen und Bestätigungen, und hat so viele
Prüfzeilen, wie das Kabel Stämme hat.

**Für die Führungsstelle** zählen Summenband und Abschnittskopf auch „neu“ und
„ohne Meldung seit 2 h“; die Meldung an den S 6 lässt sich als erledigt abhaken
(im Gerät gemerkt, für genau diesen Wortlaut). Die Lagekarte trägt die
Standmarke in Schriftgröße der Längenangabe und „offen“ an noch nicht
begonnenen Strecken.

**Am Bauort:** Die Punktkarte ist höher (75 % statt 60 % des Kartenbereichs),
die Ortungswarnung steht vor der Frage „Welcher Punkt?“. Die Zeichenleiste setzt
ihren Merker über die Knöpfe, die damit quer nicht mehr auf 16 px schrumpfen,
und lässt quer dem Zoom seine Spalte. Beim Zeichnen setzt ein Tipp auf die
Punktmarke einer anderen Strecke einen Punkt genau dort. Der Kartenchip heißt
wie im Hinweis „Karte mitnehmen“ und nennt „kein Netz“ selbst. Eine
nachgetragene Meldungszeit wird von heute aus gerechnet, nicht vom bisherigen
Tag der Meldung.

## Nach der vierten Runde der THW-Reviewer

Die elf Prüfungen ein viertes Mal, diesmal mit Planungs- und Baumodus
gleichermaßen. Neu war vor allem, was an den Übergängen geschieht: ein zweites
Mal geöffneter Auftrag, eine Unterbrechung mitten in der Aufnahme, ein
Rückgängig über den Moduswechsel hinweg. Ein Befund war P0: nach dem Zeichnen
blieb der Bauauftrag gesperrt, mit einer Begründung, die nicht stimmte.

**Ein Wisch verschiebt die Karte, kein Trassenpunkt.** Die Trefferfläche eines
Punktes misst 44 px, und Leaflets Ziehen begann mit der ersten Bewegung,
gleich womit. Ein Wisch, 6 px neben Punkt 1 begonnen, verschob ihn im Review
still um rund 200 m. Am Finger folgt eine Marke – Trassenpunkt, Einfügegriff,
taktisches Zeichen – jetzt erst nach kurzem Halten, und ein Ring um sie zeigt,
wann es so weit ist (`js/ziehen.js`). Die Maus zieht wie bisher sofort. Nach
jedem Ziehen nennt eine Meldung Punkt, Weg und Rückweg. Die Planung im
Planungsmodus bleibt ziehbar; die Festlegung „angetippt, nicht gezogen“ gilt
weiter nur für den Plan im Baumodus.

**Die offene Streckenkarte folgt den Punkten.** Bauauftrag-Knopf und
Plan-Kennung werden bei jedem Punkt nachgeführt; vorher blieb der Bauauftrag
nach drei Punkten gesperrt, mit der Begründung, es fehlten zwei. Die Kennung
rechnet auf den Koordinaten, die der Link trägt. Sonst trugen Planer und Trupp
beim selben Plan zwei Kennungen, sobald die sechste Nachkommastelle über die
Rundungsgrenze kippte. Aus der Deutschlandkarte holt das Zeichnen in zwei
Stufen heran und bietet davor „Ort suchen“ und „Mein Standort“ an. Die
Kurzanleitung schlägt im Baumodus beim Baumodus auf und nennt am Telefon Tipps
statt Tasten. Der Modusschalter nennt weiter den Modus, in dem man ist,
darunter klein, wohin er führt: das Zeichen ⇄ allein las ein Erstnutzer als
„Planung tauschen“.

**„Punkt hier“ schlägt vor, statt „zusätzlich“ vorzuwählen.** Stand der Trupp
6 bis 11 m neben Punkt 2 und tippte gleich „Fertig“, blieb ein Zusatzpunkt
ohne Art und „0 von 3 geplanten bestätigt“. Liegt jetzt genau ein offener
Planpunkt innerhalb der Abweichungsschwelle (25 m), wird er zugeordnet und im
Blatt als „vorgeschlagen“ gezeichnet – gedrückt, gestrichelt, „zusätzlich“
einen Tipp daneben (`sollVorschlag`). Das bricht „geraten wird nichts“ nicht:
geraten hieße still zuordnen, was der Trupp nicht sieht; hier steht die Wahl
benannt in dem Blatt, das ohnehin aufschlägt, und liegen zwei Punkte so nah,
wird weiter gefragt – dann nennt „Fertig“ die fehlende Zuordnung. Zuordnen
über die Punktkarte bringt die Art des Plans mit wie „◉ Hier“; wer die
Zuordnung wieder löst, verliert sie mit.

**Ein Griff, eine Ortung, eine frische Position.** Bei langsamer Ortung legte
ein zweiter Tipp einen zweiten, deckungsgleichen Punkt an; der Knopf heißt
jetzt „ortet …“, und ein weiterer Tipp startet nichts. Bei schneller Ortung
schlug das Blatt dort auf, wo „Punkt hier“ stand, und der zweite Tipp eines
Doppeltipps traf „Fertig“ – das Blatt nimmt die ersten 400 ms keinen
Fingertipp an. Und `maximumAge` ist 0: mit 10 s lag der zweite Punkt 60 m
weiter auf dem ersten, und das Blatt sagte „±6 m“.

**Die Baustrecke wird gemerkt und genannt, bevor aufgenommen wird.** Sie war
Sitzungszustand; nach dem Neuladen nahm `baustrecke()` die zuletzt gebaute,
und „Punkt hier“ landete an Strecke 1 mit dem Satz „5,86 km … Stimmt die
Ortung?“. Jetzt liegt sie im Gerätespeicher wie „Wer baut?“, der Wechsel aus
der Planung übernimmt die dort gewählte, und ein Merker auf der Oberkante der
Bauleiste nennt sie – samt „kein Bauabschnitt gewählt“, wenn die Strecke
Abschnitte hat und nach dem Neuladen keiner aufnimmt. Die Punktkarte fragt
dann danach. Liegt der Standort an einer anderen Strecke, sagt das Blatt das
und bietet „Zu Strecke 2 · Punkt 1“ an.

**Ändern heißt umschalten – auch im Strecken-Reiter und für „↶“.** Dort
standen im Baumodus Weiterzeichnen (dessen „Letzten Punkt zurück“ geplante
Punkte ohne Rückfrage nahm), Richtung umkehren, Löschen, das ✕ am Punkt, Farbe
und Leitung. Sie tragen jetzt `nur-planung`; an ihrer Stelle steht der Auftrag
als Satz und der Knopf in den Planungsmodus. „↶“ hält im Baumodus an der
Grenze: jeder Schritt merkt sich den Modus, in dem er getan wurde (parallel
zum Verlauf, nicht in der Planung), und ein Schritt der Planung wird dort
nicht zurückgenommen, sondern benannt. Gehalten wird nach der Herkunft und
nicht nach dem Inhalt – was der Trupp im Baumodus selbst geändert hat, nimmt
er dort auch zurück.

**Kleineres:** Der neue Punkt rückt nach der Aufnahme ins Bild, wenn er
außerhalb lag. Der Setzmodus „Auf Karte“ endet, wenn schmal die Liste vor die
Karte kommt. „N ohne Angabe“ im Kopf des Bau-Reiters führt zum ersten solchen
Punkt. Der Start nach dem Neuladen bleibt in der Liste: nach einer
Unterbrechung ist der Überblick gefragt, und die Bauleiste ist einen Tipp
entfernt.

**Ein zweites Mal geöffneter Bauauftrag führt zur vorhandenen Aufnahme.** Er
legte still eine leere Kopie an: „Bau beginnen“ öffnete „0 von 4 bestätigt“,
und unter „Gespeicherte Planungen“ standen zwei gleiche Einträge. Erkannt wird
der Auftrag an seiner Herkunft – Planung, Einsatzabschnitt, Strecke –, ob es
derselbe Plan ist, an der Plan-Kennung. Dann ist „Dort weiterbauen“ der
Hauptknopf; bei geändertem Plan bleibt „Bau beginnen“ vorn, und die bisherige
Aufnahme ist einen Griff weit. Die Planungsliste nennt je Eintrag
Plan-Kennung, Baustand und aufgenommene Punkte.

**Jeder Verlust stellt „Verwerfen“ nach vorn, nicht nur der eines anderen
Absenders.** Meldete derselbe Trupp weniger, als beim Planer stand, blieb
„Einspielen“ blau. Der Dialog sagt jetzt „Diese Meldung kennt 2 Punkte nicht,
die hier schon stehen – beim Trupp nachfragen“. Ein nur nachträglich benannter
Punkt ist geändert und nicht verloren; erkannt wird er an der Aufnahmezeit.
Liegt schon der nächste gemeldete Punkt weiter als `ABSEITS_SCHWELLE` neben
der Trasse, ist es die Meldung eines anderen Auftrags gleichen Namens;
einzelne Ausreißer sind eine Nachfrage. Eine Übergabe ohne oder mit
durchgefallener Prüfung wird genannt. Findet keine Strecke eine Entsprechung,
sagt der Dialog, dass die Planung nicht in diesem Browser liegt, und sperrt
„Einspielen“, bis von Hand zugeordnet ist. Die Adresse wird trotzdem mit der
Entscheidung geräumt – die Zusage, dass sie die Meldung nur trägt, solange der
Dialog offen steht, gilt weiter.

**Der Empfangsdialog zeigt, was kommt:** die neuen Baumeldungen im Wortlaut
und eine Zeile „bisher → danach“. Die Streckenliste trägt die jüngste
Baumeldung als eine Zeile. Jeder Fußknopf eines Dialogs wirkt genau einmal;
ein Doppeltipp ergab zwei Undo-Schritte.

**Ein Kurzcode quittiert über Funk.** Vier Zeichen ohne 0/O und 1/I, eine
Prüfsumme über genau das, was hinausgeht. Der Trupp sieht ihn im
Rückmeldeblock und im Link-Dialog, der Planer im Empfangsdialog und in der
Meldung nach dem Einspielen. Er wird aus dem Inhalt nachgerechnet und reist
nicht als eigenes Feld.

**Der Versandvermerk ist kein Rückgängig-Schritt.** „↶“ machte aus „Link
erzeugt“ wieder „noch nicht gemeldet“. Er entsteht ohne Undo-Schritt, und
Rückgängig wie Wiederherstellen tragen ihn in den zurückgeholten Stand
hinüber. Die Pillen heißen „Link kopiert – jetzt verschicken“; der Satz, dass
das Gerät den Empfang nicht kennt, steht nicht mehr in Erfolgsgrün. Im
Link-Dialog ist „Teilen“ oder „Kopieren“ der Hauptknopf und nicht „Schließen“.

**„Meldung mitschreiben“ legt erst mit dem ersten Zeichen eine Meldung an.**
Die Uhrzeit des Tipps steht in der Zeile fest; eine Unterbrechung hinterlässt
keine leere Meldung mehr. Eine Zeit ohne Wortlaut sagt nicht, was gemeldet
wurde – das hebt die frühere Regel „der Text kommt danach – oder gar nicht“
auf.

**Die Adresse bleibt, solange entschieden wird.** Die Zurück-Taste nahm die
Meldung aus der Adresse, während der Dialog stehen blieb. Bei offenem
Empfangsdialog wird sie per `replaceState` zurückgeschrieben. „Später“ in „Wer
baut?“ behält getippte Namen. Der Rückmeldeblock folgt Material und
Meldungstexten ohne Neuladen. Die Pille nach „Bau beginnen“ steht oben und
deckt die Felder nicht mehr, die als Nächstes dran sind; kam der Link ohne
eingerichteten Wächter an, rät sie, ihn im eigenen Browser zu öffnen. Ein
neuerer Stand vom Speicher, der die offene Planung ersetzt, wird samt
geleertem „↶“ gemeldet.

**Eine Lücke zwischen zwei Bauabschnitten ist keine gebaute Trasse.** Die
Ist-Linie verband jeden aufgenommenen Punkt mit dem nächsten. Bauten zwei
Trupps von beiden Enden aufeinander zu, zog sie sich über die noch offenen
Planpunkte von Trupp 1 bis Trupp 2 – auf der Karte, auf der Baudokumentation
und in der Länge: „gebaut 1,56 km“ bei 1,57 km geplant, wo ein Drittel fehlte.
Jetzt wird zwischen zwei Punkten getrennt, wenn dazwischen ein Planpunkt
liegt, den niemand bestätigt hat, oder wenn sie zu verschiedenen
Bauabschnitten gehören und keinen gemeinsamen Punkt haben (`istVerlauf` in
`baudoku.js`). Bestätigen beide Trupps denselben Treffpunkt, ist das die Naht.
Ein Zusatzpunkt trennt nie, er hängt an seinem Vorgänger wie beim Einspielen.
Die Lücke steht gestrichelt über den offenen Planpunkten, und ihre Länge steht
neben der gebauten, nicht darin. Eine Regel „verbunden ist, was derselbe Trupp
aufgenommen hat“ lag näher und ist verworfen: ein Trupp, der Punkt 3 auslässt,
hätte dort eine Trasse behauptet, die niemand aufgenommen hat – „fehlend“ und
„Lücke“ sind dieselbe Nachfrage.

**Was die Führung wissen muss, steht an der Standmarke.** Eine durchgefallene
Prüfung stand in Liste, Summenband und Lagekarte unter einem grünen „gebaut“.
Sie führt jetzt die Warnungen der Streckenzeile an, wird im Summenband gezählt
und steht ausgeschrieben an der Standmarke. Die Arbeitskarte trägt dort auch
„neu“ und „ohne Meldung“. In der Liste stehen Strecken mit Handlungsbedarf
oben in ihrem Abschnitt. Eine Sammelzeile darüber hätte dasselbe gesagt, aber
eine Zeile Höhe gekostet, die der Strecken-Reiter am Telefon nicht hat.
Überdeckte Streckenschilder rücken beiseite, auf Druckkarten auch zurück in
den Rahmen; in der Übersicht unter Zoomstufe 13 fallen Teillängen und
„?“-Marken weg.

**Nachts blendet die Karte nicht mehr an den Linien.** Die weißen Fassungen
unter den Trassen waren nachts das Hellste auf dem Schirm. Auf der
Arbeitskarte tragen sie nachts den Grund der Oberfläche; die Druckkarten
bleiben weiß. Die Soll-Linie neben dem Ist hat volle Deckkraft und eine eigene
Fassung – unterschieden wird am Muster, nicht an der Blässe. Die Länge im
Kartenschild steht in Schriftfarbe, die Streckenfarbe trägt der Balken. Der
Hauptknopf ist nachts heller als das THW-Blau. Die Farbfolge neuer Strecken
ist so geordnet, dass zwei aufeinanderfolgende sich auch in der Helligkeit
trennen; bestehende Strecken behalten ihre gespeicherte Farbe.

**„Karte dabei“ heißt, dass die ganze Trasse im Gerät liegt.** Der Chip zählte
jede Kachel im Gerät: eine einzige weit abseits oder 10 von 300 nach einem
abgebrochenen Lauf ergaben „Karte dabei ✓“, und am Bauort blieb die Karte
grau. Gleichzeitig sagte die Pille nach „Bau beginnen“ ohne Netz „die Karte
ist nicht im Gerät“. Jetzt misst `abdeckung()` in `js/kacheln.js` die
Kachelliste der geplanten Trasse in der eingestellten Karte gegen den Vorrat,
mit einem einzigen Lesen aller Schlüssel. Das Ergebnis bleibt stehen, bis sich
Vorrat, Trasse oder Kartenwahl ändern. Chip, Bestandszeile und Pille richten
sich nach demselben Befund und nennen eine halbe Karte mit ihrer Zahl („Karte
unvollständig 280/300“). Ist-Punkte zählen nicht mit: sie entstehen ohne Netz,
und eine vollständige Karte hieße sonst nach dem ersten Punkt „unvollständig“.
Damit die Planliste immer ein Teil dessen ist, was „Karte holen“ holt, rechnet
`kachellisteLinien()` jede Linie für sich. Vorher wurden Plan, Ist und alle
Strecken zu einem Zug aneinandergehängt, und der Korridor lief über die
Sprünge dazwischen.

**„Vorrat löschen“ fragt nach, und zwar nach allem.** Der Knopf stand 16 px
neben „Karte holen“ und leerte auf einen Tipp den ganzen Speicher, unter
„Umfang: nur diese Strecke“. Er steht jetzt unter dem Bestand, fehlt bei
leerem Vorrat und fragt nach, mit der Zahl der Kacheln und dem Satz, dass ohne
Netz kein Ersatz zu holen ist. Nur eine Strecke zu löschen ist verworfen: der
Speicher kennt Kacheln nach Adresse und nicht nach Strecke, und es risse still
Löcher in die Karte der Nachbarstrecke. „Abbrechen“ ist ein eigener Knopf mit
einer Sekunde Sperre – an der Stelle von „Karte holen“ brach ein Doppeltipp
mit Handschuh den Abruf sofort ab.

**Der Block heißt „Vor dem Ausrücken“** und trägt neben der Karte den Weg zum
Baunachweis auf Papier. Wer nur über den Link arbeitet, fand das Wort im
Bau-Reiter nicht, und der Bauauftrag war im Baumodus nur über den
Strecken-Reiter zu erreichen. Grenzen und Datenschutz stehen eingeklappt, aber
vor dem Knopf: was der Kartenanbieter sieht, soll vor dem Drücken erreichbar
sein, nur nicht mehr vor dem Nutzen stehen.

**Der Baunachweis ist der Bau-Reiter auf Papier, je Trupp ein Bogen.** Statt
fünf freier Zeilen steht der Materialkatalog vorgedruckt da, in Reihenfolge
und Gruppen des Reiters, mit Einheit und einer einzigen Mengenspalte – die
drei Spalten des Papierbogens entfallen weiter. Beim Nachtragen musste sonst
jemand „3 Haken“ einer von 25 Zeilen zuordnen. Die Kabelart der Strecke fehlt
dort, sie steht mit Bedarf unter „Kabelverbrauch“. Der Kopf fragt nach
Bauabschnitt (von Punkt bis Punkt), Bauende und dem Zeitpunkt, zu dem das
Gerät ausfiel – ab da gilt das Papier, und davor Aufgenommenes wird nicht
doppelt nachgetragen. Die Prüfung kennt je Stamm „bestanden“ und „nicht
bestanden“, leer heißt „offen“. Stehen unter „Auftrag an“ mehrere Trupps,
bekommt jeder einen eigenen Bogen mit seinem Namen: beim abschnittsweisen Bau
stehen sie zur selben Zeit an beiden Enden der Trasse, und ein gemeinsames
Blatt kann nur an einem sein. Die Folgeblätter nennen sich Baunachweis statt
Bauauftrag, das Feld für die Meldung an den S 6 ist wieder 34 mm hoch – eine
spätere CSS-Regel gleicher Spezifität hatte es auf 16 mm gedrückt. Die
Baudokumentation füllt Trupp, Baubeginn und Bauende aus Auftrag und Aufnahmen
und kennzeichnet abgeleitete Zeiten „(aus Aufnahmen)“, statt in jedes Feld „2
Abschnitte“ zu schreiben. Die Lagekarte trägt den Lagestand als
Datum-Zeit-Gruppe im Kopf. Ein aus der Nachtdarstellung gedrucktes Blatt erbt
deren Farben nicht mehr: das Blatt setzt die Oberflächenvariablen auf die
Tageswerte zurück, die Gitterangabe stand vorher mit 1,49:1 auf weißem Papier.
Nachgetragen wird auch eine Woche später – „anderer Tag …“ öffnet ein
Datumsfeld.

**Quer auf dem Telefon bleibt die Karte frei.** Bei 844×390 und 667×375 stand
von der Karte nichts zur Verfügung: Kopfzeile und Sicherungsband nahmen 115
px, die Koordinatenleiste brach in zwei bis drei Zeilen um, die Werkzeuge
standen als Spalte über die ganze Höhe neben 88 px Zoom, und die Punktkarte
deckte alles zu – auch den Punkt, den sie benennt. Bei geringer Höhe wird das
Sicherungsband jetzt zum Merker „⚠ keine Datei“ in der Kopfzeile, die
Koordinatenleiste nennt nur MGRS, und Werkzeuge, Kartenoptionen (als Sinnbild)
und die nebeneinander gestellte Zoomsteuerung teilen sich ein Band an der
oberen Kante: frei sind 36 bis 50 % statt 0. Die Punktkarte steht quer als
Blatt an der rechten Seite. Das nimmt den Satz zurück, die Seite sei der
falsche Tausch: er galt bei 161 px Höhe, jetzt misst das Blatt rund 300 px –
so viel wie hochkant bei 320×568, wo dieselbe Chipreihe längst geprüft
umbricht –, und daneben bleibt der Punkt zu sehen. Die Geräteprüfung zählt ein
solches Blatt deshalb nach der freien Breite und nicht als Band.

**Was gefüllt ist, geht nicht mit einem Tipp.** Ein Bauabschnitt mit Trupp,
Zeiten oder zugeordneten Einträgen und ein Stamm mit Ergebnis, Messwert oder
Prüfer fragen vor dem Löschen nach und nennen, was verloren ginge – beim
Abschnitt, wie viele Punkte, Materialzeilen und Meldungen ihre Zuordnung
verlieren. Leere Einträge gehen weiter mit einem Tipp; sie sind meist ein
Doppeltipp. Zeichen, Flächen, Relaisstellen und Lichtbilder nennen beim
Löschen den Rückweg. Ein „↶“ in der Bauleiste ist verworfen: neben „Punkt
hier“ nähme der Fehlgriff mit dem Handschuh genau die eben gemachte Aufnahme
zurück.

**Eine Kabelmenge in Bruchteilen eines Meters wird hinterfragt.** „1,450“
wurde still zu 1,45 m neben einem Bedarf von 8.653 m. Nachkommastellen unter
10 m oder eine Menge unter einem Hundertstel des Bedarfs lösen eine Warnung
aus; stehen genau drei Stellen hinter dem Komma, bietet sie „1.450 m
übernehmen“ an. Ob das Tausendfache gemeint ist, sagt die Schreibweise, nicht
der Bedarf – mit mehreren Bauabschnitten trägt jeder nur einen Teil davon.

**Die letzte Eingabe übersteht das sofortige Neuladen.** Formulare sammeln 100
bis 150 ms, bevor sie schreiben, und beim Verlassen der Seite lief dieser
Zeitgeber nicht mehr ab: gesichert wurde der Stand vor dem letzten Wort. Beim
Verlassen wird jetzt zuerst die Warteschlange geschrieben.

**Der Bau-Reiter beginnt näher an den Punkten.** Die Bauabschnitte stehen
zugeklappt, solange es keinen oder einen aufnehmenden gibt, und nennen in der
Überschrift, was darin steht; bei 390×844 steht die erste Trassenpunktzeile
damit im Bild. Die Plan-Kennung sagt dort, was sie ist. „✓ wie geplant“ hält
12 px zu „◉ hier“, die Sprungchips halten 10 px, und Zeitwahl und Zuordnung
eines zusätzlichen Punktes nehmen die ganze Breite, statt rechts aus der Liste
zu ragen. Die Meldungspille bleibt, wo sie ist: sie fängt keinen Tipp ab und
steht drei Sekunden, und in einer Liste, die den Schirm füllt, deckte sie an
jedem anderen Ort ebenso etwas.

## Nach der fünften Runde der THW-Reviewer

Die elf Prüfungen ein fünftes Mal, mit dem Auftrag, vor allem nach Brüchen
durch die vierte Runde zu suchen. Gut die Hälfte der P1-Befunde war genau das:
die Doppeltipp-Sperre wirkte nur in einer Richtung, das seitliche Blatt quer
war am Telefon 215 px schmal, der Rückgabe-Code verschwand mit der nächsten
Eintragung, und die neue Farbfolge war nachts zu dunkel. Der einzige P0 war
älter und wurde erst sichtbar, seit zwei Trupps an einer Strecke der Regelfall
sind: eine durchgefallene Prüfung des zweiten Trupps ging beim Einspielen
still verloren. Das Schema steht jetzt bei 19.

**Ein durchgefallener Stamm geht beim Einspielen nicht mehr verloren.**
Prüfung und Übergabe trug eine Teilmeldung nur ein, wo beim Planer noch nichts
stand – meldete der zweite Trupp „Stamm 1 durchgefallen“, während vom ersten
schon „bestanden“ dastand, verschwand die Meldung still, und die
Baudokumentation druckte „bestanden, übergeben“. Jetzt wird je Stamm
zusammengeführt: „durchgefallen“ gewinnt immer gegen „bestanden“, sonst
ersetzt die neuere Messung die ältere; ein gemeldetes „bestanden“ gegen ein
„durchgefallen“ hier wird genannt und nicht übernommen, denn ob repariert und
neu gemessen wurde, weiß nur der Trupp. Steht danach ein durchgefallener Stamm
da, fällt eine Übergabe auf „gebaut“ zurück – übergeben wird nur eine geprüfte
Leitung. Der Empfangsdialog sagt das je Stamm, bevor eingespielt wird.

**Eine Meldung trägt nur, was dieser Trupp gebaut hat.** Ein zweiter Auftrag
an denselben Trupp trägt den ganzen Bau-Block, wie der Planer ihn zuletzt
hatte – samt dem Abschnitt des anderen Trupps. Ging der mit der nächsten
Meldung zurück, überschrieb der alte Stand von „1. FmTr“ den neueren. Kennt
das Gerät seinen Trupp und dessen Abschnitt, gehen nur dessen Abschnitte
hinaus, ohne den Bestand ohne Abschnitt; fremde Abschnitte stehen am Gerät zur
Ansicht da. Rückgabe-Code und Versandvermerk rechnen über genau das, was
hinausgeht. Kennt das Gerät seinen Trupp nicht, bleibt alles wie bisher – dann
ist nicht zu entscheiden, was fremd ist. Aus demselben Grund vergleicht
„älter“ nur noch die gemeldeten Abschnitte und nicht die Aufnahmezeit des
anderen Trupps.

**„Welcher Trupp seid ihr?“ wählt nicht vor und kommt wieder.** Der erste
Trupp stand vorgewählt, der zweite tippte „Weiter“ und baute unter fremdem
Namen; wer „Später“ drückte, wurde nie wieder gefragt. Die Trupps stehen jetzt
als Chips ohne Vorauswahl da, „Weiter“ geht erst nach einer Wahl, und solange
das Gerät keinen eigenen Abschnitt hat, fragt die erste Aufnahme noch einmal –
in `istPunktSetzen`, wo jeder Aufnahmeweg vorbeikommt. Der Punkt entsteht
trotzdem und bekommt den Abschnitt nachträglich: wer an der Muffe steht, soll
die Ortung nicht an einen Dialog verlieren. Der Truppführer reist im Absender
mit, und ein anderer Truppführer beim selben Trupp gilt als anderer Absender.
Melden zwei Trupps ohne Abschnitt – in der einfachen Ansicht der Regelfall –,
bietet der Empfangsdialog an, die Meldung als eigenen Bauabschnitt ihres
Absenders einzuspielen; der Bestand bleibt stehen. Mit mehreren Planungen
gleichen Streckennamens im Browser fragt der Dialog, in welche; aus einem
Bauauftrag übernommene stehen hinten.

**Plan-Nr. und Rückgabe-Code sind zweierlei.** Zwei Codes aus vier Zeichen
hießen „Plan“ und „Meldung“ und wurden verwechselt. Die Kennung des Plans
heißt Plan-Nr. und steht schlicht da, der Code der Baumeldung heißt
Rückgabe-Code, steht als Marke da und sagt, dass er über Funk an den Planer
geht. Die Rechenweise der Plan-Nr. bleibt, sie steht auf gedruckten Blättern;
die Null ist in beiden durchgestrichen. Der verschickte Code bleibt im
Versandvermerk lesbar („zuletzt verschickt · jetzt“), beim Planer steht der
zuletzt eingespielte an der Strecke, und nach „Verwerfen“ steht die Funkformel
„Meldung … nicht übernommen – Grund: …“ da – der Code quittierte bisher nur
den Empfang, nicht die Übernahme.

**Kleineres am Rückweg:** Eine Folgemeldung desselben Trupps ohne Verlust
warnt nicht mehr gelb. Ein Trupp mit eigenem Abschnitt meldet „Abschnitt
fertig“, und der Planer liest, warum die Strecke im Bau bleibt. Die
Link-Dialoge haben „Teilen“ bzw. „Kopieren“ vorn, nennen ohne Netz, dass der
Messenger erst später schickt, und nehmen einen von Hand weitergegebenen Link
als Vermerk an. Im Dialog „Bauauftrag geöffnet“ steht unter jedem Knopf, was
er tut, und „Bau beginnen“ steht fern von „Verwerfen“. Das Löschen einer
Planung nennt Plan-Nr., Baustand und eine vorhandene Bauaufnahme. Der Abgleich
mit dem eigenen Speicher prüft unmittelbar vor dem Ersetzen noch einmal, ob
hier inzwischen etwas geschah.

**Ein Doppeltipp wirkt einmal – auch in der Gegenrichtung.** Die Sperre der
vierten Runde galt nur dem Blatt, das gerade aufschlägt. Nach dem Schließen
traf der zweite Tipp eines Doppeltipps auf „Fertig“ die Bauleiste darunter:
„Punkt hier“ legte einen deckungsgleichen zweiten Punkt an und fragte „Stimmt
die Ortung?“, „Auf Karte“ schaltete still den Setzmodus ein. Jetzt nehmen Bau-
und Modusleiste 400 ms nach dem Schließen keinen Fingertipp an, und ebenso
lange schließt ein Kartentipp das eben aufgeschlagene Blatt nicht – quer und
auf dem Tablet steht es seitlich, und der zweite Tipp auf „Punkt hier“ traf
die Karte daneben. Dieselbe Frist hat jeder Dialog für seine Fußknöpfe: die
Löschrückfrage schlug dort auf, wo das ✕ stand, „Löschen“ lag 15 px darunter,
und ein Doppeltipp bestätigte sie in vier von vier Läufen. Ebenso die
Aufnahmegriffe des Bau-Reiters nach „✓ wie geplant“, denn die Liste rollt den
nächsten offenen Punkt unter den Finger. Gesperrt wird nur, was ein Finger
auslöst; Eingabetaste und Programm meinen den Knopf. Entsteht trotzdem binnen
zehn Sekunden ein zweiter Punkt an derselben Stelle, nennt das Blatt ihn „eben
schon aufgenommen“ und bietet an, ihn wieder zu löschen, statt die Ortung zu
verdächtigen.

**Umhängen an eine Strecke, die anderen gehört, fragt nach, und „↶“ nimmt es
ganz zurück.** „Zu Strecke 2 · Punkt 1“ hängte den Punkt auf einen Tipp um,
ohne Bauabschnitt, auch an eine Strecke, die der Planer zwei anderen Trupps
aufgetragen hatte – beim Planer ersetzte die Meldung dann deren Aufnahme.
Jetzt sagt das Blatt, wem die Strecke aufgetragen ist, und lässt den
Bauabschnitt wählen. Der Merker an der Bauleiste folgt sofort. „↶“ stellt auch
die Baustrecke zurück, obwohl sie im Gerätespeicher liegt und nicht im
Verlauf: erkannt wird der Schritt am selben Punkt an einer anderen Strecke.
Die Pille sagt „Umhängen nach „Strecke 2“ zurückgenommen“ statt „Löschen eines
Punktes“.

**Das Blatt sagt „zugeordnet“, wo die Liste schon „bestätigt“ zählt.** Die
Festlegung der vierten Runde bleibt: genau ein offener Punkt unter 25 m wird
zugeordnet, und das Kreuz behält die Zuordnung. Nur hieß sie im Blatt
„vorgeschlagen“, während Liste und Kopf darunter „✓ gebaut“ und „1 von 3
bestätigt“ zeigten. Es steht jetzt „zugeordnet: Punkt 2 – ändern?“, und das
Kreuz heißt „Schließen – Punkt bleibt“.

**Eine späte Ortung reißt niemanden heraus, und eine spätere Wahl gilt vor
ihr.** Zwischen Griff und Antwort des Geräts liegen bis zu zwölf Sekunden. In
dieser Zeit wechselte der Trupp in die Liste, schrieb eine Meldung oder
öffnete einen anderen Punkt – und das Ergebnis riss ihn auf die Karte zurück.
Nach „◉ Hier“ und gleich darauf „✓ Wie geplant“ überschrieb die Ortung die
Bestätigung still. Kam seit dem Start etwas dazwischen, wird jetzt
aufgenommen, aber nichts aufgeschlagen und nichts vorgeschlagen, und die Pille
sagt es. Ist der Punkt inzwischen bestätigt oder anders gesetzt, wird die
Ortung verworfen und das gesagt. Die Ortungsgriffe im Blatt zeigen „ortet …“
wie „Punkt hier“. Ein Neuladen mitten in der Ortung hinterlässt einmal den
Satz, dass die Aufnahme unterbrochen wurde.

**Der Punkt, den das Blatt benennt, steht frei.** Das Nachrücken galt nur
einem Blatt, dessen Oberkante unter einem Drittel der Karte lag; bei 390×844
reicht es von 196 bis 709 px, und der Punkt lag darunter. Das Blatt zählt
jetzt immer, quer an der Seite der Teil daneben, und Statusleiste und
Umschalter zählen mit. Zoom und Kartenoptionen gehen bei offenem Blatt in
jeder Höhe aus dem Bild. Das ist nicht der verworfene Weg, den Zoom
wegzunehmen: er kommt mit dem Schließen des Blattes zurück. Stand ein Feld
halb unter dem klebenden „Fertig“, traf seine untere Hälfte „Fertig“; das
Blatt wird beim Aufschlagen um genau so viel niedriger, dass das Feld ganz
darunter liegt.

**Kleineres:** Schlägt das Fehlerblatt der Ortung auf, schweigt die rote Pille
– sie stand sechs Sekunden über dessen beiden Auswegen. Die Zurück-Taste
schließt das Fehlerblatt und beendet den Setzmodus „Auf Karte“, statt die
Anwendung zu verlassen. Eine Meldung, deren Text wieder ganz gelöscht wird,
ist wieder ein Entwurf; leer verlassen, geht sie. An der Undo-Grenze heißt es
„Weiter zurück geht es hier nicht – der nächste Schritt gehört zur Planung“,
weil „im Planungsmodus zurücknehmen“ den Trupp in die Planung einlud.

**Im Baumodus ist der Plan nur noch zu lesen – auch Name, Punktart und
Auftrag.** Die vierte Runde nahm die Griffe an der Trasse aus dem Baumodus,
ließ aber Bezeichnung, von/nach, „Auftrag an“, Bemerkung, Punktart,
Punktbezeichnung, Querungsart, Bauweise und Reserve als Felder stehen. Name
und Punktart gehen in die Plan-Nr. ein: benannte der Trupp seine Strecke um,
meldete das zweite Öffnen desselben Links „der Plan hat sich geändert“ und bot
eine leere Kopie als Hauptknopf an, und beim Planer fand die Meldung der
umbenannten Strecke keine Entsprechung. Im Baumodus steht der Auftrag jetzt
als Text da, nicht als gesperrtes Feld – ein graues Feld lädt zum Antippen ein
und sagt nicht, warum es nicht geht. Und verglichen wird beim zweiten Öffnen
mit der Plan-Nr. des Auftrags, wie er übernommen wurde
(`herkunft.planKennung`), nicht mit dem Stand, der seither im Gerät daraus
wurde. `herkunft` ist ein offenes Objekt; ältere Übernahmen ohne den Eintrag
rechnen wie bisher, ein Schema braucht es nicht.

**Kein Schild der Lagekarte deckt ein anderes, und das mit Warnung kommt
zuerst.** Das senkrechte Ausweichen der vierten Runde stieß an die Blattkante,
wurde zurückgeholt und landete wieder auf dem Nachbarschild – „Prüfung nicht
bestanden“ lag in allen vier Formaten darunter. Jetzt sucht jedes Schild die
nächste freie Lage in jeder Richtung, mit dem Rahmen als Bedingung statt als
Nachgang, und Schilder mit Warnung werden vor den übrigen gesetzt. Die
Standmarke sagt in Worten, was los ist („⚠ 2 Abw.“, „⚠ abseits“, „✉ S 6“, 11
px statt 10), die Zeichenerklärung erklärt die Kurzformen, und die Kennzahl
„Baustand“ zählt die durchgefallene Prüfung wie das Summenband. Auf der
Arbeitskarte liegen die Schilder über den Punktmarken, getippt wird durch sie
hindurch.

**„gesehen“ und „erledigt“ wirken sofort.** Beides steht im Gerät, nicht in
der Planung, und die Liste verglich ihre Karten nur mit der Strecke. Jetzt
gehört beides in die Signatur der Karte.

**Kleineres:** „Vor dem Ausrücken“ steht oben und offen, solange an der
Strecke nichts aufgenommen ist, und sein Chip nennt Karte und Baunachweis; mit
dem ersten Punkt rückt der Block wie bisher ans Ende. Nach „Fertig“ sagt eine
Meldung, wo der Bauauftrag zu finden ist. Auf dem Tablet klappt die
Werkzeugleiste der Planung wie die Kartenoptionen, und das Gerät merkt sich
das. Die Bauzeile der Liste nennt die Lücke zwischen zwei Bauabschnitten.
„Karte holen“ ist ohne Trassenpunkte gesperrt, „Baudoku“ nie. Wer einen Punkt
einer nicht gewählten Strecke hält, erfährt, dass erst gewählt sein muss.

**Das Telefon quer zeigt Liste oder Karte, und die Punktkarte fragt dort
zuerst, was hier ist.** Bei 844×390 lag die Breite über der Schmalgrenze: 372
px Liste standen neben 472 px Karte, und das seitliche Blatt der Punktkarte
bekam davon 215 px. Es schnitt „vorgeschlagen“ ab und zeigte keinen einzigen
Art-Chip ohne Rollen. Die Geräteprüfung war trotzdem grün, weil sie den
ausgeblendeten Umschalter per Skript drückte und einen Zustand maß, den am
Gerät niemand erreicht. Sie drückt jetzt nur, was zu sehen ist. Wenig Höhe UND
ein grober Zeiger gelten als Schmalansicht (`QUER_BIS`); ein flach gezogenes
Rechnerfenster bleibt nebeneinander. Der Umschalter steht quer als Spalte
links und nicht als Band am Fuß, denn quer fehlt Höhe, nicht Breite – als Band
hätte er der Bauleiste bei 844×390 die freie Karte von 50 % auf 36 % gedrückt,
als Spalte hebt er 667×375 von 36 % auf 50 %. Im seitlichen Blatt stehen „Was
ist hier?“ und seine Chips vor Befund und Zuordnung. Befund und Ortungswarnung
sind dort einzeilig, die Warnung beginnt mit ihrer Frage und klappt auf Tipp
auf. Hochkant bleibt die Reihenfolge: dort rutschte die Zuordnung sonst unter
die festgehaltene Abschlusszeile, und „Fertig“ nennt sie, wenn sie fehlt. Die
Zuordnungschips halten hochkant wie quer 12 px Abstand, und „zusätzlich“ steht
zwischen nahen und fernen Punkten – der Nachbar von „Punkt 2 · 8 m“ war vorher
„Punkt 3 · 448 m ⚠“. Die Korrekturgriffe des Blattes tragen ihre 44 px selbst.

**Der Haltering liegt um die Kuppe, nicht unter ihr.** Er misst 72 px statt
außen 38. Ohne Bewegung erscheint er erst beim Greifen, sonst sah Halten
sofort wie gegriffen aus. Die Ruheschwelle liegt bei 14 px, ein abgerutschtes
Halten sagt das einmal je Sitzung, und am Finger zieht die Marke 40 px über
der Kuppe, damit der Ort zu sehen ist, an dem sie landet. Nach dem Ziehen an
einer Strecke, an der schon gebaut wird, nennt eine einzige Meldung Punkt,
Weg, Rückweg und den neuen Link; vorher ersetzte die Warnung die Meldung.
Hochkant steht die Pille über der Werkzeugleiste statt auf „Ort suchen“. Im
Baumodus steht das Sicherungsband schon beim Umschalten da und nicht erst
mitten in der ersten Aufnahme, wo es die Karte um 50 px verschob. Die
Druckvorschau liest das Polster ihrer Bühne ab: am Telefon fehlten dem Blatt
rechts 8 px.

**Der Baunachweis lässt sich so abschreiben, wie er dasteht.** Der Bogen
versprach seit der zweiten Runde, dass sich Uhrzeit und Datum so nachtragen
lassen, wie sie dort stehen. Eingelöst war es nicht. „✓ wie geplant“ stempelte
die Uhrzeit des Abtippens, und das Bauende der Dokumentation war die Zeit am
Küchentisch. Der Tag war an jedem Punkt einzeln zu wählen, Meldungen kannten
nur heute und gestern, und die Prüfzeile trug die Zeit, zu der „+ Stamm“
getippt wurde. Jetzt schaltet „Vom Baunachweis nachtragen“ am Ende der Punkte
einen Nachtrag mit dem Baudatum vom Blatt ein. Solange er läuft, entsteht
jeder Eintrag ohne Uhrzeit und mit dem Zeitpunkt der Abschrift
(`nachgetragen`, Schema 19). Die Uhrzeit steht in der Zeile und gilt auf dem
Tag vom Blatt; Meldungen und Prüfzeile haben dort dieselbe Tagwahl. Der
Nachtrag ist Sitzungszustand wie der aktive Bauabschnitt und endet mit dem
Bau-Reiter – sonst nähme der Trupp am nächsten Morgen still mit dem Tag von
gestern auf. Ein Feld für den Tag je Zeile lag näher und ist verworfen: der
Tag steht einmal oben auf dem Blatt, und so wird er auch eingegeben.
Materialzeilen tragen weiter keine Zeit; das Schema kennt dort keine, und der
Bogen fragt keine ab.

**Eine abweichende Lage kommt als Koordinate vom Blatt,** mit der Herkunft
„Papier“ – weder gemessen noch getippt, sondern abgeschrieben. Der Soll-Punkt
bleibt dabei unangetastet, und eine Eingabe weiter als `ABSEITS_SCHWELLE`
neben dem Plan fragt nach einem Zahlendreher. Der Griff steht nur im Nachtrag:
am Bauort ist „◉ hier“ der genauere Weg.

**Was der Bogen seit der vierten Runde abfragt, nimmt das Gerät jetzt auch
auf:** „von Punkt“ und „bis Punkt“ am Bauabschnitt – die Felder lagen seit
Schema 13 ungenutzt im Datenmodell – sowie den Geräteausfall mit Uhrzeit und
Punkt. Der Ausfall steht ohne Abschnitt am Bau-Block, mit Abschnitten an jedem
einzeln, denn beim abschnittsweisen Bau fällt das Gerät des einen Trupps aus
und das des anderen nicht. Alle drei Angaben reisen als Stelle in der
Punktliste wie `vonPunkt`, und die Baudokumentation nennt sie. Der Bogen hat
Datumsspalten und Trennstriche zwischen allen Schreibfeldern, im Kopf
„Baudatum“ statt „Datum“, und jeder Bogen zählt seine Blätter selbst. A4 quer
bleibt bei drei Blättern je Trupp: der Kopf mit QR-Code und die Baumeldungen
passen nicht auf ein Blatt, ohne Schreibzeilen zu streichen. Im laufenden Bau
heißt das abgeleitete Ende „letzter Eintrag“. „anderer Tag …“ verwirft keine
Uhrzeit mehr still, und eine halbe Menge wie „1 45“ wird beim Verlassen des
Feldes abgewiesen.

**Nachts trägt jede Streckenfarbe.** Die Farbfolge der vierten Runde setzte
Lila und Braun an die zweite und fünfte Stelle; gegen die dunkle Fassung der
Nachtdarstellung standen sie bei 2,3:1 und 2,0:1. Die Palette umzustellen
hülfe nur neuen Strecken – jede Planung trägt ihre Farben gespeichert, und
eingespielte Dateien bringen beliebige mit. Auf der Arbeitskarte bekommt
deshalb jede Farbe nachts eine Stufe desselben Farbtons, aufgehellt bis 4:1
gegen den Grund (`nachtFarbe()` in `js/strecken.js`); Linien, Lücke,
Farbbalken im Schild und Rand der Punktmarke tragen sie. Gespeichert bleibt
die Tagfarbe, die Druckkarten zeichnen sie, und ein CSS-Filter ist es nicht.
Start- und Endmarke behalten die Tagfarbe, weil sie weiße Schrift darauf
tragen. Der Haltering steht nachts hell auf einem dunklen Hof, Fehler- und
Warnpille sind nachts dunkel mit Schrift im Meldeton, und aus der
Nachtdarstellung gedruckt bleibt auch die Seite um das Blatt weiß. Gebaute
Linie, geplante Punktreihe und Lücke erklärt die Kurzanleitung mit ihrem
Muster – eine Zeichenerklärung auf der Arbeitskarte nähme der Trasse Platz.

**Über der mitgenommenen Stufe springt die gröbere ein.** Die Kachelebene
fragt bis Stufe 18, der Vorrat reicht nach Vorgabe bis 17 – beim Heranzoomen
auf eine Muffe war die Karte am Bauort weg. Fehlt eine Kachel im Vorrat und
kommt sie nicht aus dem Netz, schneidet die Ebene ihren Ausschnitt aus der
nächstgröberen Stufe im Vorrat, bis zu fünf Stufen darüber, und die
Statusleiste sagt still „feiner nicht mitgenommen“. `maxNativeZoom` auf die
Vorratsstufe zu senken ist verworfen: es hätte auch mit Netz jede feinere
Kachel verschenkt. Die Statusleiste trennt „kein Netz“ (der Browser ist
offline) von „Karte nicht erreichbar“ (Netz da, der Kartenserver schweigt) und
zählt den Vorrat nach jedem Holen und Löschen neu.

**Ein Abruf, der hängt, sagt es.** Jede Kachel hat beim Holen zehn Sekunden;
was dann nicht da ist, zählt als fehlend, und der Lauf geht weiter. Kommt zehn
Sekunden lang keine Kachel an, steht in Pille und Bestandszeile „Seit 10 s
kommt nichts – Netz schwach. Abbrechen oder warten.“ Ein halber Lauf heißt
„Karte unvollständig: 60 von 222 – noch einmal holen, solange Netz da ist“
statt „mitgenommen“, und die Bestandszeile führt den Stand während des Holens
mit, weil die Pille sie deckt.

## Nach der sechsten Runde der THW-Reviewer

Die elf Prüfungen ein sechstes Mal. Der einzige P0 ist der Bruch, der mit
dem Mehrtruppbau regelmäßig wurde: Punkte, die ein Gerät ohne Bauabschnitt
aufnahm, fielen still aus der Baumeldung. Der Rest ordnet sich nach Stellen –
Einspielen und Empfang, Lagekarte und Papier, Gesten und Blatt, Karte und
Nacht. Das Schema steht jetzt bei 20.

**Was das Gerät aufnimmt, geht in die Baumeldung – oder der Block sagt, was nicht.** Kennt das Gerät seinen Trupp und gibt es an der Strecke einen Abschnitt dieses Trupps, ist das der aktive Abschnitt, auch ohne „Auftrag an“ – der Normalfall der einfachen Ansicht und das, was „als eigenen Bauabschnitt einspielen“ beim Planer hinterlässt. Vorher entstanden neue Punkte dort ohne Abschnitt, die Meldung ließ sie weg (zwei Punkte und eine Meldung am Gerät, null in der Baumeldung), und der Rückgabe-Code wurde über die leere Meldung gerechnet. Jetzt bekommt jede Aufnahme den Abschnitt des Geräts, auch auf einem Weg, der ihn nicht mitgibt (`abschnittNachtragen` in `istPunktSetzen`). Was aus älteren Ständen ohne Abschnitt dasteht, bleibt am Gerät, wird aber im Rückmeldeblock mit Zahl genannt („2 Punkte ohne Abschnitt gehen nicht mit – zuordnen?“) und lässt sich auf Tipp dem Abschnitt zuordnen. Automatisch geschieht das nicht: der Bestand ohne Abschnitt kann der des Planers sein, und ihn als gebaut vom Trupp zu melden wäre die falsche Aussage. Eine Strecke, die nach der Auswahl nichts trägt, ist keine Meldung: der Block sagt „Nichts zu melden“, nennt keinen Rückgabe-Code und bietet kein Absetzen an (`meldungTraegt` in `teilen.js`).

**„Welcher Trupp seid ihr?“ geht nicht beiläufig zu und kommt wieder, aber nie mitten in eine Eingabe.** Der Dialog hat denselben Schutz wie die Empfangsdialoge: Esc, ein Tipp auf den Schleier und das Kreuz schließen ihn nicht, und die Chips nehmen die ersten 400 ms keinen Fingertipp an. „Später“ bleibt als bewusster Ausgang. Gefragt wird nicht mehr einmal je Sitzung und Strecke, sondern bei jeder Aufnahme ohne Abschnitt, solange keine Wahl getroffen ist, und erst, wenn kein Dialog steht, kein Eingabefeld den Fokus hat und die Punktkarte zu ist – eine späte Ortung hatte ihn mitten in eine Meldung gelegt. Die Zurückstellung ist einer festen Marke „Trupp wählen“ im Reiterkopf vorgezogen, weil am Bauort die Karte vorn steht. Mit der Wahl bekommt alles ohne Abschnitt an der Strecke den Abschnitt, nicht nur das, was in der Sitzung wartete: ein Neuladen während der Frage ließ den ersten Punkt sonst ohne Abschnitt zurück.

**Ein Gerät, das an der Strecke nicht aufgetragen ist, bekommt einen eigenen Abschnitt und keinen fremden.** Gerät „3. FmTr“, aufgetragen „1. FmTr und 2. FmTr“: Umhängen bot „Für 1. FmTr“ und „Für 2. FmTr“ an, `eigeneAbschnitte` war `null`, also ging jeder Abschnitt hinaus, und beim Planer ersetzte Einspielen die Aufnahme der anderen. Jetzt fragt der Dialog „Ihr seid nicht aufgetragen – eigener Abschnitt „3. FmTr“ anlegen?“ als Hauptweg; wählbar sind nur eigene Abschnitte, in der Punktkarte, im Feld „Gebaut von“ und beim Umhängen. Fremde Abschnitte bleiben am Gerät zur Ansicht.

**Eine Fehlwahl des Trupps lässt sich an einer Stelle zurückholen.** „Trupp wechseln …“ im Block „Bauabschnitte und Trupps“ und im Rückmeldeblock stellt Gerät, Abschnitt und Absender gemeinsam um, an allen Strecken des Geräts. Ein Abschnitt ohne Einträge bekommt den neuen Namen; steht schon etwas darin, entscheidet der Trupp zwischen „Umbenennen“ (die Einträge gehörten von Anfang an ihm) und „Neuer Abschnitt“ (die Einträge bleiben beim alten Namen und gehen nicht mehr mit).

**Eine Baumeldung ohne Bauabschnitt, eine Nachmessung desselben Trupps und das Gerät nach dem Papier verlieren seit der sechsten Runde nichts mehr, und zwei Trupps ohne Abschnitt landen im eigenen Abschnitt statt im Verwerfen.** Die Prüfregel „durchgefallen gewinnt“ galt nur im Abschnittsweg; die Meldung über die ganze Strecke ersetzte den Bogen samt Prüfung, sodass ein durchgefallener Stamm neben „übergeben“ stand oder hinter dem „bestanden nach Reparatur“ des zweiten Trupps verschwand. Jetzt läuft `pruefungZusammenfuehren` in beiden Wegen, mit einer zusätzlichen Regel: die spätere Messung desselben Trupps (der Truppführer zählt nicht) ersetzt seine frühere, auch durchgefallen→bestanden – sonst wäre die Übergabe nach einer Reparatur nie zu erreichen; ein „bestanden“ eines anderen Trupps bleibt abgelehnt, der Planer kann die Messung ausdrücklich übernehmen. Eine Übergabe wird nur übernommen, wenn danach kein Stamm durchgefallen ist. Das Häkchen „als eigenen Bauabschnitt“ ist vorbelegt, wenn hier die Aufnahme eines anderen Trupps ohne Abschnitt steht (`eigenerVorgabe`), und die erste Meldung wird rückwirkend zum Abschnitt ihres Absenders: sonst verdoppelte oder löschte die Folgemeldung des ersten Trupps. Gleicher Trupp mit anderem Truppführer gilt nicht als anderer Absender (`gleicherTrupp`). Abgeschriebene Einträge (`nachgetragen`) bleiben beim Ersetzen eines Abschnitts stehen und werden je Soll-Punkt mit der Gerätemeldung zusammengeführt, das Gerät gewinnt nur mit der späteren Zeit; ein Abschnitt unter anderem Namen, aber mit demselben Trupp, ist derselbe Abschnitt. Der Rückgabe-Code gilt je Absender (`bau.gemeldetCodes`, ohne Schemaerhöhung). Der Empfangsdialog führt seine Fußknöpfe nach dem Befund (riskant: „Erst als Datei sichern“), zieht bei einer übernommenen Kopie das Original der Planung vor, und der Cloud-Abgleich prüft nach einem Konflikt gegen den Stand, der eben danebengelegt wurde. Verworfen wurde: Papier auch beim Ersetzen der ganzen Strecke zu behalten, weil dort „Meldet derselbe Trupp weniger, wird gewarnt“ gilt. Und: den Absender je Prüfzeile zu speichern, weil das Schema 21 bräuchte – in der achten Runde nachgeholt, weil es als additives Feld ohne Schemaerhöhung geht (siehe dort).

**Eine abgeschriebene Zeile trägt ihren Bautag selbst, und das Ende des Nachtrags wird gesagt.** Der Nachtrag blieb Sitzungszustand, aber die Zeilen, die noch auf ihre Uhrzeit warteten, kannten nach Neuladen oder Reiterwechsel nur „heute“: „14:20“ stand dann auf dem 05.10. statt auf dem Bautag 03.10., ohne dass jemand erfuhr, dass der Nachtrag geendet hatte. Das Schema steht deshalb bei 20: Punkt, Meldung und Prüfzeile tragen `nachtragTag`, den Bautag vom Blatt, und die Uhrzeit gilt darauf (`nachtragTagVon` in `baudoku.js`; eine Zeile aus Schema 19 nimmt den Tag der anderen offenen Zeilen oder des letzten Eintrags, geraten wird in der Migration nichts). Die Festlegung der fünften Runde bleibt: der Nachtrag endet mit dem Bau-Reiter, sonst nähme der Trupp am nächsten Morgen still mit dem Tag von gestern auf. Neu ist, dass das Ende genannt wird („Nachtrag vom 03.10. beendet – 2 Zeilen ohne Uhrzeit“) und der Bau-Reiter, solange solche Zeilen stehen, „Nachtrag fortsetzen“ anbietet – im Block und nicht in der Pille, die keinen Tipp abfangen darf. Auf der Karte läuft der Nachtrag weiter und ist dort zu sehen: Bauleiste und Kopf der Punktkarte tragen „Nachtrag vom 03.10.“ in ihrer bestehenden Zeile. Die Uhrzeit ist freiwillig und sagt es.

**Das Baudatum des Nachtrags wird geprüft, die Koordinate eines Zusatzpunkts ebenso.** Eine Zukunft wird benannt und aus dem Feld genommen, Leeren bringt den alten Tag zurück, und weiter als 30 Tage zurück fragt „Vor 22 Monaten – stimmt das Jahr?“; geprüft wird beim Verlassen des Feldes, weil das Datumsfeld beim Eintippen jede Jahreszahl-Zwischenstufe als Wert meldet. Baubeginn, Bauende und Übergabe fragen im Nachtrag nur die Uhrzeit auf dem Baudatum. Die Koordinate eines Zusatzpunkts wird gegen die nächste Trasse gemessen wie die eines geplanten gegen seinen Punkt; liegt die vertauschte Lage nahe, bietet der Dialog „tauschen“, und der Haken „so weit entfernt“ gilt nur für den Wert, bei dem er gesetzt wurde. „◉ hier“ fragt ab einem Kilometer zurück, statt still einen Zusatzpunkt anzulegen – auf beiden Wegen, in der Liste wie auf der Karte; zwischen 300 m und 1 km bleibt es bei Aufnahme mit Warnung.

**Kleineres:** „Auf Karte verschieben“ im Nachtrag lässt die Bauzeit eines draußen aufgenommenen Punktes stehen. Der Rückgabe-Code steht erst beim Absenden da, weil er sich mit jeder Aufnahme ändert. Eine Datei oder ein Link von einer neueren Version sagt, dass nicht alles gelesen wird, statt still auf die eigene Version zu setzen. „Trommeln verbaut“ hat im Gerät kein Feld; der Bogen verweist auf eine freie Materialzeile.

**Ein gehaltener Punkt springt nicht mehr beim Zittern, und ein geschluckter Tipp blitzt auf.** Beim Halten zum Ziehen sprang der Punkt um den Versatz, sobald der Finger die Ruhezone verließ; er wird jetzt sanft in den Versatz geführt. Ein Tipp, den die Sperre schluckt, lässt die Fläche kurz aufblinken (`tippWink`), damit der Trupp nicht für kaputt hält, was nur zu schnell war. Das seitliche Blatt nennt bei einem Zwilling – derselbe Punkt in Soll und Ist – zuerst den Zwilling. Wo ein Rollbereich mehr enthält, als im Bild steht, sagt „mehr ▾“ es, und die Bau-Liste behält ihre Rollposition, wenn sie neu aufgebaut wird.

**Ein Kartenserver, der die Verbindung hält und nie antwortet, lässt die Karte nicht mehr grau stehen, und die Statusleiste nennt in fester Rangfolge Anlass, Vorrat und „gröber“.** Bisher sprang der Rückgriff auf die gröbere Stufe aus dem Vorrat nur bei `error` oder `navigator.onLine === false`; ein Abruf ohne Antwort löste beides nicht aus, bei Stufe 18 standen nach 30 s noch zwölf von zwölf Kacheln offen und die Leiste schwieg. Jede Kachel der Arbeitskarte hat jetzt vier Sekunden (`ABRUF_FRIST` in `js/map.js`), danach greift die gröbere Stufe ein und die Kachelwacht meldet den Ausfall über `fbp:abrufstumm`. Die Druckkarten haben keine Frist: das Blatt wartet lieber auf die feine Kachel, als gröber zu drucken. Ein einzelner Rückgriff zeigt die Zeile auch bei Netz („Karte nicht erreichbar“, am Korridorrand „Rand: gröber“, über der feinsten mitgenommenen Stufe „feiner nicht mitgenommen“). Mit Anlass steht hinten nur „gröber“. Die Zeile bleibt einzeilig, weil die Prüfung der Statusleiste das verlangt: gekürzt wird zuerst „gröber“, dann der Anlass, der Vorrat zuletzt, und „kein Netz“ steht nie angeschnitten da. Verworfen ist der Umbruch auf zwei Zeilen, der der Karte 8 px nimmt, genau dort, wo Gitterangabe und Vorrat gelesen werden. Die Kachelwacht vergisst ihren Ausfall, wenn der Browser das Netz zurückmeldet; sonst bliebe ein weiter schweigender Server für immer stumm. Der Link-Dialog verbirgt „von Hand weitergegeben“ wirklich, bis das Kopieren fehlschlägt (`hidden` verlor gegen `display:flex`), und führt seinen „Kein Netz“-Hinweis dem Netz nach, solange er offen ist.

**Die Streckenfarben haben jetzt auch bei Tag eine Stufe, und „gewählt“ ist nachts zu sehen.** Orange (#f57c00) hielt in der Sonne 2,1:1 gegen den Kartengrund; `tagFarbe()` in `js/strecken.js` dunkelt jede Farbe im selben Farbton bis 3:1 ab, wie `nachtFarbe()` nach oben aufhellt, und sie gilt nur an der Arbeitskarte (`#karte`). Gespeichert bleibt die Farbe, die Druckkarten zeichnen sie unverändert, ein `filter` gibt es nicht. Der Hof um gewählte und aktive Punkte, Bilder, Flächen und Schilder war ein festes, blasses Blau (1,3:1 nachts) und ist jetzt über `--hof-*` nachts hell mit dunklem Saum; ebenso der aktive Strich des Umschalters in der Querspalte. Gebaute Punkte tragen eine Nachtstufe mit schwarzem 11-px-Kürzel, und die Baustandsmarke misst 11 px.

**Die Lagekarte sagt auf Papier, wer baut, seit wann nichts kam und was gemeldet ist.** Das Schild trug Baustand und Warnung, aber weder Trupp noch Zeit noch den Satz an den S 6, und „ohne Meldung seit 2 h“ stand nur am Bildschirm, wo ein Zähler es nachführt. Jetzt trägt jedes Schild einer Strecke im Bau eine zweite kleine Zeile „1. FmTr · zuletzt 21:28“, die Überfälligkeit steht als Wort „⚠ seit 3 h ohne Meldung“, gerechnet auf den Lagestand des Blatts, und die Meldung an den S 6 steht als „✉ S 6 (1)“ im Schild und im Wortlaut, gekürzt, als Fußnote unter der Karte. Der Wortlaut gehört nicht ins Schild: es würde so groß, dass die Platzsuche nicht mehr aufginge – 0 Überdeckungen in allen vier Formaten bleibt die Bedingung. „neu“ bleibt am Bildschirm; ein Blatt kennt kein „seit dem letzten Hinsehen“. Der Auszug folgt dem Rahmen, und das Gitter wird so fein gewählt, dass mindestens vier Linien über die kurze Seite stehen – A4 quer stand bei 1 : 89.000 mit 10-km-Gitter, jetzt bei 1 : 75.000–80.000 mit 1-km-Gitter. Im Schwarz-Weiß-Druck trägt jede Strecke ein eigenes Strichmuster und eine Nummer, im Schild und mehrfach an der Linie; die Verlegeart-Muster der Auftragsblätter gelten dort nicht, denn neun Erdkabel waren neun gleiche Linien.

**Das Summenband trennt Zähler von Warnungen, und die Liste stuft nach Schwere.** „⚠ 1 Prüfung nicht bestanden“ stand im selben Blau wie „4 im Bau“, „2 h“ brach in zwei Zeilen. Die Warnungen stehen jetzt als eigene Marken im Mahnton unter den Zählern. Die Liste ordnet in fünf Stufen – Prüfung nicht bestanden, überfällig, Abweichung oder abseits, neu, Rest –, und über den Strecken eines Abschnitts steht „Alle gesehen (n)“, gemerkt im Gerät wie das einzelne „gesehen“.

**Im Baumodus sind auch Strom und Richtfunk nur zu lesen.** Netzform, Last und Spannungsfall, Aufbauplätze, Antennen, Band, Kanal, Modulation und Kommentar standen als Felder da, dazu „Duplizieren“, „Link an den Bautrupp“ und „Adresse suchen, Platz setzen“, das den geplanten Endpunkt verschob. Sie sind jetzt `nur-planung`, an ihrer Stelle steht eine Textzeile; die gerechnete Auslegung bleibt. Der Trupp meldet zurück und verteilt nichts weiter, und eine Kopie wäre eine Strecke, die der Planer nie gesehen hat.

**Die Baudokumentation rechnet zwei Trupps auseinander.** Der Materialnachweis zeigt bei mehr als einem Abschnitt mit Material je Artikel eine Zeile je Abschnitt unter der Summe; „1 von 2 beendet“ nennt, wer fehlt; unter den Kennzahlen sagt ein Satz, dass die Lücke zwischen zwei Abschnitten liegt und kein Minderbau ist; der Absender „1. FmTr (Truppführer Lang)“ wird in Trupp und Truppführer getrennt. Der Auftrag zählt sich selbst, ohne die abgetrennten Bögen. Auf der Arbeitskarte weichen die Schilder Zoom, Maßstab, Kartenoptionen, Werkzeugen und der Statusleiste aus; die Platzsuche kannte vorher nur Trassen, Marken und andere Schilder.

## Nach der siebten Runde der THW-Reviewer

Die elf Prüfungen ein siebtes Mal, zum ersten Mal ohne P0. Die 15 P1 lagen
fast alle dort, wo die sechste Runde Neues gebaut hatte: im Empfangsdialog
(„schon eingespielt“ sagte, die Messung sei verbucht, obwohl sie es nicht war),
in „Trupp wechseln“ mit ↶ und in den Griffen, wo der Einfügegriff den Punkt
beim Halten verdeckte. Dazu kam, was bisher nicht auffiel: ein Cloud-Abgleich
ohne Frist und eine Quittung bei vollem Speicher, die schneller war als das
Speichern. Das Schema bleibt bei 20.

**Eine Baumeldung wird erst quittiert, wenn sie gespeichert ist, und der Trupp erfährt, was nicht übernommen wurde.** Nach „Einspielen“ stand nur eine Pille von drei Sekunden da. Der Planer funkte „angekommen“, und der Trupp hielt eine nicht übernommene Übergabe für verbucht; bei vollem Speicher erschien der Code sogar, obwohl das Speichern erst 400 ms später scheiterte und nach dem Neuladen alles fort war. Jetzt speichert das Einspielen sofort (`aendernGesichert` in `state.js`) und nimmt die Änderung bei einem Fehlschlag im selben Objekt zurück. Dann bleibt der Dialog offen, die Adresse bleibt stehen, und „Erst als Datei sichern“ ist der Ausweg. Bei Erfolg steht wie nach „Verwerfen“ ein eigener Dialog „Dem Trupp durchgeben“ mit dem Code und, bei Teilübernahme, mit jedem nicht übernommenen Stamm und der Übergabe (`nichtUebernommen`). „Schon eingespielt“ sagt der Dialog nur noch, wenn es stimmt: ändert eine Meldung nichts, weil ihre Prüfung nicht übernommen wird, ist es `nichtsGeaendert` – mit Hinweisen, dem Häkchen „Messung übernehmen“ und einer Funkformel, die den wahren Grund nennt. Die Nachmessung desselben Trupps gilt bei gleicher oder späterer Zeit, und die Prüfzeile zieht beim Ändern des Ergebnisses ihre Zeit nach; sonst blieb „durchgefallen“ beim Planer stehen.

**Der Empfangsdialog sagt, wenn dieselbe Aufnahme doppelt dastünde oder die eigene Abschrift weicht.** Abgeschriebenes ohne Abschnitt zählt als anderer Bestand: das Häkchen „als eigenen Bauabschnitt“ wird angeboten, die Warnung nennt die Abschrift und schickt nicht zum Trupp, und eine eingetragene Übergabe hält den Stand auf „übergeben“. Stehen dieselben geplanten Punkte danach in mehr als einem Abschnitt (Umbenennen, „Trupp wechseln“, zwei Abschnitte desselben Trupps), warnt der Dialog und bietet an, den alten Abschnitt zu ersetzen – nie bei einem Abschnitt mit Abgeschriebenem. Abschrift und Gerät am selben Punkt sind kein Verlust, die verdrängte Zeile wird genannt. Der Verlust steht oben mit „⚠ Verlust:“, Verwerfen und Einspielen auf festen Seiten. Eine Baumeldung von einer neueren Fassung wird als solche benannt und nie als Planung geöffnet. Verworfen wurde: Abschnitte mit Abgeschriebenem zum Ersetzen anzubieten, weil die Abschrift des Planers dann ohne Meldung verloren ginge.

**„Trupp wechseln“ lässt sich mit ↶ ganz zurücknehmen, und die Frage nach dem Trupp drängt sich nicht mehr nach jedem Punkt auf.** Gerätetrupp und Abschnitt lagen an zwei Orten, der Trupp im Gerätespeicher, der Abschnitt im Verlauf, und ↶ nahm nur den Abschnitt zurück: er hieß wieder „1. FmTr“, das Gerät blieb „2. FmTr“, der Abschnitt galt als fremd, die Meldung trug null Punkte. Jetzt merkt sich `truppSchrittMerken` (`baudoku.js`) den Zeitstempel der Planung vor und nach dem Schritt, und `rueckgaengig` stellt mit ↶ und ↷ den Gerätetrupp mit um – ohne Eingriff in `state.js` und ohne Schemaerhöhung. Der Wechseldialog nennt je Knopf seine Folge („Nur Namen korrigieren“ nimmt die Einträge mit, „Anderer Trupp übernimmt“ lässt sie beim alten Namen und hebt keinen hervor); der Truppführer ist nicht mehr mit dem alten vorbelegt. Im Fremdfall steht der eigene Abschnitt als Hauptweg voran, die aufgetragenen Trupps sind der Nebenweg, und wer damit das Gerät umbenennt, wird vorher gefragt. Truppnamen werden ohne Groß-/Kleinschreibung, Leerzeichen und Punkte verglichen (`truppSchluessel`), und das Gerät merkt sich frühere Namen, damit „Nicht dabei: 2. FmTr – das meldet der andere Trupp selbst“ nicht für einen Abschnitt steht, den dieses Gerät selbst angelegt hat. Die Festlegung, dass die Frage wiederkommt, bleibt, aber nach dem zweiten „Später“ bei einer Aufnahme ruht der Dialog und die feste Marke „Trupp wählen“ (Bauleiste, Kopf des Bau-Reiters) übernimmt: ein Modal nach jedem Punkt vertrieb die Trupps vom Gerät. Die Frage nach der Punktkarte kommt ohne Verzug. Verworfen wurde, die Frage ganz einzustellen, weil die Meldung ohne Abschnitt beim Planer die des anderen Trupps ersetzt. „Auftrag an (Trupp)“ ist in der einfachen Ansicht sichtbar, weil es Planeraufgabe ist und der Planer sonst nie zwei Trupps aufgeben konnte. „Wer baut?“ heißt ohne Namen „Ohne Namen weiter“, und der Absende-Dialog warnt bei fehlendem Trupp. Der Nachtrag, der ohne Zutun endet, steht als Block mit „Nachtrag fortsetzen“ oder „Ist gewollt“ da, bis entschieden ist, und die Pille des Moduswechsels überschreibt sein Ende nicht mehr.

**Die Schilder der Lagekarte verdecken weder Trassen noch Gitterangabe, Nordpfeil und Maßstab, und ein Treffpunkt beider Trupps schließt die Lücke.** Die Platzsuche kannte auf dem Blatt nur Schilder: das Schild „an der Strecke“ lag bei kurzen Strecken auf der eigenen oder der Nachbartrasse (A4 quer: von neun Strecken nur Stummel), und die Gitterangabe, der Nordpfeil, der Maßstab und die Namensnennung der Kartengrundlage deckten Schilder zu, weil `_sperrflaechen()` auf dem Blatt eine leere Liste lieferte. Jetzt weicht auch das Schild an der Strecke Trassen und Marken aus (`_schildSchieben` mit weichen Hindernissen, nur auf dem Blatt); liegt es danach noch auf einer Trasse, rückt es ab und sucht wie ein abgerücktes. Die vier Kästen sind Sperrflächen, und die Platzsuche läuft nach Gitter und Maßstab noch einmal, weil beide erst nach dem ersten Setzen ihre Größe haben. Die Prüfung zählt Schild-auf-Trasse, Schild-unter-Kasten und Nummernmarke-auf-Schild in allen vier Formaten mit; 0 Überdeckungen aller Schilder bleibt die Bedingung. Die Zeile „Trupp · zuletzt hh:mm“ bricht um, die Uhrzeit bleibt als Ganzes im Schild; in Schwarz-Weiß hatten die beiden Muster mit „Punkt“ einen Strich der Länge 0,1 mit stumpfer Kappe, unsichtbar und von langen Strichen nicht zu unterscheiden. Ein von beiden Abschnitten bestätigter Planpunkt gilt als Treffpunkt (`istVerlauf`) und schließt die Lücke, gleich in welcher Reihenfolge die beiden Bestätigungen in der Liste stehen; auf einem Gerät, das beide Abschriften aufnimmt, ersetzt die zweite sie nicht mehr. Jede Lücke nennt ihre Punktnummern, und die Spalte „Punkte“ der Bauabschnitte nennt ohne erklärtes von/bis die Zahl der Aufnahmen. Verworfen wurde, die Schilder der Arbeitskarte ebenso um Trassen herumzuschieben: dort schiebt der Nutzer die Karte unter dem Schild weg, und ein Schild, das beim nächsten Zoom wegen einer Marke woandershin sprang, wäre nicht auszuhalten.

**Ein ausgefallenes Gerät ist nicht überfällig, und eine aufgehobene Übergabe steht an der Strecke, bis sie gesehen ist.** „Seit 3 h ohne Meldung“ war derselbe Satz für einen Trupp, der schweigt, und einen, der planmäßig auf Papier baut. Ist ein Ausfall eingetragen (am Bau-Block oder an einem Abschnitt), rechnet `ueberfaelligSeit` nicht mehr, und Liste und Schild nennen „Gerät ausgefallen – Papier“. Hebt eine eingespielte Meldung eine Übergabe auf (durchgefallener Stamm neben „übergeben“), hält die Strecke das in `bau.uebergabeZurueckZeit` und `bau.uebergabeZurueckStaemme` fest, ohne Schemaerhöhung: ein Stand ohne die Felder öffnet leer, `bauNormalisieren()` stellt sie her, der Codec lässt sie zu Hause, es ist eine Notiz des Planers über den Empfang. Die Liste nennt „Übergabe zurückgenommen 20:53 (Pegel)“, solange die Meldung als neu gilt (dieselbe Mechanik wie „gesehen“), das Summenband zählt sie als Warnung; mit der nächsten Meldung wird der Vermerk überschrieben. „4 neu“ steht im Summenband als eigene Marke und nicht mehr unter den Baustandszählern. Eine Karte ohne Kacheln meldet sich auf dem Blatt selbst („Kartengrund fehlt“), nicht nur im Dialog: Leaflet meldet das Ende des Ladens auch dann, wenn jede Kachel gescheitert ist, und das Blatt mit leerem Grund ging an den Trupp. Das ist keine Frist, die Druckkarten warten weiter auf die feine Kachel.

**Halten auf einem Punkt greift den Punkt und nie den Einfügegriff daneben.** Im Review legte Halten zum Ziehen einen Punkt ein und bewegte keinen: die Einfügegriffe sitzen ein Drittel der Strecke vom Punkt, bei kurzen Abschnitten 25 px, und der Griff stand in der Stapelfolge über dem Punkt darunter – `elementFromPoint` zeigte den Punkt, die echte Berührung ging an den Griff. Die Griffe liegen jetzt unter allen Punkten ihrer Ebene, und ein Griff, der näher als 28 px an einem Punkt sitzt, bleibt sichtbar, nimmt aber keine Berührung an (`zu-nah`); heranzoomen macht ihn wieder greifbar. Die Prüfung tastet mit echten Berührungen und liest das Ziel des `pointerdown`. Verworfen wurde, die Griffe auf 44 px aufzuziehen, weil sie dann bei kurzen Abschnitten die Punkte verschluckten.

**Die Bau-Liste hält ihren Rollstand an der Zeile des nächsten offenen Punktes.** Beim ersten bestätigten Punkt sprang sie von 1100 auf 2500 px und glitt zurück: der Anker lag am Vorratsblock, der ans Ende wanderte, und danach zentrierte `scrollIntoView` die nächste Zeile. Außerdem änderte die bestätigte Zeile ihre Höhe, und der Knopf des nächsten Punktes rutschte nach jedem Tipp, sodass das rhythmische Weitertippen zwischen die Knöpfe traf. Gehalten wird jetzt die Zeile des nächsten offenen Punktes hinter dem bestätigten (`ankerWunsch`), gerollt wird nur, wenn er außerhalb liegt – Punkt 3 vor Punkt 1 rollt nicht zurück –, und die Bestätigung steht oben, wo sie die nächste Zeile nicht deckt. Vor der ersten Punktzeile stehen weniger Dinge: „Diese Strecke wird gebaut“ bei einer einzigen Strecke nicht, die Kennzahlen-Kacheln erst mit Aufnahme, „Umfang“ des Kartenvorrats nur bei mehreren Strecken, und „Vor dem Ausrücken“ ist oben zugeklappt, sobald die Karte der Strecke vollständig im Gerät liegt. Offen bleibt der Block, solange es etwas zu tun gibt – damit bleibt die Festlegung der fünften Runde erhalten; ihn ans Ende zu stellen wurde verworfen, weil ein Erstnutzer dann weder Karte noch Baunachweis findet.

**Kleineres:** „Trupp wechseln …“ trägt 44 px; der Dialog öffnet ohne Fokus im Feld (die Tastatur nahm quer 360 von 375 px) und hält seine drei Fußknöpfe in einer Reihe. Die Farbfelder der Streckenkarte messen 44 px in der Fläche. „mehr ▾“ steht in 13 px und Textfarbe. Der Wink eines geschluckten Tipps dauert eine Sekunde, die Fehlstart-Meldung beim Ziehen kommt alle 30 s wieder statt einmal je Sitzung. Eine stehende Bestätigung geht weg, wenn das Dateimenü oder ein Dialog aufgeht. Quer auf dem Telefon steht nach „zum Bau“ die Karte vorn, hochkant bleibt der Bau-Reiter.

**Ein Speicher, der nicht antwortet, hält weder den Cloud-Abgleich noch die Höhenkachel fest, und eine Karte, die nur gröber ankam, wird nach dem Funkloch still nachgeholt.** Der einzige `fetch` des Abgleichs (`anfrage` in `js/cloud.js`) hatte keine Frist: eine Verbindung, die das Netzsymbol hielt und nichts lieferte, ließ „wird übertragen …“ bis zum Neuladen stehen, weil `jetztAbgleichen` bei laufendem Durchgang dasselbe nie endende Versprechen zurückgab. Jetzt hat jede Anfrage 45 s, danach steht „ausstehend · zuletzt 14:20“ (mit der Uhrzeit des letzten sicheren Stands, im Text und nicht nur im Tooltip) und nach 60 s folgt ein Nachversuch. Die Höhenkachel hat 25 s wie COG und Overpass, sonst blieb ein hängendes Versprechen im Zwischenspeicher, an das „Erneut versuchen“ nicht herankam. Die Kartenfrist von vier Sekunden aus der sechsten Runde bleibt, aber die gröbere Kachel ist jetzt kein Endzustand mehr: beim `online`-Ereignis und – einmal je Kachel – wenn eine andere Kachel doch aus dem Netz kommt, holt `nachladen()` in `js/map.js` die Kachel mit einem unsichtbaren Bild nach (Frist 20 s) und tauscht erst bei Erfolg. Verworfen wurde `redraw()`, denn es risse alle Kacheln ab und ließe die Fläche mitten im endenden Funkloch leer stehen. Die Statusleiste sagt „Netz wieder da“ und „lädt nach“, solange Kacheln gröber stehen, statt still zu verschwinden und die unscharfe Karte wie „alles gut“ aussehen zu lassen; bleibt es gröber, steht „Karte langsam · … · gröber“. Bei 320 px kürzt zuerst der Vorrat, nie „gröber“.

**Eine Entscheidung im Konflikt legt keine Kopien mehr an, wenn das Netz abreißt, und der Dialog sagt, was jeder Knopf kostet.** „Beide behalten“ legte die Kopie an, bevor die Übertragung gelang, und jeder Fehlschlag im Funkloch brachte eine weitere; ein Netzfehler wurde als rotes „Fehler“ gemeldet und verwarf den Konflikt, der nächste Durchgang stellte ihn neu. Jetzt kommt die Kopie erst nach der Übertragung, dieselbe Fassung wird nur einmal danebengelegt, der Konflikt bleibt stehen, und der Stand ist „ausstehend“. „Dieses Gerät gilt“ legt weiterhin keine Kopie des Speicherstands an – mit Kopie wäre es von „Beide behalten“ nicht mehr zu unterscheiden –, sagt es aber im Dialog (Folgesatz zu allen vier Knöpfen) und steht im Gefahrton. Eine Datei oder ein Link von einer neueren Version öffnet nicht mehr vor dem Dialog, und der Rat lautet „alle Fenster schließen und neu öffnen“, denn ein Neuladen allein holt den Wächter-Stand nicht; im Link-Dialog ist dann „Verwerfen“ der Hauptknopf.

**Der Bau-Reiter warnt selbst vor vollem Speicher und lässt einen Speicherfehler nicht mit dem roten Hinweis verschwinden.** Die Vorwarnung stand nur im Projekt-Reiter, den am Bauort niemand aufschlägt. Jetzt steht ab 80 % Belegung ein Block im Bau-Reiter, und bei einem Fehlschlag ein Block, der bleibt, bis ein Schreiben gelingt: „Die letzten n Aufnahmen sind nur im Fenster – jetzt zurückmelden oder als Datei sichern“, mit „Zurückmelden“ als erstem Ausweg, denn der Planer braucht die Aufnahme und eine Datei im Telefon bringt sie nicht zu ihm. Das Band trägt „Nicht gespeichert · nur im Fenster“ dauerhaft. Kleineres: In der Listenansicht der Schmalansicht trägt das Band „Kein Netz“, und die Kein-Netz-Warnung der Baumeldung nennt „Als Datei“ als netzunabhängigen Weg. Der Moduswechsel bei 36 Strecken (1,2–2,5 s) blieb unangetastet: eine Entlastung ohne Profil am Gerät wäre geraten.

**Die durchgefallene Prüfung hat auf Karte und Lagekarte eine eigene Form, und die Streckenfarben tragen in Liste und Karte dieselbe Stufe.** „Prüfung nicht bestanden“ trug dieselbe amber Schildpille mit ⚠ wie „1 Abw.“, obwohl das eine die Übergabe sperrt und das andere eine Nachfrage ist. Sie steht jetzt gefüllt in Rot mit „✖“ (`bz-fehl`), die Abweichung bleibt hell und doppelt umrandet – im S/W-Druck trägt die Form den Unterschied. Die Größe der Marke ist gleich geblieben, weil die Platzsuche der Lagekarte mit ihr rechnet. Die Farbpunkte der Streckenliste zeigten die gespeicherte Farbe (nachts Lila 1,8:1, Braun 1,5:1); sie tragen jetzt `--farbe-tag` und `--farbe-nacht` wie die Linie. Die Tagstufe wird gegen den gemessenen Kartengrund (223, 229, 236) mit 3,3:1 gerechnet statt gegen ein helleres Weiß (Orange stand real bei 3,01:1); gespeichert und Druckkarten bleiben unberührt. Das Nachtrag-Fenster hat nachts Rand und gefüllte Kopfzeile in der hellen Stufe, damit der Zustand, der jeden Griff darunter umdeutet, auch im Dunkeln zu erkennen ist.

## Nach der achten Runde der THW-Reviewer

Die elf Prüfungen ein achtes Mal, ohne P0 und mit zwölf P1 – fast alle wieder
dort, wo die siebte Runde Neues gebaut hatte. Sechs Reviewer fanden dieselbe
Stelle: die drei Fußknöpfe von „Trupp wechseln“ liefen auf dem Telefon
ineinander. Dazu kamen eine Nachmessung, die von der Reihenfolge der Meldungen
abhing, eine Funkformel, die auf einen Tipp daneben verschwand, und ein
Speicherfehler, der aussah wie der Normalfall. Das Schema bleibt bei 20.

**Die Nachmessung gehört der Prüfzeile und nicht dem letzten Absender der Strecke, und eine aufgehobene Übergabe steht nicht mehr als gültige in der Prüfung.** „Derselbe Trupp“ hing an `bau.gemeldetVon`: meldete ein zweiter Trupp dazwischen, galt die Nachmessung des ersten als fremd; und dieselbe Meldung des zweiten, deren „bestanden“ der Planer abgelehnt hatte, galt beim nächsten Einspielen als eigene und löschte die durchgefallene Messung still. Jetzt trägt jede Prüfzeile ihren Absender (`staemme[].von`, vom Planer beim Einspielen gesetzt); eine Nachmessung gilt nur, wenn Zeile und Meldung vom selben Trupp sind (`gleicherTrupp`, der Truppführer zählt nicht). Eine Zeile ohne Absender (Bestand) gilt wie bisher nach dem letzten Absender. `gemeldetVon` rückt nur noch vor, wenn die Meldung hier etwas bewirkt hat. Das Feld braucht keine Schemaerhöhung: es ist additiv, ein Stand ohne es öffnet leer, `pruefungNormalisieren()` stellt es her, der Codec lässt es zu Hause – es ist, wie `gemeldetVon`, eine Notiz des Planers über den Empfang. Daher entfällt der verworfene Weg „Absender je Prüfzeile, weil Schema 21“. Neben einem durchgefallenen Stamm gilt keine Übergabe (3.5): `pruefungZusammenfuehren` leert sie jetzt – auch im Abschnittsfall, wo der Stand schon „im Bau“ steht – und hält sie in `bau.uebergabeZurueckWar` fest (an, durch, Zeit). Eine berichtigte Prüfzeile (gleicher Stamm, neues Ergebnis) steht im Verlust nicht mehr als „1 Prüfzeile verloren“. Die Funkformel „Dem Trupp durchgeben“ nennt nach Gewicht, was beim Planer entfällt, was nicht übernommen wurde, die bewusst ausgelassene Strecke (mit Namen, ohne Neumessen zu verlangen) und die Rückfragen (doppelt bestätigte Punkte, Punkte neben der Trasse) – `durchgabe()` in `baumeldung.js`; bei einer Meldung, die nichts geändert hat, sagt sie „angekommen, aber NICHTS übernommen“, bei „bereits übernommen“ „dieser Stand war schon da“ ohne den Satz über den wieder öffnenden Link. „Älter“ gilt erst ab einer Minute Abstand. Das Häkchen „ersetzen“ sagt „kann derselbe Trupp sein“ und nennt den Verlust schon vor dem Ankreuzen. Verworfen wurde: Absender in vorhandene Textfelder (`pruefer`) zu packen, weil das die Person meint, nicht den Trupp, und das Gerät seinen Absender erst beim Melden kennt.

**Die Funkformel nach „Einspielen“ und „Verwerfen“ geht nur noch mit „Schließen“ zu, und ein Speicherfehler zeigt nur noch, was wirklich verloren ist.** Der Folgedialog „Dem Trupp durchgeben“ war kleiner als der Empfangsdialog, und der zweite Tipp eines Doppeltipps auf „Einspielen“ traf sein Schleier – die Formel verschwand ungelesen. Er ist jetzt geschützt wie der Empfangsdialog (kein Esc, kein Schleier-Tipp, kein Kreuz); ein Tipp daneben lässt nur den Knopf aufblitzen, und der Knopf wirkt erst nach der Sperre von 400 ms. Eine Pille wäre das Falsche gewesen: sie läge über dem Fuß, den der Finger sucht. Scheitert das Einspielen am Speicher, nimmt `aendernGesichert` alles zurück – auch den Redo-Stapel und die Marke „neu“ – und meldet das mit dem eigenen Grund `zurueckgenommen` statt mit `speicherfehler`: sonst rechnete die Oberfläche „Aufnahmen nur im Fenster“, wo nichts im Fenster stand, und die Statusleiste blieb bei „wird gespeichert …“. Nach dem Fehlschlag steht „Erst als Datei sichern“ vorn, nie „Verwerfen“, und die Funkformel nennt den vollen Speicher als Grund, damit der Trupp nichts an seiner Meldung ändert. Die Speicherwarnung zählt mit, und das Verlassen der Seite fragt bei einem Speicherfehler immer nach, auch wenn irgendwann eine Datei gesichert wurde. „↶“ nach dem Einspielen sagt, dass die quittierte Baumeldung zurückgenommen ist und der Trupp sie für übernommen hält; „↷“ holt sie zurück. Der Nachtrag steht, solange er läuft, im Sitzungsspeicher, damit sein Ende beim Neuladen auch ohne offene Zeilen genannt wird – aber nur auf dem Gerät, das ihn begonnen hat, nie beim Planer, der eine Abschrift einspielt. Ab mehr als fünf Strecken steht im Empfangsdialog eine Summenzeile oben. Verworfen wurde die Pille als Träger der Funkformel (zu kurz, deckt den Fuß) und ein Rückfrage-Dialog vor „↶“ (Festlegung der siebten Runde: ↶ nimmt alles zurück, es wird nur benannt).

**Der Dialog „Trupp wechseln“ ist auf dem Telefon lesbar, und „Nur Namen korrigieren“ nimmt die Einträge wirklich mit.** Die drei Fußknöpfe standen in einer festen Reihe und liefen schmal ineinander (gemessen 125 von 89 px), denn `.knopf` bricht nicht um. Sie stehen jetzt bis 600 px Dialogbreite untereinander, „Abbrechen“ zuletzt und abgesetzt. Steht der Abschnitt des neuen Trupps an der Strecke schon da, hängt „Nur Namen korrigieren“ die Einträge dorthin um, statt sie im nun fremden alten Abschnitt zu lassen – vorher trug die Meldung null Strecken, obwohl der Dialog „sie gehen mit“ sagte. Umgehängt wird nur die Zuordnung, der alte, leere Abschnitt bleibt, weil ihn der Planer aufgetragen haben kann. Die Marke „Trupp wählen“ an der Bauleiste ist, solange die Wahl ruht, ein Griff mit Handschuhmaß und öffnet die Frage; ohne offene Wahl nimmt sie weiter keinen Tipp an, damit sie „Punkt hier“ nichts wegfängt. Die Warnung „Kein Trupp genannt“ im Link-Dialog hat einen Weg zum Feld („Trupp eintragen …“, danach entsteht der Link neu). `truppSchluessel` hält „1.2 FmTr“ und „12 FmTr“ auseinander und gleicht „FmTr-1“ mit „FmTr 1“ ab; `absenderText` nutzt denselben Vergleich, damit der Führer auch bei „1.fmtr“ am Gerät mitgeht.

**Die Lagekarte sagt, was in der Liste schon stand: eine zurückgenommene Übergabe, die Lücke und den Trupp, bei dem es Zeit ist, nach dem Papier zu fragen – und die Baudokumentation sagt, wer welches Stück gebaut hat.** Die Wand der Führungsstelle zeigte „0 von 9 übergeben“ und darunter „gebaut“, ohne dass eine zurückgefallene Strecke zu erkennen war. Das Schild trägt jetzt „↩ Übergabe zurückgenommen 20:00“, solange die Strecke nicht wieder übergeben ist; anders als die Liste hängt es nicht an „gesehen“, denn das Blatt hat keinen Haken. Der Stamm steht als Fußnote, die Kachel „Baustand“ zählt mit. Die Liste bleibt bei der Festlegung der siebten Runde: der Hinweis steht, bis die Meldung gesehen ist. Die Lücke steht im Schild („Lücke 691 m“) und lang gestrichelt auf der Karte; das ist keine gebaute Trasse, sondern das, was fehlt, und sie hat eine eigene Klasse. Ein ausgefallenes Gerät wird nie „überfällig“, weil es planmäßig schweigt. Nach `AUSFALL_NACHFRAGE_MIN` (180 Minuten, ein Richtwert aus dem Review und keine Vorschrift, deshalb ohne Fundstelle in `strecken.js`) heißt es aber „Papier nachfragen“, im Schild mit dem Alter („seit 4 h“), in der Liste und im Summenband. Auf der Baudokumentation stand ein Treffpunkt nirgends, und zwei Trupps waren in Schwarz-Weiß eine einzige Linie. Jetzt trägt jeder Abschnitt sein Kürzel an der Linie und eine Zeile nennt „Gebaut von“ und „Treffpunkt Pkt. 3“. Ein Strichmuster je Abschnitt war verworfen: die gebaute Trasse bleibt durchgezogen, nur die Planung trägt Muster. Auf einer dichten Lagekarte wird ein Schild, das auch nach der Platzsuche keinen Platz findet, verkürzt (Name, Stand, Warnungen) statt gestapelt; die Zeichenerklärung sagt es. Der Hinweis „Kartengrund fehlt“ gilt dabei als Sperrfläche. Die Überdeckungsmessung des Reviews fragte die Hüllen der Marker ab, die keine Ausdehnung haben – gemessen wird am Kasten des Schildes. Die Lagekarte öffnet ohne eigene Wahl auf A4, A3 oder A1 nach Zahl der Strecken und Ausdehnung; ein vorgeschlagenes Format wird nicht gemerkt, damit eine wachsende Lage nicht auf A4 hängen bleibt.

**Ein abgerückter Einfügegriff bleibt es nach jedem Neuzeichnen, und quer bestätigt ein zweiter Tipp keinen Punkt mehr blind.** Die Klasse `zu-nah` wurde am `add`-Ereignis des Griffs gesetzt, doch zu diesem Zeitpunkt hängt die Gruppe noch nicht an der Karte und der Griff hat kein Element: nach Umbenennen, Punkt ändern und Rückgängig stand sie wieder auf „aus“, bis jemand zoomte, und die Zone des Griffs lag wieder über dem Rand der Punktzone. Jetzt läuft `_griffeAbruecken()` einmal am Ende jedes Zeichnens. Die Prüfung ändert die Planung dreimal und tastet im Streifen 24 bis 33 px neben dem Punkt mit echten Berührungen. Die Bau-Liste hält nach „✓ wie geplant“ ihren Rollstand, solange der Kopf der nächsten Zeile im Bild ist: Zentrieren schob quer die Liste um rund 110 px und damit den Knopf des nächsten Punktes unter die Fingerstelle, und ein zweiter Tipp nach 580 ms bestätigte ihn – eine falsche Ist-Eintragung. Quer und niedrig gilt außerdem eine Sperre von 700 ms statt 400 ms (hochkant genügen 400, weil die Liste dort kaum rollt und eine längere Frist das rhythmische Weitertippen bremste), und ein Tipp auf eine eben bestätigte Zeile blitzt auf und sagt „Punkt n ist schon bestätigt“, statt sie still aufzuklappen. Die Meldung „oben“ rückt quer unter die Reiterzeile, der Zielmerker „an Strecke A“ hängt mit Spalt unter der Bauleiste, und die Zeichenleiste steht quer einzeilig (54 statt 84 px), damit das untere Kartenband zum Setzen frei bleibt. Im Empfangsdialog steht quer „Bisher … → danach …“ vor den Kästchen und Feldern, damit die Folge vor dem Hauptknopf im Bild steht. Verworfen wurde, den Fußknopf des Empfangsdialogs erst nach Rollen zum Ende zu aktivieren (neue JS-Logik im Dialogaufbau) und die längere Sperre auch hochkant zu setzen.

**Ein Speicherfehler sieht nicht mehr aus wie der Normalfall, und die Cloud-Anzeigen sagen, was geschieht und wie es weitergeht.** „Nicht im Gerät gespeichert“ stand im Band im selben Amber wie „Im Gerät gespeichert · keine Datei“, und das Kopffeld verlor im Fehlerfall seine Pille. Jetzt trägt der Fehler in Kopf, Band und Bau-Reiter-Block eine gefüllte Rotfläche mit ✖ (`--fehler-*`), die im Schwarz-Weiß-Druck an der Form zu erkennen ist und bei Tag wie nachts mindestens 4,5:1 hält. Dieselbe Sprache gilt für die durchgefallene Prüfung im Empfangsdialog (`.bau-warnung.fehler`). „Im Fenster“ ist Browsersprache und heißt nun „auf dem Bildschirm“. Das Nachladen gröberer Kacheln gibt nach einem Versuch nicht mehr auf: es wiederholt nach 15 s, 45 s und 2 min (`NACHLADE_PAUSEN` in `js/map.js`), auch wenn keine andere Kachel aus dem Netz kommt, und danach bei Ereignissen (Netz zurück, neuer Ausschnitt). „gröber“ in der Leiste zählt, was im Bild steht (`grobSichtbar`), und nach der letzten Wiederholung sagt eine Pille „Zoomen lädt sie neu“. Die gescheiterte Höhenkachel wird beim `online`-Ereignis und nach 60 s vergessen, und „Höhe –“ nennt den Grund. „✓ Netz wieder da“ ist grün und steht 7 s, ebenso im Listenband. Die Statusleiste hochkant nutzt Kurzformen statt abgeschnittener Anlässe. In der Cloud steht nach 10 s „dauert länger – zuletzt gesichert“, die Pause nach einer Anfrage ohne Antwort verkürzt keine Änderung mehr (`pauseBis`), und „Später entscheiden“ lässt den Konflikt in der Lage stehen: die Zeile sagt „Konflikt offen“ und ist antippbar. „Dieses Gerät gilt“ überschreibt den Cloud-Stand nur über eine Rückfrage mit beiden Ständen samt Datum und Trupps (Hauptknopf „Zurück“), steht abgesetzt im Inhalt und nicht im Fuß, und die Erklärung folgt der Reihenfolge der Knöpfe; gesagt wird „Cloud-Stand“ und „dieses Gerät“. Verworfen wurde eine Sicherungskopie des Cloud-Stands vor dem Überschreiben: mit ihr wäre „Dieses Gerät gilt“ von „Beide behalten“ nicht mehr zu unterscheiden, und die Festlegung der siebten Runde bleibt bestehen; das Rückfallnetz ist „Zurück“, dann „Beide behalten“, und die Rückfrage nennt es. Verworfen wurde auch der Umbruch der Netzzeile im Listenband bei „Netz wieder da“ und bei stummem Kartenserver, weil die Liste sonst 23 px nach unten rutschte; nur „Kein Netz“ darf umbrechen.

## Nach der neunten Runde der THW-Reviewer

Die elf Prüfungen ein neuntes Mal, ohne P0 und mit neun P1. Drei Reviewer
fanden dieselbe Stelle: den Erklärtext im roten Speicherfehler-Block, der
grau auf Rot stand und bei Tag nicht zu lesen war – ein Fehler der achten
Runde. Vier fanden, dass der Vermerk „Übergabe zurückgenommen“ mit der
nächsten Meldung verschwand. Dazu kamen ↶ ohne Wort über die Meldung des
ersten Trupps, eine Zurück-Taste, die aus dem geschützten Funkdialog
hinausführte, und eine Summenzeile, die „keine mit Warnung“ sagte, wo ein
fremder Absender überschrieben worden wäre. Das Schema bleibt bei 20.

**Eine aufgehobene Übergabe kehrt nicht mehr still zurück, und eine abgewiesene Meldung sieht nicht mehr aus wie eine angekommene.** Der vermerkte „↩ Übergabe zurückgenommen“ überschrieb sich bisher mit jeder weiteren Meldung, auch mit der harmlosen eines anderen Trupps oder demselben Link noch einmal; jetzt bleibt er, bis die Strecke wieder übergeben ist oder die durchgefallene Prüfung besteht, und nur eine Meldung mit eigener Rücknahme ersetzt ihn. Was aufgehoben war, steht weiter in `uebergabeZurueckWar` und wirkt als Sperre: eine Übergabe gilt nach der Rücknahme nur durch eine Eintragung mit späterer Zeit, nie durch das Wiedereinspielen eines älteren Standes (sonst käme „Schulz schickt seine alte Meldung noch einmal“ still zurück und der Planer würde nicht gefragt); Stand und Übergabe bleiben dabei synchron. Eine Meldung, die nichts übernommen hat, setzt weder „neu“ noch einen Verlaufsschritt beim Wiederholen; ihr Code steht an der Strecke, gekennzeichnet durch `bau.letzteMeldungNichtUebernommen = {code, zeit, von}` (ohne Schemaerhöhung, nicht im Link). Die Funkformel ist neu gefasst, weil sie den falschen Trupp ansprach und bei Verlust widersprüchlich war (`funkformel()` und `verwerfFormel()` in `baumeldung.js`): bei Verlust „angekommen, ABER beim Planer entfallen“ mit Punktnummern und Papierherkunft, Aufträge getrennt nach Melder und betroffenem Trupp, bei einer fremden Messung „neu messen ist nicht nötig“ statt Neumessen, beim Verwerfen „nicht eingespielt“ statt „übernommen“. Verworfen: den Vermerk stillschweigend nach der nächsten Meldung zu löschen (die Führung verlor die Warnung) und die Sperre an die Uhr des Planers zu binden (zwei Uhren; verglichen wird die Zeit der Übergabe selbst).

**Wer eine eingespielte Baumeldung mit „↶“ zurücknimmt, bekommt dabei immer Code und Absender genannt, und der Planer kann die Rücknahme dem Trupp durchgeben; die Zurück-Taste verlässt die Anwendung auch im geschützten Dialog nicht mehr.** Der Speicher hält nun alle quittierten Einspielschritte (`store.quittungen`) statt nur des letzten. Im Review nahm der zweite Schritt zurück nach zwei Trupps die Meldung des ersten ohne ein Wort zurück, und dieser Trupp hielt seine Aufnahme weiter für übernommen. „↶“ und „↷“ öffnen jetzt den stehenden Funkdialog („Meldung S6VB von 1. FmTr gilt nicht mehr – bitte nochmal melden“) und nicht nur eine Pille von drei Sekunden. Eine Einspielung, die nichts ändert, legt keinen Verlaufsschritt an (`leerOhneSchritt`), sonst benennt „↶“ eine Meldung, die nichts bewirkte. Die letzte Funkformel je Strecke liegt im Gerät (`fbp.funkformel.v1`, in `datenschutz.html` genannt) und ist über „Letzte Funkformel“ an der Strecke wieder abrufbar, denn die Formel wird nur einmal gesprochen und der Rückgabe-Code allein sagt nicht, was durchzugeben war. Geschützte Dialoge legen jetzt ebenfalls einen Verlaufseintrag an: Zurück lässt sie stehen und blitzt den Knopf wie Esc. Über einem Link trägt der Eintrag dessen Adresse. Er ist markiert, damit ein späteres Zurück darauf das Fragment nur räumt und den Dialog nicht neu öffnet. Die Aufnahme eines anderen Absenders zählt nun in Summenzeile und Knopfstand (Einspielen ist dann nicht Hauptknopf, das Sichern als Datei steht vorn). Verworfen wurde, die Funkformel zusätzlich als nicht schließbaren Dialog zu belassen: die Nachschau darf sich beiläufig schließen, nur der erste Funkspruch ist geschützt.

**„Trupp wechseln“ nennt vorher, was dabei doppelt stünde, und „Abbrechen“ steht in jeder Breite abgesetzt am Ende.** Ab 601 px blieb die Reihe aus drei Fußknöpfen, „Abbrechen“ stand links, 8 px neben „Anderer Trupp übernimmt“, und die Folge-Sätze lagen quer unter dem Falz (Rollbereich 251 von 454 px): mit dem Handschuh traf man einen Weg, der Einträge umhängt. Mit Einträgen im Abschnitt steht „Abbrechen“ jetzt auch quer und auf dem Tablet zuletzt, 32 px abgesetzt (`trupp-wechseln-wege`), und die Folge-Sätze stehen vor den Feldern, mit dem Anlass vorn („falsch gewählt“ – „der andere Trupp baut weiter“), je Strecke eine Zeile mit Zahlen und „↶ nimmt den ganzen Wechsel zurück“. Hat der neue Trupp an einer Strecke schon einen Abschnitt, nennt der Dialog nach der Namenseingabe die Überschneidung: Punkte, die beide Abschnitte bestätigt haben (`sollPunkt`), die Materialsumme gleicher Artikel (sie wird beim Umhängen addiert, wie `materialZusammenfassen` es ohnehin tut) und bietet bei höchstens fünf Punkten „Doppelte Punkte zusammenführen“ an – es gilt der jüngere Eintrag, ↶ holt den anderen zurück. Die Pille nennt dasselbe nachher in Warnfarbe. Ein leeres Feld oder der bisherige Trupp als Eingabe werden am Feld abgewiesen („Das ist schon euer Trupp“), keine Pille liegt mehr über „Abbrechen“; der Anfangsfokus liegt nicht mehr auf dem ersten Weg. `truppSchluessel` streicht unsichtbare Zeichen (Nullbreitenleerzeichen aus dem Messenger); „FmTr 1“ und „1.FmTr (Meier)“ bleiben ein anderer Trupp, werden aber als Verdacht genannt (`aehnlicherTrupp`: „nur die Schreibweise weicht ab“), gleichgesetzt wird nichts. Nach der Wahl steht 45 s lang „Falsch gewählt? Trupp wechseln ›“ an der Marke der Bauleiste; die Marke ist als Knopf erkennbar (Rand, Pfeil), überlappt „Punkt hier“ nicht mehr, und die Pille „Ich frage nicht mehr …“ liegt quer unten, weil sie dort sonst die Marke deckte. „Welcher Trupp seid ihr?“ sagt neben dem blassen „Weiter“, dass erst ein Trupp anzutippen ist, und der Fehlstart-Hinweis am Einfügegriff spricht vom Einfügen. Verworfen wurde, die Hinweis-Pille im Bau-Reiter unter die Reiterzeile zu setzen: sie deckte dann Felder statt Bänder, und die Geräteprüfung („Meldung liegt über keinem Feld“) schlug in allen Hochkantfenstern an.

**Auf der Lagekarte bleibt jedes Schild im Rahmen und kaum ein Leitstrich läuft quer über fremde Schilderschrift; auf dem Tablet sind die Schilder der Arbeitskarte kürzer, und der Treffpunkt zweier Trupps hat auf der Baudokumentation eine eigene Form.** Auf einer Lagekarte mit 36 Strecken stand „Strecke 9“ halb über dem Rahmen, und Leitstriche liefen über fremde Namen; die Überdeckungsmessung meldete 0, weil sie nur Schild gegen Schild maß. Ursache des abgeschnittenen Schilds: Die Hülle des abgerückten Schilds sitzt eine Textzeile (rund zwölf Kartenpunkte) unter dem Ankerpunkt der Marke, die Platzsuche rechnete von einer anderen Stelle, als an der das Schild hing. Die Marke wird jetzt um dieses Maß höher gesetzt (`_schilderSetzen`). Ein Leitstrich über einem stehenden Schild und ein Schild auf dem Strich eines gesetzten kosten jetzt (`KOST_STIEL_SCHILD`, `SCHILD_STIEL`); die Nachbesserung in `_schildSchieben` rechnet den Strich des verschobenen Schilds mit, und ein Schild, dessen Strich noch stört, wird wie ein überdecktes verkürzt. Ganz null wird es bei 36 Strecken auf A4 nicht (zwei bis drei Striche je Format), darum verlangt die Prüfung dort höchstens drei und bei den neun Strecken der vier Formate null; Schild gegen Rahmen gilt ohne Ausnahme. Auf der Arbeitskarte im Baumodus werden die Schilder bei weniger als 600 px Kartenbreite oder ab acht Strecken verkürzt (Name, Stand, Warnung); ausgewichen wird weiter nicht, denn dort schiebt der Nutzer die Karte unter dem Schild weg. Das Einpassen lässt oben 150 px Rand für das Schild, und die Werkzeugleiste startet auf dem Tablet ohne gemerkte Wahl zugeklappt. Der Treffpunkt trägt am Bildschirm und auf dem Blatt einen Doppelring und steht in der Legende; der Text sagt in einem Satz, wer sich bei welchem Punkt trifft. Die Marke „↩ zurückgen. 20:20“ bricht auf dem Blatt nicht mehr um, Marken sind dort mindestens 9 px groß, und zwölf Strecken tragen in Schwarz-Weiß zwölf verschiedene Strichmuster. Die Datum-Zeit-Gruppe im Kopf der Baudokumentation hat ihren Klartext daneben, „zuletzt“ trägt in der Liste ein Datum, wenn der Eintrag nicht von heute ist, und eine abgewiesene Meldung nennt die Liste („Meldung nicht übernommen – nachfragen“), sobald `bau.letzteMeldungNichtUebernommen` vorliegt.

**Ein abgerückter Einfügegriff nimmt die Berührung selbst an und sagt „heranzoomen“, statt sie dem Punkt dahinter zu überlassen; ein Doppeltipp nimmt keinen zweiten Punkt auf, hochkant wie quer.** Im Review verschob ein Halten mit Wisch genau auf einem abgerückten Griff den 17 px entfernten Punkt um 147 m – der Griff sah greifbar aus und nahm nichts an. Er ist jetzt gepunktet und ungefüllt, liegt über den Punkten und fängt nur seine eigenen 14 px ab; ein Tipp oder Halten meldet „Zum Einfügen heranzoomen“, ziehen lässt er nichts. Die Festlegung „der Punkt gewinnt in seiner Zone“ gilt weiter für alles um den Griff herum. Zwei deckungsgleiche Aufnahmen entstanden, weil die Sperre „Position wird noch ermittelt“ nur hält, solange die Ortung läuft. Ein zweiter Standortpunkt unter 3 m binnen 6 s wird jetzt mit „Gerade aufgenommen“ beantwortet; gemessen wird an den gespeicherten Punkten, damit „↶“ die sofortige Neuaufnahme freigibt, und der spätere Zwilling im Blatt bleibt für Ortungen ab 3 m Abstand. Hochkant bestätigte ein zweiter Tipp nach 450 bis 850 ms blind den Punkt, den die Liste unter dieselbe Fingerstelle gerollt hatte; die Tippsperre von 400 ms bleibt, denn eine längere bremste das rhythmische Weitertippen. Stattdessen zählt der Ort: derselbe Fleck (24 px) binnen 1,2 s nach einer Bestätigung auf einer anderen Zeile wird wie ein Fehltipp behandelt. Quer ist der Block „Als Datei sichern“ nicht im Bild, deshalb trägt der Merker in der Kopfzeile, der beim Tippen sichert, das Wort „Sichern“ – beim Speicherfehler und ab 80 % Belegung. Verworfen wurde eine eigene Zeile in der Bauleiste: Der Merker ist ohnehin in jeder Querhöhe im Bild.

**Der rote Speicherfehler ist in jeder Lage lesbar, und die Karte schärft sich nach einem Funkloch von selbst nach.** Der Erklärtext im Block erbte als „.klein“ das Grau der Nebentexte und stand nachts mit 2,7:1, bei Tag mit 1:1 auf Rot. Er erbt jetzt die Blockfarbe, das ✖ steht am ersten Satz statt allein in einer Zeile, und die Knopfgründe sind abgedunkelt statt aufgehellt (Schrift über 8:1). Zu Band und Block im Baumodus kommt keine Pille mehr, die neun Sekunden lang genau über „Zurückmelden“ und „Als Datei sichern“ lag. Dieselbe Tatsache wird überall gleich gezeichnet: „NICHT übernommen“ im Funkdialog und „übergeben mit durchgefallener Prüfung“ im Empfangsdialog sind rot mit ✖, nicht amber. Das Kartenband gab nach Ende der Nachladefolge auf, solange kein Zoomen kam. Jetzt versucht die erste geglückte Netzkachel sofort alle an der Frist gescheiterten Kacheln noch einmal (höchstens alle 10 s), und nach Aufgabe der Folge tut es jedes Ereignis (Ausschnitt geladen, Karte verschoben), höchstens einmal je 60 s. Die Leiste sagt „zoomen lädt neu“ selbst und nennt bei Netz und gröberen Kacheln „Karte langsam“ vor „nicht erreichbar“. Bei der Cloud hat ein offener Konflikt Vorrang in der Zeile (auch nach gescheiterter Entscheidung), die Pause nennt „wird in 1 min wiederholt“, und im Baumodus springt der Konfliktdialog nicht von selbst auf. Verworfen: die Pille bei Fehlern ganz zu streichen. Breit und in der Planung sind Kopf und Pille die einzigen Zeugen und bleiben deshalb.

## Verworfene Wege

**Eine eigene Leiste für den Ist-Setzmodus, oder die beiden abgeschalteten
Knöpfe mit Wirkung füllen.** Beides baute Bedienung nach, die es schon gibt:
der Kartentipp setzt den Punkt, ein falsch gesetzter wird über das Blatt neu
geortet, verschoben oder gelöscht, und Rückgängig steht in der Kopfzeile. Die
Leiste trägt deshalb im Setzmodus einen einzigen Griff.

**Die Meldungspille an die offene Punktkarte hängen.** Naheliegend, weil
`body.punktkarte-offen` schon besteht: die Pille rückt dann über das Blatt
statt darauf. Gemessen fällt sie damit bei 320×568 aus der Karte heraus und
steht über dem Speicherband – der Streifen über dem Blatt ist dort 16 px hoch,
die Pille 56. Die doppelte Meldung ganz wegzulassen löst denselben Fall ohne
ein neues Maß.

**Bezeichnung und Bemerkung hinter „Mehr …“.** Hätte die Höhe gebracht, die
der Deckel jetzt erzwingt – aber Benennen ist am Bauort die Hauptaufgabe und
nicht das Kleingedruckte. Gespart wird stattdessen an den Pillen: „✓ gebaut“
und die Uhrzeit sagten dem Trupp nichts, was er nicht wüsste. In der Liste
des Bau-Reiters stehen beide weiter, dort wird über Punkte gelesen, die man
nicht eben gesetzt hat.

**Die Zoomsteuerung ausblenden, damit das Kreuz rechts bleiben kann.** Mit
Handschuh ist sie der einzige brauchbare Zoom, und das Aufziehen mit zwei
Fingern ist genau das, was der Baumodus vermeiden soll.

**Dem Soll-Blatt ein zweites „Fertig“.** Es hat keine Aufnahme abzuschließen,
und ein zweiter Ausstieg kostet die Höhe, um die es hier geht. Das Kreuz
trägt seit dem Wechsel nach links seine vollen 44 px – das genügt.

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
6. Lichtbilder: Aufnahme am Punkt, Speicher, Rückweg. **Teilweise gebaut:**
   die Baudokumentation druckt die Bilder, die bis `BILD_KORRIDOR` (100 m)
   neben der geplanten oder gebauten Trasse aufgenommen wurden, als eigenen
   Nachweis samt Nummer an der Kartenmarke (`bilderAnStrecke()` in
   `js/baudoku.js`). Die Zuordnung läuft über den Ort, nicht über eine
   Verknüpfung – die Aufnahme am Punkt und der Rückweg stehen weiter aus.

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
| Bedienung am Telefon | die Karte: Bauleiste und Punktkarte; die Liste bleibt der Bogen |
| Was am Punkt steht | Art aus `PUNKTARTEN` samt „Sonstiges“, an der Querung die Bauweise; ein Tipp schreibt |
| Ohne Tipp | keine Art – „noch offen“ statt vorbelegtem Trassenpunkt (Schema 16) |
| Nach dem Absetzen | Vermerk mit Zeit, Weg und Abdruck im `bau`-Block; bleibt am Gerät |
| Wer meldet | Trupp und Truppführer im Gerätespeicher, als `von` in der Meldung |
| Der Plan im Baumodus | angetippt, nicht gezogen – ändern heißt umschalten |
| Rückgängig im Baumodus | hält an der Grenze zur Planung, nach Herkunft des Schritts |
| „Punkt hier“ am Planpunkt | genau ein offener Punkt unter 25 m wird sichtbar vorgeschlagen, sonst gefragt |
| Baumeldung ohne Text | gibt es nicht, angelegt wird mit dem ersten Zeichen |
| Was eine Baumeldung trägt | kennt das Gerät seinen Trupp, nur dessen Bauabschnitte |
| Prüfung beim Einspielen | je Stamm zusammengeführt, „durchgefallen“ gewinnt; dann keine Übergabe |
| Telefon quer | Schmalansicht: Liste oder Karte, Umschalter als Spalte links |
| Plan-Nr. | Rechenweise bleibt (gedruckte Blätter), Name und Satz unterscheiden sie vom Rückgabe-Code |
| Nachtragen vom Papier | eigener Zustand mit Baudatum vom Blatt, Herkunft „Papier“ (Schema 19) |
| Punkte ohne Abschnitt | gehören dem Trupp des Geräts; Altbestand wird gemeldet als offen, nie automatisch zugeordnet |
| Nachmessung | derselbe Trupp ersetzt seine Messung, ein anderer nur auf ausdrückliche Wahl des Planers |
| Zwei Trupps ohne Abschnitt | eigener Abschnitt ist vorbelegt, die erste Meldung wird rückwirkend Abschnitt |
| Rückgabe-Code | je Absender (`bau.gemeldetCodes`) |
| Abgeschriebene Zeile | trägt `nachtragTag` (Schema 20) |
| Quittung nach „Einspielen“ | erst nach gelungenem Speichern, als stehender Dialog „Dem Trupp durchgeben“ mit dem, was nicht übernommen wurde |
| Gerätetrupp und Abschnitt | ein Schritt für ↶ und ↷ |
| Frage nach dem Trupp | kommt wieder, ruht nach dem zweiten „Später“ und bleibt als Marke „Trupp wählen“ |
| Cloud-Anfrage | 45 s Frist, danach „ausstehend“ mit Uhrzeit des letzten sicheren Stands |
| Gröbere Kachel | wird nach dem Funkloch still nachgeholt, kein `redraw()` |
| Ausgefallenes Gerät | ist nicht überfällig: „Gerät ausgefallen – Papier“ |
| Aufgehobene Übergabe | steht an der Strecke, bis die Meldung gesehen ist |
| Nachmessung | gehört der Prüfzeile (`von`), nicht dem letzten Absender der Strecke |
| Funkformel nach „Einspielen“/„Verwerfen“ | geht nur mit „Schließen“ zu, nennt Verlust, Nicht-Übernommenes, Ausgelassenes, Rückfragen |
| Speicherfehler | eigene Form (✖, Rotfläche), nie als Normalfall; Rollback meldet `zurueckgenommen` |
| „Dieses Gerät gilt“ im Cloud-Konflikt | nur über Rückfrage mit beiden Ständen, keine Sicherungskopie |
| Ausfall länger als 180 min | „Papier nachfragen“ (Richtwert, keine Vorschrift) |
| Lagekarte ohne eigene Formatwahl | A4/A3/A1 nach Zahl der Strecken und Ausdehnung |
| Vermerk „Übergabe zurückgenommen“ | bleibt, bis die Strecke wieder übergeben ist; eine ältere Übergabe kehrt nie zurück |
| Abgewiesene Meldung | setzt weder „neu“ noch einen Verlaufsschritt, ihr Code ist gekennzeichnet |
| ↶ nach Einspielen | benennt Code und Absender jedes quittierten Schritts, mit stehendem Funkdialog |
| Geschützte Dialoge | legen einen Verlaufseintrag an; Zurück lässt sie stehen |
| Letzte Funkformel | je Strecke im Gerät gemerkt und wieder abrufbar |
| Abgerückter Einfügegriff | nimmt die Berührung selbst an und sagt „heranzoomen“ |
| Zweiter Punkt am selben Ort | unter 3 m binnen 6 s nicht aufgenommen |
| Kartenfehler nach dem Funkloch | gröbere Kacheln werden bei jedem Ereignis nachgeholt, höchstens alle 60 s |
| Lichtbilder | vertagt in Stufe 6 |

## Offen

- **Dichte Lagekarte in Schwarz-Weiß.** Mit 36 Strecken auf A4 quer bleibt eine
  Überdeckung (21/33): zwei Schilder stehen bis zu 3 px über dem unteren Rand.
  Die Schilder werden bei Platzmangel verkürzt, aber nicht weiter verschoben.

- **Klick-Filter an den Warnpillen des Summenbands** (welche Strecken sind
  gemeint) fehlen; die Schwere-Sortierung stellt sie ohnehin nach oben.

- **Die Speicher-Vorwarnung ab 80 %** steht oben in der Bau-Liste und ist unten
  nicht zu sehen; sie müsste an die Bau- oder Statusleiste.

- **Ein Trupp, der den Browser ganz schließt,** bekommt vom Ende eines
  Nachtrags nichts mehr gesagt (der Hinweis liegt im Sitzungsspeicher).

- **Moduswechsel bei 36 Strecken braucht 1,2 bis 2,5 s ohne Anzeige.**
  Gemessen im Headless-Chromium des Containers; am Telefon wird es länger
  sein. Eine Entlastung ohne Profil am Gerät wäre geraten.

- **Kopf, Ansichtsumschalter und Reiter belegen am 390er ein Viertel der
  Höhe.** Jedes Teil trägt Handschuhmaß; echte Abhilfe wäre, den Umschalter in
  die Rollfläche zu legen.

- **Kein Sprechzettel für die Meldung per Funk.** Schon mit vier Punkten hat
  der Link 384 Zeichen. Eine Zeile zum Ablesen (Strecke, Punkt n von m, Kabel
  in m, Abweichung, Code) fehlt im Rückmeldeblock.

- **„Alle gesehen“ gibt es nur je Einsatzabschnitt**, und das Merken liegt im
  Gerät, wie „gesehen“ selbst.

- **„gesehen“ und „S 6 erledigt“ gelten nur am Gerät.** Beides läge mit einem
  optionalen Feld im Datei-Export ohne Schemaänderung auf einem zweiten Gerät.
  Es sagt aber, was an diesem Platz gesehen wurde, und hakte dort Meldungen
  ab, die niemand gelesen hat. Ob die Führungsstelle einen gemeinsamen
  Bearbeitungsstand braucht – und dann als Teil der Planung mit Schema –,
  entscheidet der Planer.

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

- **Die Tooltips der Karte gibt es mit dem Finger nicht.** Linie, Zeichen,
  Fläche und Relais tragen ihre Angabe in einem `mouseover`-Tooltip; am
  Telefon erscheint keiner. Bei den Bildmarken ist der Fall gelöst
  (`js/bilder.js`, „Am Bauort gibt es kein Überfahren“), bei den Punkten im
  Baumodus über die Punktkarte; die übrigen vier brauchen dieselbe
  Entsprechung – und die Punkte im Planungsmodus ebenso.

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
