# Planungen in einem eigenen Speicher ablegen

Wie eine Planung den Browser verlässt, ohne dass jemand einen Server dafür
betreiben muss – und warum das den Speicher im Gerät nicht ersetzt, sondern
überbaut. Dieses Papier hält die Entscheidung und ihre Begründung fest; was am
Quelltext zu beachten ist, steht in `CLAUDE.md`, die Zusage an den Nutzer in
`datenschutz.html`.

Stand September 2026: abgestimmt, noch nicht gebaut.

## Warum überhaupt

Heute liegt jede Planung im `localStorage` dieses einen Browsers, die
Lichtbilder daneben im Bildspeicher des Geräts. Das hält die Zusage ein, dass
nichts nach außen geht, hat aber drei Kanten:

- **Der Gerätewechsel fehlt.** Wer auf dem Rechner der Unterkunft plant und am
  Bauort das Tablet mitnimmt, muss die Planung von Hand als Datei mitnehmen.
- **Der Platz ist knapp.** Rund 5 MB je Website für den `localStorage`, und ein
  verkleinertes Lichtbild wiegt schon 200 kB.
- **Der Speicher ist nicht sicher.** Safari räumt `localStorage` und IndexedDB
  nach etwa sieben Tagen ohne Seitenaufruf ab. Eine Planung, die nur im Browser
  liegt, ist auf dem iPad nach zwei Wochen Pause weg. Das wiegt am schwersten –
  schwerer als der Gerätewechsel, um den es ursprünglich ging.

## Die Entscheidung

**Der Gerätespeicher bleibt die Wahrheit. Der angebundene Speicher ist die
Ebene darüber.**

Am Bauort ist kein Netz – und genau dort wird die Planung gebraucht und
fortgeschrieben. Eine Anbindung, die den `localStorage` ablöst, hätte die
Anwendung dort unbrauchbar gemacht, wo sie gebraucht wird. Deshalb wird nicht
der Speicher ausgetauscht, sondern ein Abgleich darübergelegt: gearbeitet wird
immer lokal, hochgeladen wird, wenn Netz da ist.

Daraus folgt, dass der eigentliche Aufwand nicht in der Anbindung der Anbieter
steckt, sondern im Abgleich – und dort vor allem in den Konflikten.

## Wie die Dateien liegen

```
fmbauplaner.app/
  Hochwasser Elbe 2026 (x7k3p9q)/
    planung.json
    bilder/
      x2m8f1a.jpg
      x9d4c2e.jpg
```

**Ein Ordner je Planung, die Lichtbilder einzeln daneben.** Nicht eine einzige
Datei mit eingebetteten Bildern, wie sie der Export erzeugt: die wüchse mit
jedem Lichtbild um ein Drittel mehr, als das Bild groß ist, und müsste bei
jeder Änderung eines Kommas vollständig neu übertragen werden. Über Mobilfunk
am Bauort ist das der Unterschied zwischen zwei Sekunden und zwei Minuten.

**Der Ordnername trägt den Namen für den Menschen und die Kennung für die
Maschine.** Wer seine Cloud aufräumt, soll erkennen, was da liegt. Benennt er
den Ordner dabei um, findet der Abgleich die Planung an der Kennung in
`planung.json` wieder – der Ordnername ist Beschriftung, nicht Schlüssel.

**`planung.json` ist dasselbe Format wie die Sicherungsdatei**, nur ohne die
eingebetteten Bilddaten. Damit gelten `SCHEMA` und `migrieren()` aus
`js/state.js` unverändert auch für das, was aus dem Speicher zurückkommt – und
das muss es, denn dort kann eine Datei liegen, die ein Gerät mit einer älteren
Fassung der Anwendung geschrieben hat.

## Konflikte

Zwei Geräte, beide offline, dieselbe Planung. Ohne Vorkehrung überschreibt der
Langsamere die Arbeit des anderen, und niemand merkt es.

**Jede Datei trägt eine Marke** – bei Dropbox die `rev`, bei S3 das ETag, im
lokalen Ordner Änderungszeit und Größe. Geschrieben wird nur gegen die Marke,
die zuletzt gesehen wurde: *überschreibe nur, wenn dort noch genau das liegt,
was ich kenne.* Stimmt sie nicht mehr, war ein zweites Gerät da.

Dann wird **nicht zusammengeführt**, sondern die zweite Fassung danebengelegt
und der Nutzer gefragt. Ein automatisches Verschmelzen zweier Trassenführungen
wäre nicht nachvollziehbar, und eine falsch verschmolzene Planung ist
schlimmer als zwei, zwischen denen jemand entscheidet.

## Was der Nutzer merkt

**Solange niemand eine Verbindung einrichtet, ändert sich nichts.** Kein Modul
eines Anbieters wird geladen, kein Byte geht nach außen. Die Rückseiten werden
erst beim Einrichten geholt – dasselbe Vorgehen wie beim HEIC-Entschlüsseler in
`js/heic.js`, der auch erst kommt, wenn wirklich eine HEIC-Datei ankommt.

**Bei der Einrichtung steht der Hinweis, nicht im Kleingedruckten.** Er nennt,
was übertragen wird (die Planung samt Koordinaten und Lichtbildern – also
möglicherweise Einsatzdaten), an wen, und dass die Entscheidung, ob dienstliche
Planungen dort liegen dürfen, beim Nutzer und seinem Ortsverband liegt. Dazu
der Rückweg: Verbindung trennen, Zugriff beim Anbieter widerrufen; das Löschen
der abgelegten Dateien bleibt Sache des Nutzers.

**`datenschutz.html` bekommt trotzdem einen eigenen Abschnitt.** Die Erklärung
muss beschreiben, was die Software kann, nicht nur, was sie gerade tut.
Abschnitt 3 („Deine Planungsdaten“) sagt heute etwas, das dann nicht mehr
uneingeschränkt gilt; Abschnitt 7 („Eigene Verantwortung beim Einsatz“) ist die
Stelle für den Hinweis auf die dienstliche Seite.

**Der Speicherrhythmus ändert sich.** `store.speichernVerzoegert()` schreibt
heute bei jeder Änderung; jeder Klick ein Upload geht nicht. Es braucht eine
Warteschlange und eine sichtbare Anzeige „gesichert / ausstehend / Fehler“.
Ohne diese Anzeige glaubt der Nutzer, es sei gesichert, und es ist es nicht.

## Die Anbieter

Nicht Anbieter für Anbieter gedacht, sondern **eine Schnittstelle mit
austauschbaren Rückseiten**: auflisten, lesen, schreiben, löschen, dazu die
Marke. Was darüber hinausgeht – Freigaben, Papierkorb, Versionen – bleibt Sache
des Anbieters und seiner eigenen Oberfläche.

In dieser Reihenfolge:

**1. Ordner auf diesem Gerät.** Der Nutzer wählt einen Ordner, die Anwendung
darf dauerhaft hineinschreiben. Zeigt er auf den Sync-Ordner eines
Cloud-Programms, sind iCloud Drive, OneDrive, Dropbox, Nextcloud und
Synology Drive damit miterledigt – ohne Konto, ohne Zugangsschlüssel, ohne dass
die Anwendung selbst etwas überträgt. Größter Nutzen je Aufwand. Nur in Chrome
und Edge, denn Firefox und Safari können es nicht.

**2. Dropbox.** Der geradlinigste echte Anbieter: Anmeldung mit PKCE ohne
Serveranteil, saubere REST-Schnittstelle, die sich ohne fremde Bibliothek
bedienen lässt.

**3. OneDrive (Microsoft Graph).** Vermutlich die größte Reichweite bei den
Windows-Rechnern der Helfer; private und dienstliche Konten in einem. Die
Registrierung ist kostenlos und ohne Prüfverfahren. Haken: bei Geschäftskonten
kann die Zustimmung beim Administrator liegen.

**4. Nextcloud und WebDAV.** Fachlich am nächsten an der Zielgruppe, technisch
am zickigsten: **Nextcloud sendet über WebDAV keine CORS-Kopfzeilen**, der
Browser bricht die Anfrage also ab, bevor sie ankommt. Bei einer selbst
betriebenen Instanz ist das zu lösen – Kopfzeilen im Webserver setzen oder die
Nextcloud-App *WebAppPassword* installieren –, bei einer fremden Instanz ist es
das Ende. Das gehört in den Einrichtungstext, nicht in eine Fehlermeldung.

**5. S3-kompatible Speicher** (MinIO, Hetzner, Wasabi, Backblaze B2). Technisch
der geradlinigste Weg von allen, CORS je Eimer einstellbar. Dafür liegt der
Zugangsschlüssel im Browser, und die Zahl der Nutzer, die einen Eimer
einrichten, ist klein.

**6. Google Drive**, zuletzt und mit Bedacht. Ohne Serveranteil gibt es kein
Refresh-Token, die Anmeldung läuft also stündlich ab. Dazu kommen
Zustimmungsbildschirm, Verifizierung und jährliche Pflege. Der Google-Picker
bliebe außen vor, weil er Code von `apis.google.com` nachlädt – die Anwendung
legt ihren Ordner ohnehin selbst an.

### Verworfen

- **iCloud Drive** unmittelbar – es gibt keine nutzbare öffentliche
  Schnittstelle für fremde Anwendungen. Über den lokalen Ordner geht es
  trotzdem.
- **MagentaCloud, Strato HiDrive, mailbox.org** – nur WebDAV, keine Anmeldung
  für fremde Anwendungen, und an den Kopfzeilen des Servers lässt sich nichts
  ändern.
- **MEGA, Tresorit** – die Ende-zu-Ende-Verschlüsselung macht die Anbindung
  aufwendig und den Gewinn klein.
- **Box, pCloud** – technisch unauffällig, treffen aber kaum einen Helfer.

## Offene Punkte

- Ob dienstliche Planungen des THW in einem privaten Cloudkonto liegen dürfen,
  ist keine technische Frage. Die Anwendung weist darauf hin und überlässt die
  Entscheidung dem Nutzer.
- Was geschieht, wenn jemand eine Planung im Speicher löscht, die auf dem Gerät
  noch offen ist – stiller Wiederaufbau oder Rückfrage.
- Ob eine Planung an mehrere Speicher zugleich gebunden sein darf. Vorerst
  nein: eine Verbindung, ein Ort.
