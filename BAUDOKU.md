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
angetippt wird, rechts, was geschrieben wird. An die Seite gelegt wäre es der
falsche Tausch: die schmale Spalte bricht die Chipreihe wieder um.

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
der Sprungstreifen trägt zwei Chips mehr: „Absetzen“ für den Rückmeldeblock,
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

**Der Bau-Reiter** hat einen Sprungstreifen (Punkte, Meldungen, Material,
Übergabe, Absetzen, Karte mitnehmen, ▤ Doku), und der Kachelvorrat steht am
Ende statt am Anfang: das Mitnehmen geschieht im Depot und nie am Bauort.

**Der Streifen steht VOR den Kennzahlen.** Dahinter lag seine zweite Reihe bei
390×690 in der Grundstellung des Reiters halb unter dem festliegenden
Umschalter Liste/Karte: sichtbar genug, um danach zu greifen, und ein Tipp
darauf traf den Umschalter und warf den Trupp auf die Karte – betroffen war
ausgerechnet „Absetzen“. Die Reihenfolge stimmt auch sachlich: erst wohin, dann
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

- **Quer bleibt die Chipreihe angeschnitten.** Kopfzeile und Blattkopf sind
  einreihig, der Inhalt steht zweispaltig – die erste Chipreihe reicht damit
  bis an die Abschlusszeile und ist mit einer kurzen Rollbewegung zu treffen,
  nicht ohne. Was wirklich fehlt, ist Höhe über der Karte: quer liegen
  Kopfzeile und Speicherband vor ihr. Der nächste Schritt wäre, die Kopfzeile
  im Baumodus auf Verlangen einzuklappen.

- **Die Werkzeugleiste der Planung deckt am Telefon quer ein Fünftel der
  Karte.** Im Baumodus ist das gelöst – dort ist sie ein Streifen –, in der
  Planung steht sie weiter zweireihig mit vier Zeichenwerkzeugen. Der Ausweg
  wäre derselbe Klappkopf, den die Kartenoptionen daneben schon haben.

- **Drei Löschgriffe ohne Rückfrage, 4 px neben einem Eingabefeld.**
  Bauabschnitt, Baumeldung und Prüfzeile löschen sofort. Der Rückweg ist
  „Rückgängig“ in der Kopfzeile – jetzt 44 px breit statt 31, aber weiterhin
  eine Kopfzeile weit weg von der Stelle, an der der Fehlgriff geschah. Ein
  Rückholhinweis in der Hinweisbox („Meldung gelöscht · Rückgängig“) wäre die
  Antwort, und die gehört zur Hinweisbox und nicht zum Bau-Reiter.

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
