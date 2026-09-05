# Planungen per Link teilen

Wie eine Planung den Weg von einem Gerät zum anderen findet, ohne dass ein
Server sie je zu sehen bekommt. Dieses Papier hält die Entscheidung und ihre
Begründung fest; was am Quelltext zu beachten ist, steht in `CLAUDE.md`, die
Zusage an den Nutzer in `datenschutz.html`.

## Die Entscheidung

**Die Planung reist im Link selbst.**

```
https://fmbauplaner.app/#p1.eJyNVMtu2zAQ_JVFTgkgy3Ye…
```

Alles hinter dem `#` ist die gepackte Planung. Kein Server, kein Konto, kein
Dienst – das Hosting bleibt die dumme Dateiablage, die GitHub Pages ist.

Der tragende Grund: **das Fragment wird nie an einen Server geschickt.** Es
steht in keinem HTTP-Request, in keinem Zugriffsprotokoll bei GitHub, und es
taucht auch nicht im `Referer` auf, wenn die Seite anschließend Kartenkacheln
lädt – dort wird das Fragment spezifikationsgemäß abgeschnitten. Damit ist der
Weg der einzige, der die Zusage „Deine Planungen verlassen dein Gerät nicht“
nicht bricht.

## Was gemessen wurde

Nachgebaute Planungen realistischen Zuschnitts, gepackt wie unten beschrieben:

| Planung | als `.json` | im Link |
|---|---|---|
| 2 Strecken, 16 Punkte, 5 Zeichen | 5,5 kB | **~1 000 Zeichen** |
| 5 Strecken, 100 Punkte, 20 Zeichen, 5 Flächen | 26 kB | **~2 400 Zeichen** |
| 12 Strecken, 480 Punkte, 60 Zeichen, 20 Flächen | 110 kB | ~7 400 Zeichen |
| 25 Strecken, 1 500 Punkte, 150 Zeichen, 50 Flächen | 325 kB | ~20 000 Zeichen |

Der übliche Auftrag landet bei gut 2 000 Zeichen. Das trägt jeder Browser und
jeder Messenger.

**Delta-Koordinaten längs der Trasse wurden mitgemessen und verworfen:** sie
machen das Ergebnis um 0,5 % *größer*. Deflate erkennt die Muster bereits. Wer
die Idee später wieder aufgreifen will, hat sie hiermit schon geprüft.

## Der Transportcodec

Zwei Schritte, in `js/teilen.js`:

**1. Entrümpeln.** Jeder Wert, der der Vorgabe aus `neueStrecke()`,
`neuerPunkt()`, `neuesZeichen()`, `neueFlaeche()` entspricht, fällt weg und
wird beim Empfänger aus derselben Vorgabe wieder aufgefüllt. Koordinaten auf
sechs Nachkommastellen – 11 cm, weit unterhalb dessen, was ein Handempfänger
hergibt. Das allein bringt Faktor 4 bis 5.

Kennungen von Punkten, Strecken, Zeichen und Flächen reisen **nicht** mit; sie
werden beim Empfänger neu vergeben. Quer referenziert werden nur
`abschnitt`, `gruppe` und `verbund` – diese drei behalten eine Kennung, kurz
durchnumeriert.

**2. Packen** mit `CompressionStream('deflate-raw')`, dann base64url. Keine
neue Abhängigkeit: die Gegenrichtung steckt seit dem KMZ-Import in
`js/kml.js`. Fehlt die Schnittstelle (Safari vor 16.4, Firefox vor 113), gibt
es keinen Link, sondern den Hinweis auf die Datei – wie beim KMZ.

**Kein zweites Format.** Im Link steht die normale, schemaversionierte Planung,
nur durch einen rein mechanischen Codec geschickt. `migrieren()` läuft beim
Empfänger wie bei einer Datei, alte Links werden also mit dem Schema
mitgezogen. Eine zweite Datenbeschreibung, die man bei jeder Schemaänderung
nachpflegen müsste, gibt es bewusst nicht.

## Was mitreist – und was nicht

Alles außer den **Lichtbildern**. Ein verkleinertes Bild wiegt rund 200 kB,
kodiert das 1,4-fache: ein einziges Bild machte den Link zehnmal größer als
die ganze übrige Planung. Ortsangabe, Beschriftung und Aufnahmezeitpunkt der
Bilder können mitgehen, die Bilddaten nicht. Der Dialog sagt das im Klartext –
für Bilder bleibt die Datei der Weg.

## Drei Arten von Link

- **Ganze Planung** – der Normalfall.
- **Einsatzabschnitt** – der eigentlich nützlichste: der Zugführer schickt
  jedem Truppführer dessen Abschnitt, kürzer und ohne fremde Baustellen. Der
  Zuschnitt steht in `abschnittAlsProjekt()` – aus `abschnittExportieren()`
  herausgelöst, damit Datei und Link denselben Weg nehmen.
- **Nur der Kartenausschnitt** – Lage, Zoom, Basiskarte, rund 50 Zeichen.
  „Schau dir mal die Stelle an“, ohne jede Planungsangabe.

## Der Weg beim Empfänger

Ein Link darf nichts überschreiben. Vor dem ersten Zugriff auf den Bestand
erscheint ein Dialog – Name, Umfang, Stand – mit zwei Wegen: **Übernehmen**
(als *neue* Planung mit neuer Kennung und `herkunft`-Block, wie ihn der
Abschnittsexport schon schreibt) und **Verwerfen**.

Ein drittes „Nur ansehen“ stand im ersten Entwurf und ist beim Bauen gefallen:
Die Anwendung speichert bei jeder Änderung selbsttätig, ein bloßes Ansehen
wäre also spätestens beim ersten Klick doch eine gespeicherte Planung. Ein
Knopf, der etwas verspricht, was der Speicherweg gleich wieder einsammelt,
ist schlechter als keiner – wer die Planung nicht behalten will, löscht sie
über die Planungsliste.

Danach räumt `history.replaceState` das Fragment aus der Adresszeile. Das ist
nicht Kosmetik: eine Adresse mit Planung darin stünde sonst im Browserverlauf –
und ein Browser mit Verlaufssynchronisierung trüge sie zu seinem Hersteller.

## Die Kehrseite

Die Anwendung überträgt nichts. Aber sie stellt zum ersten Mal etwas her, das
der Nutzer selbst überträgt, und der Weg dorthin führt durch einen Messenger
oder ein Postfach. Dort liegt die Planung dann. Das gehört in `datenschutz.html`
und in den Teilen-Dialog, offen und ohne Beschönigung.

Zwei Festlegungen folgen daraus:

- **Kein URL-Kürzer, niemals.** Ein Kürzungsdienst bekäme die vollständige
  Planung zu sehen – genau der Bruch, den das ganze Verfahren vermeidet.
- **Längenampel im Dialog.** Mailprogramme brechen lange Links um, dann kommt
  der Link kaputt an. Unter 2 000 Zeichen unbedenklich, bis 8 000 mit Hinweis,
  darüber der Rat, einen einzelnen Abschnitt oder die Datei zu schicken.

Und eine Grenze, die bleibt: **ein Link ist eine Momentaufnahme, kein
gemeinsames Dokument.** Ändert der Absender etwas, schickt er einen neuen Link.
Gemeinsames Arbeiten in Echtzeit ist ohne Server nicht zu haben – die
Oberfläche darf es nicht suggerieren.

## Verworfene Wege

**Gist, Pastebin, Cloud-Ablage, eigener Server.** Alle lösen die Länge und
erlaubten Aktualisierung, alle brechen „kein Server, kein Konto“ und verlangen
Schlüssel oder Anmeldung. Für ein Werkzeug, dessen Kern das Versprechen ist,
dass die Planung auf dem Gerät bleibt, ist der Preis zu hoch.

**QR-Code** ist nicht verworfen, sondern vertagt. Gemessen: die kleine Planung
passt in QR-Version 20, die mittlere in Version 35 (177 × 177 Module, gerade
noch abzulesen), die große passt nicht mehr. Er kostet einen QR-Erzeuger und
damit entweder Fremdcode unter `vendor/` samt Eintrag in `LIZENZEN.md` oder
rund 400 Zeilen Reed-Solomon von Hand. Entschieden wird das, wenn die Grundlage
steht und sichtbar ist, wie lang die Links in echten Planungen werden.

## Umsetzung in Stufen

1. `js/teilen.js` mit Codec, Linkbau und Linklesung; Auswertung beim Start;
   Teilen-Dialog und Übernahme-Dialog.
2. Abschnitts-Link, Kartenausschnitt-Link, Längenampel; Abschnitt in
   `datenschutz.html`, Ergänzung in `README.md`.
3. QR-Code – offen, siehe oben.

## Getroffene Festlegungen

| Frage | Entscheidung |
|---|---|
| Ablage der Daten | im URL-Fragment, nirgends sonst |
| Empfang | Dialog vor dem Zugriff, zwei Knöpfe: Übernehmen oder Verwerfen |
| Lichtbilder | reisen nicht mit |
| Verschlusssachengrad | keine Sonderbehandlung im Dialog |
| QR-Code | vertagt |
| URL-Kürzer | ausgeschlossen |
