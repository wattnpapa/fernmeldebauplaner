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

**Taktische Zeichen**
- 41 Symbole, angelehnt an DV 102 / BBK, in fünf Kategorien: Fernmeldetechnik,
  Kabelbau & Trasse, Führung & Einheiten, Einrichtungen, Gefahren
- Organisation (THW, Feuerwehr, Rettungsdienst, Polizei, Führung, Bundeswehr, neutral),
  Stärkeangabe (Trupp bis Bereitschaft), Drehung, Größe, freie Beschriftung
- Als SVG erzeugt: bleiben in jeder Zoomstufe und im Ausdruck scharf, auch in Schwarz-Weiß

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
Der mitgelieferte Workflow `.github/workflows/pages.yml` veröffentlicht bei jedem Push
auf `main`.

### Eigene Domain

Die Datei `CNAME` im Wurzelverzeichnis hält die Domain `fmbauplaner.app`. Dazu gehören
im DNS des Domainanbieters vier A- und vier AAAA-Einträge auf die GitHub-Pages-Adressen
(siehe `DNS.md`). Weil `.app` eine HSTS-Preload-Domain ist, funktioniert die Seite
ausschließlich über HTTPS – GitHub stellt das Zertifikat automatisch aus, sobald die
DNS-Einträge aufgelöst werden.

Alternativ ohne Actions: unter **Settings → Pages** die Quelle **Deploy from a branch**
mit Branch `main` und Ordner `/ (root)` wählen. Die Datei `.nojekyll` sorgt dafür,
dass GitHub die Dateien unverändert ausliefert.

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
js/map.js             Leaflet-Karte und Basiskarten
js/strecken.js        Strecken zeichnen, bearbeiten, beschriften
js/symbols.js         Taktische Zeichen (SVG)
js/zeichen.js         Taktische Zeichen auf der Karte
js/bauauftrag.js      Druckdokument
js/ui.js              Seitenleiste, Formulare, Dialoge
js/io.js              JSON, GeoJSON, GPX, CSV
vendor/               Leaflet 1.9.4, mgrs 2.1.0 (siehe LIZENZEN.md)
```

Der Datenbestand liegt unter dem LocalStorage-Schlüssel `fbp.projekte.v1`, das zuletzt
geöffnete Projekt unter `fbp.aktiv.v1`. `js/state.js` hebt ältere Dateien beim Laden
über `migrieren()` auf das aktuelle Schema.

---

## Hinweise zur Genauigkeit

Die Längen sind **geodätische Direktstrecken zwischen den gesetzten Trassenpunkten**,
nicht die tatsächliche Kabellänge im Gelände. Geländeverlauf, Umgehungen, Reserven an
Muffen und Endverzweigern deckt der **Bauzuschlag** ab (Vorgabe 15 %, bei LWL 20 %).
Wer genauer plant, setzt mehr Trassenpunkte. Der Richtwert für die Bauzeit ist eine
grobe Planungsgröße aus Bedarfslänge geteilt durch die eingestellte Verlegeleistung.

Die taktischen Zeichen sind an DV 102 und die BBK-Zeichenvorschrift angelehnt und für
die Planung gedacht. Für förmliche Lagedarstellungen ist die jeweils gültige
Dienstvorschrift maßgeblich.
