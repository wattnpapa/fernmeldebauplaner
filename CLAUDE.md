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
Nach außen gehen ausschließlich Karten- und Höhenkacheln sowie der GoatCounter-Zählimpuls.
Eine Änderung, die etwas anderes überträgt, ist ein Bruch mit der Zusage in
`datenschutz.html` und braucht eine ausdrückliche Entscheidung.

Auch die ART der Abfrage zählt dazu, nicht nur ihr Inhalt: das Mitnehmen der
Karte holt dieselben Kacheln wie das Betrachten, aber gebündelt und in einem
schmalen Band — und daraus ist der Trassenverlauf abzulesen. Solche Fälle
stehen in `datenschutz.html` unter den Ausnahmen und gehören dort hin, bevor
sie gebaut werden.

**Zustand nur über `state.js`.** Änderungen am Projekt laufen durch
`store.aendern(…)`, sonst greifen Undo, Speicherstand und Neuzeichnen nicht.
Wird das Datenschema erweitert, gehört die Umsetzung älterer Stände in
`migrieren()` und `SCHEMA` wird hochgezählt — im `localStorage` der Nutzer
liegen echte Planungen, die weiter zu öffnen sein müssen.

**Soll und Ist sind zweierlei.** Seit Schema 13 trägt jede Strecke neben der
Planung einen `bau`-Block: was der Trupp am Bauort wirklich gebaut hat. Der
geplante Verlauf in `strecke.punkte` wird davon nie angefasst — die Abweichung
zwischen beiden ist das, was der Truppführer melden muss und der Planer
braucht. Wer am Baumodus arbeitet, liest `BAUDOKU.md`; dort stehen die
Festlegungen samt der verworfenen Wege.

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
  Fachliche Werte und Regeln stehen in `js/vorschrift.js`, jeweils mit
  Gliederungsnummer als Fundstelle — am Bauort wird nach der Nummer gesucht. Vier
  Quellen liegen dort nebeneinander: die KatS-Dv 861 von 1990, das
  THW-Ausbildungshandbuch Kabelbau von 2026 samt Merkblatt Sicherheits-
  bestimmungen und das Handbuch für den Feldfernkabelbau von 2003 — auf Letzteres
  beruft sich der Baumodus, weil Baumeldung, abschnittsweiser Bau und
  Übernahmemessung nur dort beschrieben sind. Jedes Datum trägt deshalb `quelle`
  neben `fundstelle`; ausgegeben wird beides über `fundstelleText()`, nie ein fest
  verdrahtetes Vorschriftskürzel.

  **Eine Ausnahme, und sie ist begründet:** der Materialkatalog
  (`MATERIALKATALOG`) steht ohne `quelle` und `fundstelle` dort. Von dem Bogen
  aus dem THW-Extranet sind Titel und Stand der veröffentlichten Fassung nicht
  bekannt, und eine erfundene Gliederungsnummer wäre schlimmer als keine – am
  Bauort wird nach der Nummer gesucht. Wer die Angabe beschafft, trägt sie an
  jeder Zeile nach; wer sie nicht hat, erfindet sie nicht.

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
| `sw.js` | Ebenso: `const STAND = 'Entwicklungsstand'`. Die Zeile nie umbenennen — an ihr hängt die Ersetzung im Workflow, und ohne sie teilen sich alle Stände einen Speicher |
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

**Der Offline-Wächter beantwortet beim Entwickeln die Anfragen.** Seit `sw.js`
dazugekommen ist, liefert der Speicher aus, was beim letzten Einrichten geholt
wurde — eine geänderte Datei erscheint erst, wenn ein neuer Wächter eingerichtet
ist, und das geschieht erst, wenn alle Fenster der Seite zu waren. Wer eine
Änderung sucht, die nicht ankommt, sucht sonst an der falschen Stelle. Zwei
Auswege: in den Entwicklerwerkzeugen unter *Anwendung → Service Workers* den
Haken *Update on reload* setzen (dann gilt jede Änderung sofort), oder dort
*Unregister* drücken. Ein hartes Neuladen (Umschalt+Neu laden) umgeht den
Wächter ebenfalls — aber nur für diesen einen Aufruf.

Nach dem Auffrischen der taktischen Zeichen:

```bash
node scripts/zeichen-pruefen.mjs
```

Prüft, ob der Bestand vollständig ist und sich jedes Zeichen rendern lässt.

Nach jeder Änderung am Baumodus oder an dem, was er anfasst (`js/baudoku.js`,
`js/baukarte.js`, `js/baumeldung.js`, `strecke.bau` in `js/state.js`,
Materialkatalog und Prüfarten in `js/vorschrift.js`, die Ist-Ebene in
`js/strecken.js`, der Codec in `js/teilen.js`):

```bash
node scripts/baumodus-pruefen.mjs
```

Fährt die Anwendung in einem echten Chromium: legt eine Strecke an, schaltet um,
nimmt Punkte auf allen drei Wegen auf, füllt den Materialnachweis, meldet, prüft
und übergibt, lädt neu, schickt die Planung durch den Link und zurück, lässt zwei
Trupps getrennt zurückmelden und einspielen und prüft, dass die gebaute Trasse auf
keinem der drei Auftragsblätter landet – wohl aber auf dem vierten, der
Baudokumentation, dort in allen vier Formaten.

Nach jeder Änderung an der Oberfläche, die Maße, Abstände, Schriftgrößen oder
Überdeckungen berührt:

```bash
node scripts/geraete-pruefen.mjs
```

Misst die Anwendung in vier Gerätegrößen mit Fingerbedienung (360×740,
390×844, 844×390 und 820×1180) und in vier Fenstern, bei denen die
Browserleisten schon abgezogen sind (320×568, 375×667, 390×690 und 667×375 –
so entstanden die Nutzerfotos des Mobil-Audits). Geprüft werden die wirksamen
Trefferzonen (die `::after`-Aufweitungen also eingerechnet, getastet mit
`elementFromPoint`), die Schriftgröße jedes Eingabefeldes gegen die
16-Pixel-Grenze von iOS, der sichere Rand des Geräts, ob eine Fläche, die
höher ist als der Schirm, überhaupt rollt, und ob eine Ansicht waagerecht
überläuft. In jedem der acht Fenster kommt dazu die freie Kartenfläche als
Anteil der Fensterhöhe (Planung mit Werkzeugleiste, Baumodus mit Bauleiste,
Baumodus mit offener Punktkarte), die Punktkarte nach „Punkt hier“ mit und
ohne Querung, die Meldungspille (sie darf keinen Tipp abfangen und nach einer
Aufnahme keine Leiste zudecken), die Modusleiste nach „Auf Karte“ (nur
wirksame Knöpfe, höchstens 64 px hoch), der Bau-Reiter (mit drei bestätigten
Punkten unter 2500 px, jeder Griff darin auf Handschuhmaß – getastet wird in
Schritten, weil der Reiter länger ist als jedes Fenster), das Koordinaten-Popup, die
aufgeklappten Kartenoptionen, das Dateimenü, die Zoomsteuerung und die
Druckvorschau (Lupenhinweis gegen die wirksame Blattschrift, drei
Einstellungsfelder ganz im Bild, das vergrößerte Blatt übersteht eine
geänderte Einstellung); die Tabelle am Ende des Laufs zeigt alles je Fenster
nebeneinander. Die Schwellen für die freie Kartenfläche sind die
Abnahme für die Pakete nach dem Audit und dürfen so lange rot sein. Drei
Regeln dieser Prüfung sind aus Fehlern entstanden und stehen dort kommentiert:
`offsetParent` taugt in der Schmalansicht nicht als Sichtbarkeitsprobe, seit
CSS-Nesting trägt jede Stilregel eine – leere, also wahre – `cssRules`-Liste,
und ein Fall, der kein einziges Element findet, gilt als durchgefallen, nicht
als bestanden.

Nach jeder Änderung am Offline-Weg (`sw.js`, `js/kacheln.js`, die Kachelebene in
`js/map.js`, die Registrierung in `js/app.js`):

```bash
node scripts/offline-pruefen.mjs
```

Schaltet das Netz im Browser ab und prüft, dass die Anwendung trotzdem startet.
Eine Warnung dazu: `Page.reload` mit `ignoreCache` umgeht den Service Worker
vollständig — wer im Prüfstand hart neu lädt, prüft genau das nicht, wofür der
Wächter da ist. Der Prüfstand steht in `scripts/pruefstand.mjs` und
kommt ohne Fremdpaket aus – Node bringt seit 22 einen `WebSocket` mit, und damit
lässt sich das DevTools-Protokoll unmittelbar sprechen. Einen anderen Browser
nimmt er über `CHROMIUM=…` entgegen.

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
