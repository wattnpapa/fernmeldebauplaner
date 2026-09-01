# FMBauplaner

**[fmbauplaner.app](https://fmbauplaner.app)**

GIS-Planungswerkzeug für den **Fernmeldebau**, ausgelegt auf die Arbeitsweise des THW.
Strecken werden auf der Karte geplant, die Längen stehen direkt an der Trasse, und
für jede Strecke lässt sich ein druckfertiger **Bauauftrag** für den Fernmeldebautrupp
ausgeben – A4 oder A3, hoch oder quer, in Farbe oder Schwarz-Weiß. Für die
Führungsstelle gibt es dieselbe Lage als **Lagekarte** auf einem einzelnen Blatt
bis A0 oder in freiem Maß.

Die Anwendung läuft vollständig im Browser. Es gibt keinen Server, keine Anmeldung
und kein Benutzerkonto: alle Planungen liegen im lokalen Speicher des Browsers und
verlassen das Gerät nicht. Nach außen gehen nur die Kartenkacheln, die der Browser bei
den Kartenanbietern abruft, und ein anonymer Zählimpuls beim Start – siehe
[Datenschutz](#datenschutz).

---

## Funktionsumfang

**Strecken planen**
- Beliebig viele benannte Strecken, jede mit eigener Farbe
- Teillängen an jedem Abschnitt und Name samt Gesamtlänge an der Strecke – dauerhaft sichtbar
- Punktarten: Anfangspunkt, Trassenpunkt, Muffe, Verteiler, Querung, Mast, Kabelreserve, Endpunkt
- Punkte verschieben, Zwischenpunkte über Griffe einfügen, Richtung umkehren
- Leitungsart (Feldkabel, Feldfernkabel, LWL, Netzwerk, Koax, Strom), Verlegeart,
  Bauzuschlag, Trommellänge und Verlegeleistung je Strecke

**Einsatzabschnitte** (freiwillig)
- Strecken und taktische Zeichen zu benannten Einsatzabschnitten mit Leitung und
  eigener Farbe zusammenfassen
- Nicht zugeteilte Zeichen gehören allen: sie erscheinen in jedem Abschnitt, auf
  dessen Karten und in dessen Datei – das gemeinsame Lagebild bleibt überall stehen
- Ganze Abschnitte auf der Karte ein- und ausblenden; der Schalter jedes einzelnen
  Elements bleibt davon unberührt
- Einen Abschnitt als eigene Planungsdatei sichern: der Empfänger lädt nur seinen
  Ausschnitt und arbeitet darin weiter
- Auflösen entfernt nur die Gliederung – Strecken und Zeichen bleiben erhalten

**Rechengrößen**
- Trassenlänge als geodätische Direktstrecke (Vincenty auf WGS84) zwischen den Punkten
- Kabelbedarf = Trassenlänge + Bauzuschlag
- Anzahl benötigter Trommeln, Muffen, Querungen und ein Richtwert für die Bauzeit
- Bei Stromleitungen: Leiterquerschnitt aus angeschlossener Last (kW oder A), Netzform
  (230 V 1~, 400 V 3~, 24 V, 12 V), Leistungsfaktor und zulässigem Spannungsfall

**Taktische Zeichen**
- 894 Zeichen aus der Sammlung [jonas-koeritz/Taktische-Zeichen](https://github.com/jonas-koeritz/Taktische-Zeichen)
  in 36 Kategorien — darunter 108 allein für das Fernmeldewesen: Feldkabel, Kabelbau,
  Richtfunk, Fernsprechvermittlungen, die FuG-Reihe, Netztechnik
- Auswahl nach Kategorie oder über die Suche im gesamten Bestand
- Drehung, Größe und freie Beschriftung je Zeichen
- SVG: scharf in jeder Zoomstufe; für den Schwarz-Weiß-Druck bringt die Sammlung
  eine eigene Druckfassung mit

**Bilder vom Bauort**
- Lichtbilder vom Telefon setzen sich an ihren Aufnahmeort: Ortsangabe, Aufnahmezeit
  und Blickrichtung kommen aus dem EXIF-Block der Datei
- Auf der Karte ein kleiner Punkt; beim Überfahren geht die Aufnahme auf, ein Klick
  zeigt sie groß
- Auswählen über den Reiter „Bilder“ – am Telefon öffnet das unmittelbar die
  Fotoauswahl – oder aus einem Ordner auf die Karte ziehen
- **HEIC** wird gelesen, auch aus dem Dateisystem eines Rechners: dafür liegt
  libheif als WebAssembly unter `vendor/libheif/` und wird nachgeladen, sobald
  eine HEIC-Datei ankommt (siehe `LIZENZEN.md`)
- Bilder ohne Ortsangabe der Kamera bleiben erhalten und lassen sich von Hand auf
  der Karte setzen
- Ein von der Kamera aufgezeichneter Ort ist gegen Verschieben gesichert – er ist
  eine Messung; geändert wird er nur ausdrücklich über „Ort von Hand setzen“.
  Von Hand gesetzte Orte lassen sich auf der Karte weiter verschieben
- Blickrichtung der Aufnahme als kleine Spitze am Kartenpunkt, wenn die Kamera
  sie mitgeschrieben hat
- Beim Hinzufügen auf die lange Kante 1600 px gebracht und im Bildspeicher des
  Browsers (IndexedDB) abgelegt, nicht im `localStorage` – die Sicherungsdatei
  nimmt sie mit auf
- Nicht Bestandteil von Bauauftrag, Lagekarte, GeoJSON, GPX und KML

**Zeichengruppen** (freiwillig)
- Taktische Zeichen zu benannten Gruppen mit eigener Farbe zusammenfassen –
  „Gefahrenstellen“, „Kräfte“, „Fernmeldemittel“
- Ganze Gruppen auf der Karte und im Bauauftrag ein- und ausblenden; der Schalter
  jedes einzelnen Zeichens bleibt davon unberührt
- Sie liegen quer zum Einsatzabschnitt: der sagt, wer zuständig ist, die Gruppe,
  was zusammengehört – ein Zeichen kann beides tragen
- Im KML-Export wird jede Gruppe ein eigener Ordner, in Google Earth ebenso schaltbar
- Auflösen entfernt nur die Gliederung – die Zeichen bleiben erhalten

**Koordinaten in MGRS und GPS**
- Laufende Anzeige von MGRS und GPS unter der Karte
- Je Punkt abrufbar: MGRS (1 m und 10 m), UTM, Grad/Dezimalminuten, Grad/Minuten/Sekunden,
  Dezimalgrad – zum Kopieren
- Eingabefeld erkennt alle diese Formate und springt die Koordinate an
- Zuschaltbares UTM-Kilometergitter (UTMREF/MGRS) mit Randzahlen – auf der
  Arbeitskarte wie auf dem gedruckten Bauauftrag; Maschenweite je nach Maßstab
  100 m bis 100 km, 100-km-Quadrat und Weite stehen in der Kartenecke

**Bauauftrag als PDF**
- Blatt 1: Kopf- und Stammdaten, Karte mit hervorgehobener Trasse, Nordpfeil,
  Maßstabsleiste mit Maßstabsangabe, Übersichtskarte, Zeichenerklärung, Kennzahlenband
- Blatt 2: Punkttabelle mit MGRS, GPS, Teilstrecke, Summe und Richtung;
  Materialbedarf; Auftragstext; Unterschriftenfelder
- A4/A3, hoch/quer, Farbe oder Schwarz-Weiß; im S/W-Druck unterscheiden Strichmuster
  statt Farben, die Karte wird auf die amtliche Graustufenkarte umgestellt
- Die Druckkarte wird in doppelter Auflösung gerendert (≈ 190 dpi statt 96 dpi)

**Sammel-Bauauftrag als PDF**
- Ein Dokument über alle Strecken eines Einsatzabschnitts oder der ganzen Planung
- Deckblatt mit Übersichtskarte über alle Strecken, Zeichenerklärung und Summenband
- Streckenverzeichnis mit einer Zeile je Strecke, bei der ganzen Planung nach
  Einsatzabschnitten gegliedert samt Teilsummen; dazu der Materialbedarf nach Leitungsarten
- Danach je Strecke die gewohnten Blätter; welche Blattarten entstehen, ist wählbar

**Lagekarte als PDF**
- Ein einzelnes Blatt für die Führungsstelle, auf dem die Karte fast alles ist:
  alle Strecken mit Namen und Länge, die taktischen Zeichen, das Koordinatengitter
- **A4 bis A0** und ein freies Maß von 100 bis 1200 mm je Kante – für Plotterrollen
- Schrift, Kartenbeschriftung und Strichstärken wachsen mit dem Blatt: eine A0-Karte
  wird an der Wand aus zwei Metern gelesen, nicht in der Hand aus vierzig Zentimetern
- Am Rand Titelzeile, Kopfdaten, Zeichenerklärung, Kennzahlen und Fußzeile – jeder
  Streifen einzeln abschaltbar; alle fünf aus ergibt das nackte Kartenblatt. Auch
  die Streckenbeschriftung lässt sich von der Karte nehmen, wenn nur die Lage zählt
- Zwei Angaben bleiben: die Einstufung, die auf jedes Blatt gehört, und die Nennung
  der Kartengrundlage – ohne Fußzeile rückt sie in die Kartenecke, weil
  `dl-de/by-2-0` und ODbL sie verlangen
- Für die ganze Planung oder einen Einsatzabschnitt; sie darf auch aus taktischen
  Zeichen allein bestehen, wenn die Trassen erst noch geplant werden
- Die Auflösung der Druckkarte richtet sich nach dem Format: bei A4 und A3 bleibt es
  bei der doppelten (≈ 190 dpi), auf A0 werden es gut 100 dpi – mehr zeichnet kein
  Browser mehr in einem Bild

**Austausch mit anderen Werkzeugen**
- Planung als `.json` sichern und laden
- KML und KMZ aus Google Earth laden: Pfade werden Strecken, Ortsmarken taktische Zeichen
- Zurück nach Google Earth als KML (ganze Planung oder eine Strecke), gegliedert
  nach Einsatzabschnitten
- GeoJSON (auch je Strecke), GPX für Hand-GPS-Geräte, CSV-Punktliste für Excel

**Kartengrundlagen**
TopPlusOpen des BKG (farbig, grau, hell), OpenStreetMap, OpenTopoMap, Luftbild.

---

## Bedienung

| Taste | Wirkung |
|---|---|
| `S` | Neue Strecke zeichnen |
| `T` | Taktisches Zeichen setzen |
| `K` | Koordinate anspringen |
| `Enter` | Zeichnen abschließen |
| `Rücktaste` | Letzten Punkt zurücknehmen |
| `Esc` | Abbrechen / Dialog schließen |
| `Strg`+`Z` | Rückgängig |
| `Strg`+`Umschalt`+`Z` | Wiederholen |
| `Strg`+`S` | Speichern |
| `Strg`+`P` | Bauauftrag der gewählten Strecke |

**Strecke zeichnen:** „Neue Strecke zeichnen“ wählen, dann die Trasse Punkt für Punkt
anklicken, mit Doppelklick oder `Enter` abschließen. Punkte lassen sich anschließend
verschieben; die gestrichelten Griffe zwischen zwei Punkten fügen beim Ziehen einen
Zwischenpunkt ein.

**Einsatzabschnitte:** Im Reiter „Strecken“ über „+ Einsatzabschnitt“ einen anlegen.
Die Zuteilung steht in jeder geöffneten Strecke, in jedem geöffneten taktischen Zeichen
und gesammelt im Abschnitt selbst (Knopf `⋯` an der Abschnittszeile); dort liegen auch
Sammel-Bauauftrag und Teilexport. Das Auge an der Abschnittszeile blendet alle seine
Strecken und Zeichen zusammen aus.

**Zeichengruppen:** Im Reiter „Taktische Zeichen“ über „+ Zeichengruppe“ eine anlegen.
Die Zuteilung steht in jedem geöffneten Zeichen und gesammelt in der Gruppe selbst
(Knopf `⋯` an der Gruppenzeile). Das Auge an der Gruppenzeile nimmt alle ihre Zeichen
von der Karte und aus dem Bauauftrag. Bestehen Gruppen und Einsatzabschnitte, wählt
„Gliedern nach“ über der Liste, welche der beiden sie zeigt.

**Aus Google Earth übernehmen:** Dort die Vorplanung als Datei sichern – in Google Earth
Pro über „Ort speichern unter …“ am Ordner oder Pfad, in Google Earth im Browser über
„Als KML-Datei exportieren“ –, hier **Datei → Planung oder KML laden**. Jeder Pfad wird
eine Strecke mit Anfangs- und Endpunkt, jede Ortsmarke ein taktisches Zeichen („Stelle“,
in der Zeichenliste austauschbar). Name, Beschreibung und die Linienfarbe kommen mit;
Höhen, Zeitstempel und Bildüberlagerungen bleiben außen vor. Das Geladene tritt zur
geöffneten Planung hinzu, `Strg`+`Z` nimmt es wieder zurück.

**Nach Google Earth zurückgeben:** **Datei → Alles als KML (Google Earth)**, für eine
einzelne Trasse der Knopf „KML“ in der geöffneten Strecke unter „Daten für andere
Programme“. Jede Strecke wird ein Pfad in ihrer Farbe, dazu Ortsmarken für Anfang, Ende
und jede bauliche Besonderheit – reine Stützpunkte der Linie bleiben weg, sonst stünde
ein Nadelwald über der Trasse. Kabelart, Trassenlänge, Bedarf und Trommeln stehen in der
Sprechblase des Pfades. Die Einsatzabschnitte werden Ordner, ein ausgeblendeter Abschnitt
kommt ausgeschaltet an. Taktische Zeichen werden Ortsmarken mit ihrem Namen; ihr Bild
bleibt im Planer, Google Earth kennt die THW-Zeichen nicht.

**Bauauftrag drucken:** Strecke in der Seitenleiste öffnen → „Bauauftrag (PDF)“.
Format und Farbe einstellen, dann „Drucken / Als PDF speichern“. Im Druckdialog des
Browsers dasselbe Papierformat wählen und die Ränder auf „Standard“ oder „Keine“ lassen –
das Blatt bringt seine Ränder selbst mit.

**Sammel-Bauauftrag:** Für einen Einsatzabschnitt über dessen `⋯`, für die ganze Planung
über „Sammel-PDF (alle Strecken)“ im Reiter „Strecken“ oder über das Menü „Datei“.

**Lagekarte drucken:** „Lagekarte (PDF)“ im Reiter „Strecken“, im Menü „Datei“ oder für
einen Einsatzabschnitt über dessen `⋯`. Format bis A0 oder ein freies Maß in Millimetern
wählen, dann „Drucken / Als PDF speichern“. Formate über A3 kennt kein Druckdialog von
sich aus: dort ein eigenes Papierformat mit den Kantenlängen anlegen, die der Hinweis am
Druckknopf nennt. In aller Regel wird die Lagekarte als PDF gespeichert und beim Plotter
ausgegeben. Große Blätter ziehen mehrere hundert Kartenkacheln – der Aufbau dauert
entsprechend, und wenn der Kartendienst dabei einzelne Kacheln abweist, hilft ein
erneutes Umschalten des Formats.

---

## Veröffentlichen auf GitHub Pages

Die Anwendung ist eine reine statische Seite ohne Build-Schritt. Alle Pfade sind relativ,
sie funktioniert deshalb auch in einem Unterverzeichnis wie
`https://<benutzer>.github.io/fernmeldebauplaner/`.

```bash
git init -b main
git add .
git commit -m "Fernmeldebauplaner"
git remote add origin git@github.com:<benutzer>/fernmeldebauplaner.git
git push -u origin main
```

Danach im Repository unter **Settings → Pages** als Quelle **GitHub Actions** wählen.
Der mitgelieferte Workflow `.github/workflows/release.yml` veröffentlicht bei jedem Push
auf `main`.

### Versionen

Jede Veröffentlichung bekommt eine Nummer im Format **`YYYY.MMDD.HHMM`** in UTC – etwa
`2026.829.1119` für den 29. August 2026 um 11:19 Uhr. Sie ist minutengenau, steigt über
Tages- und Jahresgrenzen hinweg monoton und ist zugleich gültiges SemVer. Dieselbe Nummer
trägt der Git-Tag und das GitHub-Release; sie steht neben der Wortmarke in der Kopfzeile,
im Blattfuß jedes gedruckten Bauauftrags und unter **Planung → Über FMBauplaner**. Eine
Rückfrage zu einem Ausdruck lässt sich damit einem Stand zuordnen. Auf schmalen Geräten
weicht die Nummer aus der Kopfzeile – dort geht der Name der Planung vor –, die beiden
anderen Stellen bleiben.

Erzeugt wird die Nummer im Workflow. `js/version.js` trägt im Repository bewusst
`Entwicklungsstand`; erst beim Veröffentlichen wird die Zeile ersetzt – zurückgeschrieben
wird nichts. Wer den Quelltext auscheckt und lokal ausliefert, sieht deshalb
`Entwicklungsstand` statt einer erfundenen Nummer.

### Eigene Domain

Die Datei `CNAME` im Wurzelverzeichnis hält die Domain `fmbauplaner.app`. Dazu gehören
im DNS des Domainanbieters vier A- und vier AAAA-Einträge auf die GitHub-Pages-Adressen
(siehe `DNS.md`). Weil `.app` eine HSTS-Preload-Domain ist, funktioniert die Seite
ausschließlich über HTTPS – GitHub stellt das Zertifikat automatisch aus, sobald die
DNS-Einträge aufgelöst werden.

Alternativ ohne Actions: unter **Settings → Pages** die Quelle **Deploy from a branch**
mit Branch `main` und Ordner `/ (root)` wählen. Die Datei `.nojekyll` sorgt dafür,
dass GitHub die Dateien unverändert ausliefert. Auf diesem Weg entstehen allerdings
weder Version noch Tag noch Release – die Seite weist sich dann als
`Entwicklungsstand` aus, und in der Sitemap gelten die im Repository
eingetragenen Änderungsdaten statt der aus der Git-Historie ermittelten.

### Lokal ausprobieren

Wegen der ES-Module muss die Seite über HTTP ausgeliefert werden – ein Doppelklick auf
`index.html` genügt nicht.

```bash
python3 -m http.server 8899
```

Dann `http://localhost:8899` öffnen.

---

## Aufbau

```
CNAME                 Domain für GitHub Pages
robots.txt            Freigabe für Suchmaschinen, Verweis auf die Sitemap
sitemap.xml           Die vier Adressen der Seite (lastmod setzt der Workflow)
index.html            Grundgerüst der Oberfläche
autor/index.html      Über den Autor (statische Seite)
impressum.html        Anbieterkennzeichnung nach § 5 DDG
datenschutz.html      Datenschutzerklärung
css/app.css           Oberfläche
css/print.css         Bauauftrag und Lagekarte: Vorschau und Ausdruck
css/seite.css         Statische Seiten außerhalb der Anwendung
js/app.js             Zusammenbau, Bedienung, Tastatur
js/state.js           Datenmodell, Projektverwaltung, LocalStorage, Undo
js/geo.js             Entfernungen (Vincenty), MGRS/UTM/GPS, Eingabe-Parser
js/strom.js           Querschnitt von Stromleitungen aus Last und Länge
js/map.js             Leaflet-Karte und Basiskarten
js/gitter.js          UTM-Kilometergitter (UTMREF/MGRS) auf Karte und Bauauftrag
js/strecken.js        Strecken zeichnen, bearbeiten, beschriften
js/symbols.js         Taktische Zeichen: Auswahl und SVG-Ausgabe
js/zeichen-daten.js   Die Zeichen selbst (erzeugt, nicht von Hand ändern)
js/zeichen.js         Taktische Zeichen auf der Karte
js/bilder.js          Lichtbilder aufnehmen, verkleinern, auf der Karte zeigen
js/heic.js            HEIC entschlüsseln (lädt vendor/libheif bei Bedarf nach)
js/bildspeicher.js    Bilddaten im Gerätespeicher (IndexedDB)
js/exif.js            Ort, Aufnahmezeit und Blickrichtung aus dem Lichtbild
js/bauauftrag.js      Druckdokumente: Bauauftrag und Lagekarte
js/ui.js              Seitenleiste, Formulare, Dialoge
js/io.js              Sichern und Laden, GeoJSON, GPX, CSV, KML
js/kml.js             KML und KMZ mit Google Earth austauschen
js/version.js         Stand der Anwendung (beim Veröffentlichen gesetzt)
bilder/               Bilder der statischen Seiten
fonts/                Roboto Slab Bold, die Beschriftungsschrift der Zeichen
scripts/              Zeichen holen und prüfen (siehe unten)
vendor/               Leaflet 1.9.4, mgrs 2.1.0, libheif 1.19.8 (siehe LIZENZEN.md)
LICENSE               EUPL-1.2
```

Der Datenbestand liegt unter dem LocalStorage-Schlüssel `fbp.projekte.v1`, das zuletzt
geöffnete Projekt unter `fbp.aktiv.v1`. `js/state.js` hebt ältere Dateien beim Laden
über `migrieren()` auf das aktuelle Schema.

Die Bilddaten liegen als einziger Bestand außerhalb: in der IndexedDB-Datenbank
`fbp.bilder`, im Projekt steht zu jedem Bild nur der Eintrag mit Ort, Zeit und Maßen.
Der Grund steht im Kopf von `js/bildspeicher.js` – ein Lichtbild sprengt das
5-MB-Kontingent des `localStorage`, und der Undo-Stapel legt bis zu 60 Abzüge der
Planung ab. Bilddaten ohne Planung räumt der nächste Start weg.

### Taktische Zeichen auffrischen

`js/zeichen-daten.js` und `fonts/roboto-slab-bold.woff` werden nicht von Hand
gepflegt, sondern aus dem Release-Archiv der Sammlung erzeugt:

```bash
python3 scripts/taktische-zeichen-holen.py
```

Ohne Argument wird die im Skript festgeschriebene Version geholt, mit Argument
eine bestimmte (`python3 scripts/taktische-zeichen-holen.py v2.1.0`). Danach
prüfen, ob der Bestand vollständig ist und sich jedes Zeichen rendern lässt:

```bash
node scripts/zeichen-pruefen.mjs
```

`.github/workflows/taktische-zeichen.yml` erledigt beides montags von selbst,
committet nur bei grüner Prüfung und stößt anschließend ein Release an.

---

## Hinweise zur Genauigkeit

Die Längen sind **geodätische Direktstrecken zwischen den gesetzten Trassenpunkten**,
nicht die tatsächliche Kabellänge im Gelände. Geländeverlauf, Umgehungen, Reserven an
Muffen und Endverzweigern deckt der **Bauzuschlag** ab (Vorgabe 15 %, bei LWL 20 %).
Wer genauer plant, setzt mehr Trassenpunkte. Der Richtwert für die Bauzeit ist eine
grobe Planungsgröße aus Bedarfslänge geteilt durch die eingestellte Verlegeleistung.

Der **Leiterquerschnitt** von Stromleitungen ist ein Planungsrichtwert: gerechnet für
Kupfer über die Leitungslänge einschließlich Bauzuschlag, maßgebend ist der zulässige
Spannungsfall oder die Strombelastbarkeit – je nachdem, was den größeren Querschnitt
verlangt. Die Belastbarkeit gilt für drei belastete Adern frei in Luft bei 30 °C;
aufgerollte Leitungsroller tragen deutlich weniger. Die verbindliche Auslegung und die
Prüfung der Anlage obliegen einer Elektrofachkraft.

Die taktischen Zeichen stammen aus der Sammlung jonas-koeritz/Taktische-Zeichen
(Release-Exporte unter CC0-1.0). Für förmliche Lagedarstellungen ist die jeweils
gültige Dienstvorschrift maßgeblich.

---

## Datenschutz

Planungsdaten bleiben auf dem Gerät: Sie liegen im `localStorage` des Browsers
(`fbp.projekte.v1`, `fbp.aktiv.v1`, `fbp.dateisicherung.v1`, `fbp.druck.v1`), die
Lichtbilder in der IndexedDB-Datenbank `fbp.bilder`. Nichts davon wird übertragen –
auch nicht der Aufnahmeort in den Bildern. Es gibt keinen Server, kein Konto und keine
Cookies.

Zwei Verbindungen gehen trotzdem nach außen, beide ohne Planungsinhalte:

- **Kartenkacheln** holt der Browser unmittelbar bei den Anbietern (BKG, OpenStreetMap,
  OpenTopoMap, Esri). Sie sehen dabei IP-Adresse und angeforderten Kartenausschnitt –
  also die Gegend, in der geplant wird. Voreingestellt sind die Ebenen des BKG; das
  Luftbild von Esri (USA) wird nur auf ausdrückliche Auswahl geladen.
- **Reichweitenmessung** mit [GoatCounter](https://www.goatcounter.com/): ein anonymer
  Zählimpuls beim Aufruf der Anwendung, ohne Cookie und ohne geräteübergreifende
  Kennung. Widerspruch über *Nicht mitzählen* auf `datenschutz.html`; das setzt
  `skipgc` im `localStorage`, worauf GoatCounter nicht mehr zählt.

Der vollständige Text steht in [`datenschutz.html`](datenschutz.html), die
Anbieterkennzeichnung in [`impressum.html`](impressum.html). Beide sind in der
Anwendung über **Datei → Impressum / Datenschutz** erreichbar.

---

## Lizenz

```
Copyright © 2026 Johannes Rudolph
Licensed under the EUPL
```

FMBauplaner steht unter der **[European Union Public Licence v. 1.2](LICENSE)**
(EUPL-1.2) – der Lizenz, die die EU-Kommission für Software der öffentlichen Verwaltung
vorsieht und die in allen Amtssprachen gleichermaßen verbindlich ist. Sie erlaubt
Nutzung, Weitergabe und Veränderung und verlangt, dass abgeleitete Werke bei Weitergabe
wieder unter der EUPL (oder einer der in ihrem Anhang genannten verträglichen Lizenzen)
stehen.

Die mitgelieferten Fremdbibliotheken behalten ihre eigenen Lizenzen – siehe
[LIZENZEN.md](LIZENZEN.md). Für die Kartendienste gelten deren Nutzungsbedingungen.
