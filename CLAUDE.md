# Hinweise für Claude Code

FMBauplaner ist ein GIS-Planungswerkzeug für den Fernmeldebau des THW: eine
statische Seite, die vollständig im Browser läuft. Was die Anwendung kann, wie
sie bedient wird und wie sie veröffentlicht wird, steht in der `README.md` —
hier steht nur, was beim Arbeiten am Quelltext zu beachten ist.

## Grundsätze

**Kein Build-Schritt, keine Abhängigkeiten.** Reines ES-Modul-JavaScript, von
Hand geschrieben, ohne Framework, Bundler, Transpiler oder Paketmanager. Es gibt
keine `package.json` und soll keine geben. Fremdcode liegt entpackt unter
`vendor/` (Leaflet, mgrs, libheif als WebAssembly) und ist in `LIZENZEN.md`
verzeichnet. Wer eine
Bibliothek ergänzen will, legt sie dort ab und trägt die Lizenz nach — er fügt
keinen Installationsschritt ein.

**Alle Pfade relativ.** Die Seite muss auch in einem Unterverzeichnis laufen
(`https://<benutzer>.github.io/fernmeldebauplaner/`). Kein führender Schrägstrich
in `href`, `src` oder `import`.

**Die Daten bleiben auf dem Gerät.** Kein Server, kein Konto, keine Cookies.
Nach außen gehen ausschließlich Kartenkacheln und der GoatCounter-Zählimpuls.
Eine Änderung, die etwas anderes überträgt, ist ein Bruch mit der Zusage in
`datenschutz.html` und braucht eine ausdrückliche Entscheidung.

**Zustand nur über `state.js`.** Änderungen am Projekt laufen durch
`store.aendern(…)`, sonst greifen Undo, Speicherstand und Neuzeichnen nicht.
Wird das Datenschema erweitert, gehört die Umsetzung älterer Stände in
`migrieren()` und `SCHEMA` wird hochgezählt — im `localStorage` der Nutzer
liegen echte Planungen, die weiter zu öffnen sein müssen.

## Sprache und Schreibweise

Alles ist deutsch: Bezeichner, Kommentare, Oberflächentexte, Commit-Betreffs.
Englisch sind nur Web-APIs und die wenigen eingebürgerten Begriffe (`escapeHtml`,
`id`, `store`).

- **Umlaute in Bezeichnern umschreiben:** `aendern`, `aufAenderung`,
  `schliesseDialog`, `oeffneSammeldruck`. Nie `ä`, `ö`, `ü`, `ß` im Quelltext-
  Bezeichner — in Zeichenketten, Kommentaren und der Oberfläche dagegen schon.
- **Typografie in sichtbaren Texten:** „doppelte" und ‚einfache' Anführungszeichen,
  Gedankenstrich –, Auslassungspunkte …, geschütztes Leerzeichen vor Einheiten
  (`15 m`), Malzeichen × statt x (`FK 1×2`).
- **Fachbegriffe des Fernmeldebaus verwenden**, nicht umschreiben: Trasse,
  Muffe, Endverzweiger, Kabelreserve, Bauzuschlag, Trommellänge, Verlegeleistung.
  Fachliche Werte und Regeln der KatS-Dv 861 stehen in `js/vorschrift.js`, jeweils
  mit Gliederungsnummer als Fundstelle — am Bauort wird nach der Nummer gesucht.

## Code-Stil

- Einfache Anführungszeichen in JavaScript, zwei Leerzeichen Einrückung,
  Semikolons, `const` vor `let`.
- Modulkopf als eine Zeile: `// datei.js – Zweck des Moduls`.
- Abschnittstrenner: `// ------…------ Titel`, Strichlinie auf gut 70 Zeichen,
  der Titel steht rechts daneben.
- Zeilen bis etwa 100 Zeichen, Kommentare auf 80 umgebrochen. Zusammengehörige
  kurze Anweisungen dürfen in einer Zeile stehen — die Datenlisten in `state.js`
  sind bewusst als Tabelle ausgerichtet.
- **Kommentare begründen, sie beschreiben nicht.** Der Bestand erklärt durchweg,
  *warum* etwas so ist und was die naheliegende Alternative kaputt gemacht hätte
  (siehe `css/print.css` oder den `concurrency`-Block in `release.yml`). Ein
  Kommentar, der nur wiederholt, was die Zeile darunter sagt, gehört nicht dazu.
- CSS: deutsche Klassennamen mit Bindestrich (`.druck-steuerung`, `.ds-titel`),
  Farben und Maße ausschließlich über die Variablen in `:root` von `css/app.css`.

## Dateien mit Sonderstatus

| Datei | Regel |
|---|---|
| `js/zeichen-daten.js` | Erzeugt. Nie von Hand ändern — `python3 scripts/taktische-zeichen-holen.py` |
| `fonts/roboto-slab-bold.woff` | Ebenso erzeugt, kommt aus demselben Skript |
| `js/version.js` | Im Repository steht `Entwicklungsstand`. Nie eine Nummer eintragen; die setzt der Workflow beim Veröffentlichen |
| `sitemap.xml` | Neue Seite heißt: Adresse hier eintragen. `lastmod` nicht von Hand pflegen – das setzt der Workflow je Seite aus dem Git-Datum |
| `CNAME`, `.nojekyll` | Gehören zu GitHub Pages, nicht anfassen |
| `vendor/` | Fremdcode unverändert, Änderungen gehören nach oben ins Projekt |
| `vendor/libheif/` | Ebenso. Wird nur nachgeladen, wenn eine HEIC-Datei ankommt – nie in den Startweg ziehen |

## Druck: der empfindlichste Teil

Der Bauauftrag ist das Erzeugnis, auf das es ankommt — er wird ausgedruckt und
auf den Bauplatz mitgenommen. Zwei Dinge sind dabei schon schiefgegangen:

**Zielbrowser ist Firefox auf macOS.** Dort entstehen die PDFs, dort wird geprüft.
Chrome verdeckt Fehler, die in Firefox auftreten. Zwei davon sind hier
umschifft und im Quelltext kommentiert — sie dürfen nicht „vereinfacht" werden:

- Firefox gibt Seitenbereiche mit CSS-`filter` beim Drucken **gar nicht** aus.
  Deshalb kommt die Graustufenkarte aus einer eigenen Kachelquelle
  (`grauVariante()` in `js/map.js`) statt aus einem Filter, und der Schlagschatten
  der taktischen Zeichen wird im Bauauftrag abgeschaltet.
- Leaflet legt `mix-blend-mode: plus-lighter` auf die Kacheln (Notbehelf gegen
  Kachelfugen in Chromium). Firefox lässt daraufhin beim Drucken die ganze
  Kartenebene weg, deshalb steht sie im Bauauftrag auf `normal`.

**Alle vier Formate prüfen.** A4 und A3, hoch und quer, Farbe und
Schwarz-Weiß — Inhalte sind im Querformat schon vom Blatt gefallen. Im
Schwarz-Weiß-Druck unterscheiden Strichmuster die Strecken, nicht Farben.

## Prüfen

Es gibt keine Testsuite. Geprüft wird im Browser:

```bash
python3 -m http.server 8123
```

Wegen der ES-Module reicht ein Doppelklick auf `index.html` nicht. Für die
Browser-Vorschau ist lokal ein Eintrag `fmbauplaner` auf Port 8123 in
`.claude/launch.json` hinterlegt; das Verzeichnis ist nicht versioniert.

Nach dem Auffrischen der taktischen Zeichen:

```bash
node scripts/zeichen-pruefen.mjs
```

Prüft, ob der Bestand vollständig ist und sich jedes Zeichen rendern lässt.

Vor jedem Abschluss: Konsole auf Fehler ansehen, Undo/Redo und das Neuladen der
Seite durchspielen (der Zustand muss den `localStorage` überleben), und bei
Änderungen an der Oberfläche die Schmalansicht mitnehmen — die Seitenleiste
weicht dort einem Umschalter zwischen Liste und Karte.

## Commits

Betreff ist ein deutscher Aussagesatz, der die Wirkung für den Nutzer benennt,
nicht die technische Maßnahme:

```
Karte fehlte im gedruckten Bauauftrag (Firefox)
Zu lange Stromleitung nicht als zu große Last melden
```

Kein Präfix, kein Conventional-Commits-Schema, kein Punkt am Ende. Jeder Push
auf `main` veröffentlicht sofort auf fmbauplaner.app und erzeugt Tag und Release
— also nur committen und pushen, wenn ausdrücklich darum gebeten wurde.
