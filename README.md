# FMBauplaner

**[fmbauplaner.app](https://fmbauplaner.app)**

GIS-Planungswerkzeug für den **Fernmeldebau**, ausgelegt auf die Arbeitsweise des THW.
Strecken werden auf der Karte geplant, die Längen stehen direkt an der Trasse, und
für jede Strecke lässt sich ein druckfertiger **Bauauftrag** für den Fernmeldebautrupp
ausgeben – A4 oder A3, hoch oder quer, in Farbe oder Schwarz-Weiß.

Die Anwendung läuft vollständig im Browser. Es gibt keinen Server, keine Anmeldung
und keinen Datenabfluss: alle Planungen liegen im lokalen Speicher des Browsers.

---

## Funktionsumfang

**Strecken planen**
- Beliebig viele benannte Strecken, jede mit eigener Farbe
- Teillängen an jedem Abschnitt und Name samt Gesamtlänge an der Strecke – dauerhaft sichtbar
- Punktarten: Anfangspunkt, Trassenpunkt, Muffe, Verteiler, Querung, Mast, Kabelreserve, Endpunkt
- Punkte verschieben, Zwischenpunkte über Griffe einfügen, Richtung umkehren
- Leitungsart (Feldkabel, Feldfernkabel, LWL, Netzwerk, Koax, Strom), Verlegeart,
  Bauzuschlag, Trommellänge und Verlegeleistung je Strecke

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

**Koordinaten in MGRS und GPS**
- Laufende Anzeige von MGRS und GPS unter der Karte
- Je Punkt abrufbar: MGRS (1 m und 10 m), UTM, Grad/Dezimalminuten, Grad/Minuten/Sekunden,
  Dezimalgrad – zum Kopieren
- Eingabefeld erkennt alle diese Formate und springt die Koordinate an

**Bauauftrag als PDF**
- Blatt 1: Kopf- und Stammdaten, Karte mit hervorgehobener Trasse, Nordpfeil,
  Maßstabsleiste mit Maßstabsangabe, Übersichtskarte, Zeichenerklärung, Kennzahlenband
- Blatt 2: Punkttabelle mit MGRS, GPS, Teilstrecke, Summe und Richtung;
  Materialbedarf; Auftragstext; Unterschriftenfelder
- A4/A3, hoch/quer, Farbe oder Schwarz-Weiß; im S/W-Druck unterscheiden Strichmuster
  statt Farben, die Karte wird auf die amtliche Graustufenkarte umgestellt
- Die Druckkarte wird in doppelter Auflösung gerendert (≈ 190 dpi statt 96 dpi)

**Weitere Ausgaben**
- Planung als `.json` sichern und laden
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

**Bauauftrag drucken:** Strecke in der Seitenleiste öffnen → „Bauauftrag (PDF)“.
Format und Farbe einstellen, dann „Drucken / Als PDF speichern“. Im Druckdialog des
Browsers dasselbe Papierformat wählen und die Ränder auf „Standard“ oder „Keine“ lassen –
das Blatt bringt seine Ränder selbst mit.

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
`Entwicklungsstand` aus.

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
index.html            Grundgerüst der Oberfläche
css/app.css           Oberfläche
css/print.css         Bauauftrag: Vorschau und Ausdruck
js/app.js             Zusammenbau, Bedienung, Tastatur
js/state.js           Datenmodell, Projektverwaltung, LocalStorage, Undo
js/geo.js             Entfernungen (Vincenty), MGRS/UTM/GPS, Eingabe-Parser
js/strom.js           Querschnitt von Stromleitungen aus Last und Länge
js/map.js             Leaflet-Karte und Basiskarten
js/strecken.js        Strecken zeichnen, bearbeiten, beschriften
js/symbols.js         Taktische Zeichen: Auswahl und SVG-Ausgabe
js/zeichen-daten.js   Die Zeichen selbst (erzeugt, nicht von Hand ändern)
js/zeichen.js         Taktische Zeichen auf der Karte
js/bauauftrag.js      Druckdokument
js/ui.js              Seitenleiste, Formulare, Dialoge
js/io.js              JSON, GeoJSON, GPX, CSV
js/version.js         Stand der Anwendung (beim Veröffentlichen gesetzt)
fonts/                Roboto Slab Bold, die Beschriftungsschrift der Zeichen
scripts/              Zeichen holen und prüfen (siehe unten)
vendor/               Leaflet 1.9.4, mgrs 2.1.0 (siehe LIZENZEN.md)
LICENSE               EUPL-1.2
```

Der Datenbestand liegt unter dem LocalStorage-Schlüssel `fbp.projekte.v1`, das zuletzt
geöffnete Projekt unter `fbp.aktiv.v1`. `js/state.js` hebt ältere Dateien beim Laden
über `migrieren()` auf das aktuelle Schema.

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
