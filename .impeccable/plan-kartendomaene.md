# Plan: Domänenschicht der Karte

Modus: **Operate** · Stand: 2026-08-29 · Grundlage: `.impeccable/critique/2026-08-29T19-28-25Z__index-html.md`

**Kein Code in diesem Dokument ist umgesetzt.** Das hier ist der Zuschnitt, das Datenmodell
und die visuelle Sprache — die Umsetzung ist ein eigener Auftrag.

## Hinweis zu den Zeilennummern

Alle Zeilenangaben beziehen sich auf den Stand von Commit `1176e5b`. Während der Erstellung
dieses Plans lief parallel ein Härten-Durchgang (P0 „Datenverlust-Risiko"), der `js/state.js`,
`js/ui.js`, `js/app.js`, `js/bauauftrag.js`, `js/io.js`, `js/map.js`, `index.html`, `css/app.css`
und `css/print.css` verändert hat. Die Angaben zu diesen Dateien sind entsprechend zu
verschieben (in `state.js` etwa +4 Zeilen vor Zeile 266, +35 danach).

**Die tragenden Dateien dieses Plans sind davon nicht betroffen:** `js/strecken.js`, `js/geo.js`
und `js/zeichen.js` sind unverändert, ihre Zeilenangaben stimmen exakt.

## Der Befund in einem Satz

Der gedruckte Bauauftrag ist für den Fernmeldebau geschrieben, die Karte ist ein generischer
Leaflet-Editor. `kennzahlen()` (`js/strecken.js:7–27`) rechnet „5 Trommeln" und die Karte zeichnet
nichts; es gibt `sichtbar`, `art` und Farbe je Strecke, aber keinen Bauzustand; und die
Beschriftung ist schon vor jeder Erweiterung überladen (7 bestätigte `text-occlusion`-Befunde).

Daraus folgt die **Reihenfolge**: erst die Beschriftung tragfähig machen (Thema 3), dann den
Bauzustand (Thema 2), dann die Trommelstöße (Thema 1). Wer die Stöße zuerst zeichnet, zeichnet
sie in ein bereits volles Bild.

---

# Thema 3 zuerst: Kollisionsfreie Beschriftung

## Diagnose aus dem Code, nicht aus dem Screenshot

Drei nachweisbare Mechanismen, ein vermuteter:

1. **Alle Textmarker sitzen mittig auf ihrem Anker.** `app.css:359` setzt
   `transform: translate(-50%,-50%)` auf jedes `.fbp-label > span`, und `seg-mass` wird auf den
   Segmentmittelpunkt gesetzt (`mitte()`, `strecken.js:39`, benutzt in `strecken.js:247–260`).
   Das Maß einer Strecke liegt damit **auf der Linie, die es beschreibt** — die Trassenlinie ist
   4,5–6 px stark plus 8–11 px weiße Fassung (`strecken.js:227–239`). Das ist der
   `seg-mass "1.178 m"` zu 83 % verdeckt.

2. **Text lebt in drei Panes.** `map.js:57–62`: `fbp-griffe` z470 (Punkt-Badges),
   `fbp-labels` z620 (Maße), `fbp-zeichen` z640 (taktische Zeichen **samt ihrem Textlabel**,
   `zeichen.js:77–86` baut Symbol und `tz-label` in *ein* divIcon). Ein `tz-label` liegt damit
   strukturell über jedem Punkt-Badge. Das ist der `art-muffe "3M"` zu 50 % hinter `span.tz-label`.

3. **Das Streckenlabel hängt an einem Trassenpunkt, nicht an der Linie.**
   `strecken.js:292`: `const anker = s.punkte[Math.floor((s.punkte.length - 1) / 2)]`. Bei zwei
   Punkten ist das `punkte[0]`, also der Anfangspunkt. Die Position des wichtigsten Labels ist
   damit an die Punktgeometrie gekoppelt statt an den Linienverlauf.

4. **Annahme (im Befund nicht belegt, vor der Umsetzung im Browser nachzumessen):** die zu 100 %
   verdeckten `art-start "1A"` und `art-ziel "4E"` sind **deckungsgleiche Punkte zweier Strecken**.
   Im Fernmeldebau ist das der Normalfall, nicht der Ausnahmefall: an einem Endverzweiger enden
   und beginnen mehrere Strecken auf demselben Punkt. Zwei 20-px-Badges am selben Ort verdecken
   einander zu 100 %. Falls die Messung das bestätigt, ist es kein Layoutproblem, sondern ein
   fehlender Fall in der Zeichensprache — siehe Regel R4 unten.

## Festlegung

Drei Schichten, in dieser Reihenfolge wirksam. Keine kosmetische Verschiebung.

### Schicht A — Ankergeometrie (deterministisch, ohne Messung)

- **R1 — Maße stehen neben ihrer Linie, nie darauf.** `seg-mass` bleibt am Segmentmittelpunkt
  verankert, wird aber um **14 px senkrecht zum Segment** versetzt. Die Peilung liefert
  `peilung()` (`geo.js:56–62`); Web Mercator ist konform und Leaflet dreht die Karte nicht,
  deshalb ist der Bildschirmwinkel zoomunabhängig und darf **einmal beim Zeichnen** berechnet
  und in die CSS-Transform gebacken werden:
  `transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy)))`.
  Seite: außen an der Kurve (Vorzeichen aus dem Kreuzprodukt der beiden angrenzenden
  Segmentrichtungen); bei nur einem Segment links vom Verlauf.
- **R2 — Das Streckenlabel hängt an der Linie.** `strecken.js:292` wird von
  `punkte[floor((n-1)/2)]` auf den **Mittelpunkt des mittleren Segments** umgestellt und
  senkrecht dazu versetzt, und zwar auf die **Gegenseite** des `seg-mass` desselben Segments.
  Eine Regel, kein Sonderfall für n = 2. Das ist ein Einzeiler-Fix mit dem größten Einzelnutzen
  und kann vor allem anderen ausgeliefert werden.
- **R3 — Aller Text in genau einem Pane.** `zeichen.js:77–86` wird gesplittet: das Symbol-SVG
  bleibt als Marker in `fbp-zeichen` (z640), das `tz-label` wird ein **eigener Marker in
  `fbp-labels`** (z620). Damit nimmt es an derselben Kollisionsauflösung teil wie alles andere,
  statt sie zu überstimmen. Vertrag, der in `map.js:57–62` als Kommentar festzuhalten ist:
  *Geometrie in `fbp-strecken`/`fbp-griffe`/`fbp-zeichen`, jeder Text in `fbp-labels`.*
- **R4 — Deckungsgleiche Punkte fächern auf.** Punkt-Badges verschiedener Strecken, deren
  Bildschirmabstand < 6 px ist, werden radial aufgefächert: der erste bleibt, jeder weitere
  wandert 13 px nach außen, verteilt auf 120°-Schritten, und bekommt eine 1-px-Führungslinie
  zurück auf den echten Ort. Der Ort bleibt eindeutig, die Beschriftung wird lesbar. Genau der
  Endverzweiger-Fall.

### Schicht B — Kollisionsdurchlauf (ein Durchlauf je Zeichnung)

Neues Modul **`js/beschriftung.js`**, `class BeschriftungsManager`:

```
sammle(el, { prio, ankerPx, achsePx })   // Label anmelden statt direkt platzieren
loesen()                                  // ein rAF nach dem Zeichnen
```

Ablauf in `loesen()`:
1. **Ein** `getBoundingClientRect()` je Element, alle in einem Rutsch (ein erzwungenes Layout,
   nicht n).
2. Nach Priorität absteigend sortieren.
3. Gierige Platzierung: Rechteck gegen die bereits akzeptierten prüfen (AABB, 2 px Luft). Bei
   Kollision bis zu vier Kandidaten entlang der Senkrechten `achsePx` probieren: +16, −16,
   +32, −32 px. Kollidieren alle, wird das Label **ausgeblendet** (`hidden`), nicht gestapelt.
4. Wer mehr als 18 px vom Anker abweicht, bekommt eine **Führungslinie**: 1 px, Streckenfarbe,
   Deckkraft 0,6, als SVG im selben divIcon. Führungslinie **nur bei Versatz**, nie serienmäßig
   — sonst ist sie selbst wieder Rauschen.

**Priorität — das ist die fachliche Entscheidung, nicht die technische:**

| Rang | Label | Begründung |
|---|---|---|
| 1 | `strecken-mass` der **gewählten** Strecke | woran gerade gearbeitet wird |
| 2 | Punkt-Badges `start` / `ziel` | die Enden definieren die Strecke |
| 3 | Punkt-Badges `muffe` / `verteiler` / `querung` | kosten Material, Zeit und Genehmigung |
| 4 | `tz-label` | Benennung eines gesetzten taktischen Zeichens |
| 5 | Punkt-Badges `mast` / `reserve` | Bauobjekte zweiter Ordnung |
| 6 | Trommelstoß-Fähnchen `T1…` | rechnerisch, nicht gesetzt |
| 7 | Punkt-Badges `punkt` (reine Trassenpunkte) | Nummer steht in der Seitenleiste |
| 8 | `seg-mass` | steht im Tooltip und in der Punkttabelle |
| 9 | `strecken-mass` nicht gewählter Strecken | Kontext, kein Arbeitsgegenstand |

Unter Druck degradiert die Karte damit auf: Enden, Muffen, Querungen, taktische Zeichen — genau
die Objekte, an denen ein Bautrupp die Trasse abläuft. Das ist die Begründung für die Reihenfolge.

### Schicht C — Zoomabhängiges Ausdünnen (vor Schicht B, damit B weniger zu tun hat)

| Zoom | Regel |
|---|---|
| ≥ 16 | alles |
| 14–15 | `seg-mass` nur für Segmente **länger als 60 Bildschirm-px**; reine `punkt`-Badges verlieren ihre Nummer und werden 6-px-Punkte (`.fbp-punkt.knapp`), Art-Badges bleiben voll |
| 12–13 | kein `seg-mass`; nur Art-Badges, Trommelstöße und `strecken-mass` |
| ≤ 11 | nur `strecken-mass` je sichtbarer Strecke; Punkte gehen in der Linie auf |

Das 60-px-Kriterium wird über `karte.latLngToLayerPoint()` gemessen, **nicht** über Meter: ein
1.178-m-Segment ist bei z12 vier Pixel lang und sein Label sechzig breit.

**Deckel:** bleiben nach dem Ausdünnen mehr als **120** Labels im Viewport, wird nach Priorität
weiter verworfen. Verhindert, dass die 8-Strecken-Übung in ein Layout-Gewitter läuft.

## Betroffene Stellen

| Datei | Stelle | Eingriff |
|---|---|---|
| `js/beschriftung.js` | neu | Manager, Prioritäten, Kollisionsauflösung, Führungslinien |
| `js/strecken.js` | 247–260 | `seg-mass` über `sammle()` statt direkt; `--dx/--dy` aus `peilung()` |
| `js/strecken.js` | 289–306 | **292**: Anker auf Mittelsegment; Versatz gegenläufig zu `seg-mass` |
| `js/strecken.js` | 309–349 | Punkt-Badges anmelden; `knapp`-Variante; R4-Auffächerung |
| `js/strecken.js` | 170–181 | am Ende von `zeichne()`: `manager.loesen()` im `requestAnimationFrame` |
| `js/zeichen.js` | 77–86 | Symbol und Label in zwei Marker trennen, Label nach `fbp-labels` |
| `js/map.js` | 57–62 | Pane-Vertrag als Kommentar festhalten; unverändert in der Wirkung |
| `js/app.js` | ~356 ff. | `moveend`/`zoomend` → `loesen()` mit rAF-Entprellung |
| `js/bauauftrag.js` | 200–204 | `loesen()` **vor** dem Freigeben des Druckknopfs im 2×-Koordinatenraum |
| `css/app.css` | 358–412 | `--dx/--dy`-Transform, `.knapp`, `.fbp-fuehrung` |

**Druckkarte nicht vergessen:** `baueDruckkarte()` (`bauauftrag.js:215–257`) rendert mit
`SCHAERFE = 2`. Der Durchlauf muss dort im doppelten Pixelraum rechnen und **vor** dem
`druckKnopf.disabled = false` fertig sein — ein verdecktes Label auf Papier ist unreparierbar.

## Schritte

1. `strecken.js:292` korrigieren. Einzeiler, sofort auslieferbar.
2. `beschriftung.js` anlegen; Schicht A (R1–R3) und Schicht C.
3. Schicht B mit Prioritäten und Führungslinien; R4.
4. Druckkarte anschließen, mit 8 Strecken und 60 Punkten gegenmessen.

---

# Thema 2: `status` je Strecke

## Wortwahl

Fünf Zustände, ein linearer Lebenszyklus:

| id | Anzeige | bedeutet |
|---|---|---|
| `geplant` | geplant | Planung steht, kein Auftrag heraus |
| `beauftragt` | beauftragt | Bauauftrag erteilt, Trupp hat ihn |
| `imbau` | im Bau | Trupp arbeitet |
| `gebaut` | gebaut | Leitung liegt und ist gemessen |
| `gestoert` | gestört | gebaut, aber ausgefallen oder beschädigt |

`gebaut` deckt sich absichtlich mit dem vorhandenen Unterschriftenfeld
**„Bau beendet, Leitung gemessen"** (`bauauftrag.js:426`) — der Bauauftrag definiert den
Endzustand bereits, die Karte übernimmt ihn wörtlich statt einen zweiten zu erfinden.
`gestört` ist das übliche Fernmeldewort (Störung, Störungsbeseitigung).

**Bewusst nicht dabei:** `abgebaut` / `zurückgebaut`. Der Rückbau ist in der Übung real, aber
sechs Optionen sprengen die Grenze, die die Kritik im Abschnitt *Cognitive Load* ohnehin schon
gerissen sieht. Fünf sind vertretbar, weil sie ein Verlauf sind und keine Auswahl. Als eigene
Erweiterung vormerken.

## Der Konflikt, den die Kritik nicht sieht — und die Auflösung

Die Kritik schlägt vor, den Status „mit den Strichmustern zu kodieren, die in `print.css` für den
S/W-Druck schon existieren". Die Strichmuster stehen aber nicht in `print.css`, sondern in
`strecken.js:199–218`, **und der Kanal ist belegt**: `dashArray` kodiert heute die
**Verlegeart** (`erd` → `'14 7'`, `ober` → `'2 8'`, sonst durchgezogen). Zwei orthogonale
Bedeutungen passen nicht auf einen Strich.

**Festlegung: Der Status bekommt den Strich, die Verlegeart gibt ihn ab.**

Begründung: Die Verlegeart ist **eine Konstante je Strecke** (`s.verlegeart`, ein Wert für die
ganze Linie). Einen konstanten Wert über die teuerste kontinuierliche Sehachse auszugeben, ist
Verschwendung — er steht ohnehin im Stammdatenblock des Bauauftrags (`bauauftrag.js:311–324`),
in der Materialtabelle (388–413) und in der Streckenkarte. Der Status dagegen ist **die** Frage,
die ein Zugführer an die Karte stellt, und die muss ohne Lesen beantwortet werden.

Die Verlegeart wandert in den Tooltip (`_tooltipText`, `strecken.js:351–355`, zeigt heute schon
Kabelkurzform, Trasse und Bedarf), in die Streckenkarte und bleibt im Druck, wo sie steht. Netto
**weniger** Kartentinte, nicht mehr.

**Rückfallschalter:** `optionen.linienkodierung: 'status' | 'verlegeart'`, Vorgabe `'status'`.
Eine Zeile in `_stilRoh()`, ein Haken in `.kartenoptionen` (`index.html:103–113`). Wer sich an die
Verlegeart-Striche gewöhnt hat, holt sie zurück. Billige Versicherung gegen den einzigen echten
Einwand.

## Strichmuster

| Status | dashArray | Lesart |
|---|---|---|
| `geplant` | `'3 7'` | fein punktiert — noch Absicht |
| `beauftragt` | `'12 6'` | lang gestrichelt — vergeben, noch nicht gebaut |
| `imbau` | `'14 5 3 5'` | Strich-Punkt — teils fertig |
| `gebaut` | `null` | durchgezogen — die volle Linie **ist** der Endzustand |
| `gestoert` | `'2 6'` | kurz und zerhackt — sichtbar unterbrochen |

`gestoert` bekommt zusätzlich ein Zustandsfähnchen am `strecken-mass`-Label, weil eine Störung
schreien darf und der Strich allein zu leise ist. Kein zweiter Linienzug, kein Querstrich — der
Querstrich gehört ab Thema 1 dem Trommelstoß.

Die Muster gehen unverändert durch `_stil()` (`strecken.js:188–197`) und werden dort bereits mit
`strichFaktor` skaliert; im Druck stimmt die Rhythmik damit automatisch.

**Der S/W-Druck gewinnt, statt zu verlieren.** In `_stilRoh()` (202–209) ist die Auftragsstrecke
schwarz und durchgezogen und **alle anderen** sind heute einheitlich `'5 5'` grau. Genau dort
kommt der Status hin: die Auftragsstrecke bleibt wie sie ist, die Nebenstrecken tragen ihr
Zustandsmuster. Der Bauauftrag zeigt damit auf einem Blick, was ringsum schon steht — ohne dass
sich an der Hervorhebung der Auftragsstrecke irgendetwas ändert.

## Datenmodell

In `js/state.js`, direkt hinter `PUNKTARTEN` (25–34):

```js
export const BAUZUSTAENDE = [
  { id: 'geplant',    name: 'geplant',    kurz: 'GEP', strich: '3 7'       },
  { id: 'beauftragt', name: 'beauftragt', kurz: 'BEA', strich: '12 6'      },
  { id: 'imbau',      name: 'im Bau',     kurz: 'BAU', strich: '14 5 3 5'  },
  { id: 'gebaut',     name: 'gebaut',     kurz: 'FER', strich: null        },
  { id: 'gestoert',   name: 'gestört',    kurz: 'STÖ', strich: '2 6'       }
];
export const bauzustandById = id => BAUZUSTAENDE.find(b => b.id === id) || BAUZUSTAENDE[0];
```

`neueStrecke()` (`state.js:72–90`) bekommt ein Feld: `status: 'geplant'`.
`neuesProjekt().optionen` (63–66) bekommt `linienkodierung: 'status'`.

### Migration — es ist keine nötig, und das ist kein Zufall

`migrieren()` (`state.js:268–285`) legt jede Strecke als
`{ ...neueStrecke({ strecken: [] }), ...s }` an und jede `optionen` als
`{ ...v.optionen, ...(p.optionen || {}) }`. **Jede Bestandsplanung erbt die Vorgabe automatisch.**
Es ist genau das Muster, für das diese Funktion gebaut wurde.

Eine defensive Zeile trotzdem, in den `strecken`-Mapper:

```js
status: bauzustandById(s.status).id,
```

Das repariert einen von Hand editierten oder aus einer fremden Quelle importierten Wert auf
`geplant`, statt ihn bis in den Renderer durchzureichen. Kostet nichts, verhindert eine
Strecke, die ohne Strich gezeichnet wird.

## Wo der Status gesetzt und gelesen wird

- **Gesetzt:** Streckenkarte in der Seitenleiste, Gruppe „Stammdaten" (`ui.js:178–191`), als
  erstes Feld über der Bezeichnung. Vorhandener `feld()`-Helfer,
  `{ typ: 'select', werte: BAUZUSTAENDE.map(b => [b.id, b.name]) }`. Keine neue UI-Maschinerie.
- **Gelesen ohne Aufklappen:** die eingeklappte Zeile `eintrag-zeile` (`ui.js:158–161`) zeigt
  heute `Kabelkurzform · N Punkte · Bedarf X`. Der Zustands-Chip kommt **davor**.
- **Der Chip zeigt das Muster, das die Karte zeichnet** — er ist die Legende am Ort der
  Bedienung:

```css
.zustand-chip { display:inline-flex; align-items:center; gap:5px;
  font-size:10.5px; text-transform:uppercase; letter-spacing:.3px; }
.zustand-chip i { width:24px; height:2px; }
.zu-beauftragt i { background: repeating-linear-gradient(90deg,
  currentColor 0 12px, transparent 12px 18px); }   /* = dashArray '12 6' */
```

- **Im Bauauftrag:** eine vierte Zeile in der Kennung-Tabelle von `kopfHTML()`
  (`bauauftrag.js:303–307`): `Bauzustand | GEPLANT`. Dort gehört Dokument-Metadatum hin, und die
  Tabelle ist `width:auto`, wächst also sauber. **Nicht** in `stammHTML()` — das ist ein
  Dreier-Raster (`print.css:87–90`) und eine siebte Zelle bräche den Rhythmus.
  Zusätzlich in `legendeHTML()` (341–352) die Zustandsmuster, die im Blatt tatsächlich vorkommen.
  **Ohne Farbe** — das S/W-Versprechen bleibt.

## Filtern statt Gruppieren

**Festlegung: Filter, nicht Gruppierung.** Gruppieren ordnet die Liste um und zerstört das
Ortsgedächtnis („meine dritte Strecke"). Ein Filter lässt die Reihenfolge in Ruhe.

Die Zusammenfassungszeile `#strecken-summe` (`index.html:69`, befüllt in `ui.js:119–125`) wird zur
Filterleiste mit fünf Chips samt Zählern:

```
Geplant 3 · Beauftragt 2 · Im Bau 1 · Gebaut 4 · Gestört 0     Trasse 12,4 km · Bedarf 14,3 km
```

Ein Klick filtert **Liste und Karte** gemeinsam. Die Summen rechnen dann über die gefilterte
Menge und sagen das auch („gefiltert: 2 Strecken").

**Der Filter wird nicht persistiert.** Er lebt in `ctx.statusFilter`, nicht in `projekt.optionen`.
Ein Filter, der einen Reload überlebt und beim nächsten Start die halbe Planung versteckt, ist
ein Supportfall. Bewusste Festlegung.

## Betroffene Stellen

| Datei | Stelle | Eingriff |
|---|---|---|
| `js/state.js` | nach 34 | `BAUZUSTAENDE`, `bauzustandById` |
| `js/state.js` | 72–90 | `neueStrecke`: `status: 'geplant'` |
| `js/state.js` | 63–66 | `optionen.linienkodierung: 'status'` |
| `js/state.js` | 276–280 | defensive Normalisierung `status:` im Strecken-Mapper |
| `js/strecken.js` | 199–218 | `_stilRoh`: `strich` aus Zustand statt Verlegeart; SW-Zweig für Nebenstrecken |
| `js/strecken.js` | 351–355 | `_tooltipText`: Zustand und Verlegeart ergänzen |
| `js/ui.js` | 178–191 | Zustandsfeld in Gruppe 1 |
| `js/ui.js` | 158–161 | Zustands-Chip in der eingeklappten Zeile |
| `js/ui.js` | 107–133 | Filterleiste, Zähler, gefilterte Summen |
| `js/bauauftrag.js` | 303–307 | Kennung-Zeile „Bauzustand" |
| `js/bauauftrag.js` | 341–352 | Legende um vorkommende Zustandsmuster |
| `js/io.js` | 84–96 | `status` in die GeoJSON-Eigenschaften der LineString-Features |
| `index.html` | 103–113 | Haken „Linien nach Bauzustand" |
| `css/app.css` | ~180 ff. | `.zustand-chip`, Filterchips |

## Schritte

1. Enum, `neueStrecke`, defensive Migration.
2. `_stilRoh` umstellen, Verlegeart in Tooltip und Streckenkarte umziehen, Rückfallschalter.
3. Feld in der Seitenleiste, Chip in der eingeklappten Zeile, Chip-CSS mit echter Musterrhythmik.
4. Filterleiste und gefilterte Summen.
5. Bauauftrag: Kennung-Zeile und Legende.

---

# Thema 1: Trommelstöße zeichnen

## Wie der Bauzuschlag entlang der Trasse verrechnet wird

**Festlegung: gleichmäßig verteilt, nicht am Ende.**

`kennzahlen()` rechnet `bedarf = trasse * (1 + zuschlag/100)`. Eine Trommel mit `tl` Metern Kabel
deckt damit `tl / (1 + zuschlag/100)` **Trassenmeter** ab. Die rechnerische Lage des k-ten Stoßes
ist:

```
faktor        = 1 + zuschlag / 100
schrittTrasse = trommellaenge / faktor
lage_k        = k * schrittTrasse          für k = 1 … (trommeln − 1)
```

Begründung, aus dem Produkt selbst: die Fußnote der Punkttabelle sagt bereits
*„Geländeverlauf, Umgehungen und Reserven deckt der Bauzuschlag ab"* (`bauauftrag.js:383–384`).
Das sind über die ganze Trasse verteilte Effekte, keine Zugabe am Ende. Und der Fehler zeigt in
die richtige Richtung: bei der Annahme „am Ende" lägen die Marken systematisch **zu weit vorn**,
der Trupp stünde vor der leeren Trommel, bevor er die Marke erreicht. Die verteilte Annahme
irrt konservativ.

Zahl der Stöße: `trommelstoesse = max(0, trommeln − 1)`. Bei „5 Trommeln" also **4 Stöße**.
Ein Stoß, dessen `lage_k >= trasse`, entfällt (Rundungsrand).

**Kein Zurücksetzen an gesetzten Muffen.** Fachlich ließe sich argumentieren, dass eine geplante
Muffe die Trommel abschneidet und der Rest ein Stummel ist. Das ist eine Bauentscheidung, die die
Anwendung nicht stillschweigend treffen darf. Das Modell bleibt durchlaufend, und die Fußnote
sagt es. **Anzunehmende Festlegung, mit einem Fernmeldeausbilder gegenzuprüfen.**

**Interpolation:** neue Funktion in `js/geo.js`, neben `kumuliert()` (79–83):

```js
export function punktBeiDistanz(punkte, meterAbAnfang)
// -> { lat, lng, segment: i, restImSegment } | null
```

Segment über `kumuliert()` suchen, dann linear in lat/lng nach dem Anteil `rest / segLaenge`
interpolieren. Bei Segmentlängen unter etwa 5 km liegt der Fehler gegen die echte Geodäte weit
unter einem Meter — Größenordnungen unter der Unschärfe, die der Bauzuschlag selbst mitbringt.
**Genannte Annahme**, nicht verschwiegen.

## Der Marker

Er darf mit **keiner** vorhandenen Punktart verwechselbar sein. Vorhanden sind ausschließlich
gefüllte 20-px-Badges mit Beschriftung: Kreis (`punkt`/`start`/`ziel`), abgerundetes Quadrat
(`muffe`, `verteiler`), Raute (`querung`), oben rund/unten eckig (`mast`) — `app.css:380–395`.

Der Trommelstoß ist **kein Trassenpunkt**. Er ist eine gerechnete Lage. Also bekommt er eine
andere Formklasse: **einen Querstrich über die Trasse**, wie eine Meilenmarke, plus ein kleines
Fähnchen daneben.

```html
<span class="fbp-stoss" style="--farbe:#d32f2f; --dreh:37deg">
  <i class="stoss-strich"></i><b class="stoss-tag">T1</b>
</span>
```

```css
.fbp-stoss { position: relative; display: block; transform: translate(-50%,-50%); }
.stoss-strich {
  display: block; width: 3px; height: 22px; margin: -11px 0 0 -1.5px;
  background: var(--farbe);
  box-shadow: 0 0 0 1.5px #fff, 0 1px 2px rgba(0,0,0,.4);
  transform: rotate(var(--dreh));            /* Peilung des Segments; Strich quer dazu */
}
.stoss-tag {
  position: absolute; left: 10px; top: -9px;
  background: rgba(255,255,255,.94);
  border: 1px dashed var(--farbe);           /* gestrichelt = rechnerisch */
  border-radius: 2px; padding: 0 3px;
  font-size: 9.5px; font-weight: 700; font-variant-numeric: tabular-nums;
}
```

Die **gestrichelte Fassung des Fähnchens** ist das Zeichen für „gerechnet, nicht gesetzt". Sie
kollidiert mit nichts: gestrichelte Ränder gibt es sonst nur bei `.seg-mass.vorschau`
(`app.css:367`) und beim Einfügegriff (`app.css:399`) — beides ebenfalls „noch nicht fest",
also dieselbe Bedeutung, nicht eine zweite.

Der Strich steht **quer zur Trasse** und nimmt damit eine Achse, die keine andere Punktart
belegt. Das ist der Grund, warum in Thema 2 der Zustand `gestoert` **keinen** Querstrich bekommt.

Rotation `--dreh` = `peilung()` des Segments (`geo.js:56–62`), einmal beim Zeichnen gesetzt,
zoomunabhängig (Web Mercator, keine Kartendrehung).

**S/W-Druck** (`print.css`, neben 230–242):

```css
.druck-doku.sw .stoss-strich { background: #000; }
.druck-doku.sw .stoss-tag    { border-color: #000; color: #000; }
.karten-inner .stoss-strich  { width: 5px; height: 36px; }
.karten-inner .stoss-tag     { font-size: 15px; padding: 1px 5px; }
```

**Wann sichtbar:**
- Arbeitskarte: für die **gewählte** Strecke immer; für alle übrigen nur, wenn
  `optionen.trommelstoesse` gesetzt ist. Vorgabe: **an**, aber Priorität 6 im
  Kollisionsdurchlauf — sie treten also von selbst zurück, wenn es eng wird.
- Bauauftragskarte: für die Auftragsstrecke **immer**. Papier hat Platz, und das ist das Blatt,
  mit dem der Trupp die Trasse abläuft.

## Manuell gesetzte Muffen in der Nähe

**Festlegung: eine geplante Muffe innerhalb von ±25 Trassenmetern eines rechnerischen Stoßes
*ist* dieser Stoß.**

25 m liegen innerhalb der Setzgenauigkeit eines von Hand gesetzten Punktes und weit unter der
Unschärfe des Bauzuschlags; eine halbe Trommel entfernt ist ohnehin ein anderer Stoß.
Konstante `STOSS_TOLERANZ_M = 25` in `strecken.js`, nicht im Datenmodell.

Verhalten bei Treffer:
- Der gerechnete Querstrich **entfällt**.
- Das Muffen-Badge bekommt `.stoss-erfuellt` — einen zweiten dünnen Ring:
  `box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px var(--farbe);`
- Das Fähnchen `T1` erscheint neben der Muffe, jetzt mit **durchgezogener** statt gestrichelter
  Fassung: es ist gesetzt, nicht gerechnet.

Damit macht die Anwendung die Arbeit des Planers sichtbar, statt ihn anzuschreien. Sie zeichnet
nur, was noch fehlt.

## Punkttabelle des Bauauftrags

**Festlegung: eigene kleine Tabelle unter den Trassenpunkten, nicht dazwischengemischt.**

Ein Einmischen in `punkttabelleHTML()` (`bauauftrag.js:354–386`) bräche die Nummerierung
`Nr. 1…n` — die Punktidentität, die überall sonst gilt — und die Ketten „Teilstrecke" und
„ab Anfang". Also ein eigener Abschnitt auf Blatt 2, direkt darunter, im vorhandenen
`.tab-punkte`-Stil:

```
TROMMELSTÖSSE (rechnerisch)
Nr. | ab Anfang | zwischen Punkt | MGRS | GPS (Grad/Dez.-Min.) | tatsächlich (MGRS)
T1  |    435 m  | 3 und 4        | 32U… | N 51° 14.074' …      | ______________________
T2  |    870 m  | 5 (Muffe gepl.)| 32U… | N 51° 14.512' …      | gesetzt
```

Die letzte Spalte bleibt **leer und liniert** — der Trupp trägt die wirkliche Lage beim Ausrollen
ein. Das ist derselbe Charakter wie die vorhandene Box „Zusätzliches Material / Werkzeug"
(`bauauftrag.js:408–411`), und es ist der Grund, warum dieses Blatt in einem Fahrzeug etwas taugt.

Fußnote darunter: *„Rechnerische Lage bei gleichmäßig über die Trasse verteiltem Bauzuschlag von
X %. Eine geplante Muffe innerhalb von 25 m gilt als Trommelstoß. Die tatsächliche Lage ergibt
sich beim Ausrollen."*

Weiter:
- **Legende** (`legendeHTML`, 341–352): Eintrag „Trommelstoß (rechnerisch)" mit dem Querstrich.
- **Kennzahlen** (`kennzahlenHTML`, 326–339): das Raster ist `repeat(7, 1fr)` und voll. Keine
  achte Kachel — stattdessen der Untertext der Trommel-Kachel von `à 500 m` auf
  **`à 500 m · 4 Stöße`**.
- **Materialtabelle** (388–413): Zeile `['Trommelstöße (rechnerisch)', '4']` direkt unter
  `Trommeln erforderlich`.
- **Seitenleiste** (`kennzahlenHTML` in `ui.js`, ~289): die Kachel „Trommeln" bekommt den
  Zusatz `5 · 4 Stöße`.

## Export

- **GPX** (`io.js:127–157`): je Stoß ein `<wpt>` mit `<sym>Flag</sym>`, Name `T1 (rechnerisch)`.
  Ein Bautrupp mit Hand-GPS will genau diese Wegpunkte.
- **GeoJSON** (`io.js:84–96`): Point-Features mit `art: 'trommelstoss'`, `berechnet: true`.
- **CSV** (`io.js:162–185`): angehängte Zeilen mit `Art = trommelstoss_rechnerisch`, leerer `Nr`.
  Eine Datei je Strecke bleibt eine Datei.

**Dabei ein vorhandener Defekt, der nicht schlimmer werden darf:** `geoJSONUebernehmen()`
(`io.js:56–77`) macht aus **jedem** Point-Feature ein taktisches Zeichen — schon heute auch aus
den exportierten Trassenpunkten. Wer die eigene GeoJSON reimportiert, bekommt Symbolmüll. Beim
Anfassen dieser Stelle: Features mit `properties.berechnet === true` und solche mit einem
`properties.art` aus `PUNKTARTEN` beim Import überspringen.

## Datenmodell

**Trommelstöße werden nicht gespeichert.** Sie sind eine reine Funktion aus `punkte`, `zuschlag`
und `trommellaenge`. Sie zu persistieren hieße, bei jedem Punkt-Drag invalidieren zu müssen —
der klassische Weg in abgedriftete Zustände. Berechnung in `js/strecken.js`, neben `kennzahlen()`:

```js
export function trommelstoesse(strecke)
// -> [{ nr, lageTrasse, lat, lng, segment, dreh, muffe|null }]
```

**Migration: keine.** Der einzige Zustand ist ein Anzeigeschalter
`optionen.trommelstoesse: true` in `neuesProjekt()` (`state.js:63–66`), den `migrieren()` über
`{ ...v.optionen, ...(p.optionen||{}) }` (275) jeder Bestandsplanung automatisch mitgibt.

## Betroffene Stellen

| Datei | Stelle | Eingriff |
|---|---|---|
| `js/geo.js` | nach 83 | `punktBeiDistanz()` |
| `js/strecken.js` | nach 35 | `trommelstoesse()`, `STOSS_TOLERANZ_M` |
| `js/strecken.js` | 220–307 | Stoß-Marker zeichnen, über `sammle()` mit Priorität 6 |
| `js/strecken.js` | 309–349 | `.stoss-erfuellt` am getroffenen Muffen-Badge |
| `js/state.js` | 63–66 | `optionen.trommelstoesse: true` |
| `js/bauauftrag.js` | nach 386 | Abschnitt „Trommelstöße" auf Blatt 2 |
| `js/bauauftrag.js` | 326–339 | Untertext der Trommel-Kachel |
| `js/bauauftrag.js` | 341–352 | Legendeneintrag |
| `js/bauauftrag.js` | 388–413 | Materialzeile |
| `js/ui.js` | ~289 | Kennzahl-Kachel „Trommeln" |
| `js/io.js` | 84–96, 127–157, 162–185 | GeoJSON, GPX, CSV |
| `js/io.js` | 56–77 | Reimport-Filter (vorhandener Defekt) |
| `index.html` | 103–113 | Haken „Trommelstöße" |
| `css/app.css` | nach 395 | `.fbp-stoss`, `.stoss-strich`, `.stoss-tag`, `.stoss-erfuellt` |
| `css/print.css` | 230–242 | S/W- und 2×-Varianten |

## Randfälle

| Fall | Verhalten |
|---|---|
| `punkte.length < 2` | keine Stöße |
| `trommeln <= 1` | keine Stöße (eine Trommel braucht keinen Stoß) |
| `zuschlag = 0` | `faktor = 1`, Stöße alle `trommellaenge` Trassenmeter |
| ein Segment länger als eine Trommel | mehrere Stöße im selben Segment, funktioniert über die kumulierte Rechnung |
| `lage_k` fällt auf den letzten Meter | entfällt, `lage_k >= trasse` |
| `trommellaenge` unsinnig klein | `kennzahlen()` klemmt bereits auf `>= 1` (`strecken.js:12`); zusätzlich Deckel bei 200 Stößen je Strecke gegen Marker-Lawinen |

---

# Thema 4: Gehört die stufenübergreifende Übersicht in diesen Zuschnitt?

## Empfehlung: nein — eigene Story. Aber ihre wirksamste Hälfte fällt hier kostenlos ab.

**Warum nicht hier:**

1. **Anderes Artefakt, anderes Verb.** Die drei Themen oben machen *eine Strecke* auf der Karte
   lesbar. Das Zugführerblatt ist ein *Dokument über das Projekt* — ein Geschwister des
   Bauauftrags, kein Kartenmerkmal. Es gehört als `oeffneStreckenuebersicht()` neben
   `oeffneBauauftrag()` und benutzt `blatt()`, `kopfHTML()`, `fussHTML()`, `.blatt` und
   `.tab-punkte` unverändert weiter. Danach ist es eine kleine Datei mit **null** neuer
   visueller Sprache.

2. **Sie hängt vom Ergebnis dieses Zuschnitts ab.** Ihre wertvollste Spalte ist genau der
   `status` aus Thema 2 — das ist die Spalte „was ist noch offen?" — und ihre Trommelspalte ist
   die Zahl aus Thema 1. Vorher gebaut, wäre sie eine Tabelle mit einer fehlenden Spalte.
   Nachher gebaut, kostet sie fast nichts.

3. **Sie hängt an einer Entscheidung, die dieser Zuschnitt nicht treffen muss.** Die Übersicht
   zieht sofort die Frage nach dem Sammeldruck nach sich (Persona-Befund: 8 Strecken = 8
   Druckdialoge). Die richtige Antwort darauf ist ein **Sammel-Bauauftrag** — N Strecken, 2N
   Blätter, ein `window.print()`. Das ist echte Arbeit an Kartenlebenszyklus, Kachelbudget und
   `warteAufKacheln()` für N Karten und darf sich nicht hinter einer Tabelle hereinschmuggeln.

4. **Scope-Disziplin gegen den Cognitive-Load-Befund.** Die Kritik sieht 5 von 8 Punkten
   gerissen. Eine ganze neue Oberfläche im selben Zug macht das schlechter, bevor es besser wird.

**Was hier trotzdem abfällt:** die Filterleiste aus Thema 2 mit ihren Zählern

```
Geplant 3 · Beauftragt 2 · Im Bau 1 · Gebaut 4 · Gestört 0
```

ist die kleinste nützliche Fassung der Übersicht und beantwortet „was ist noch offen?" auf dem
Bildschirm zum Nulltarif. **Das sind die 5 % der Übersicht, die 80 % zahlen** — die liefern wir
hier. Das gedruckte Blatt mit Trupp / Leitungsart / Bedarf / Bauzeit ist die eigene Story,
und sie sollte den Sammeldruck gleich mitbringen.

---

# Reihenfolge über alle Themen

| # | Schritt | Aus Thema |
|---|---|---|
| 0 | `strecken.js:292` — Streckenlabel an die Linie statt an den Punkt | 3 |
| 1 | `beschriftung.js`, Ankergeometrie R1–R4, Zoom-Ausdünnung | 3 |
| 2 | Kollisionsdurchlauf, Prioritäten, Führungslinien; Druckkarte anschließen | 3 |
| 3 | `BAUZUSTAENDE`, `neueStrecke.status`, `_stilRoh`, Verlegeart in den Tooltip, Rückfallschalter | 2 |
| 4 | Zustandsfeld, Chip, Filterleiste, gefilterte Summen | 2 |
| 5 | Bauauftrag: Kennung-Zeile, Legende | 2 |
| 6 | `punktBeiDistanz()`, `trommelstoesse()`, Querstrich-Marker, Muffen-Abgleich | 1 |
| 7 | Bauauftrag: Stoßtabelle, Legende, Kennzahltexte; GPX/GeoJSON/CSV; Reimport-Filter | 1 |

Schritt 0 ist allein auslieferbar und nimmt vermutlich den größten Einzelanteil der
Occlusion-Befunde weg.

# Offene Annahmen — getroffen, nicht offengelassen

1. **Der Bauzuschlag verteilt sich gleichmäßig über die Trasse.** Aus der eigenen Fußnote des
   Produkts abgeleitet. Mit einem Fernmeldeausbilder gegenprüfen.
2. **Eine geplante Muffe setzt die Trommel nicht zurück.** Bewusst kein stilles Bauurteil der
   Anwendung. Gegenprüfen.
3. **±25 m Toleranz** für „diese Muffe ist der Trommelstoß". Aus der Setzgenauigkeit eines
   Handpunktes geschätzt, nicht gemessen.
4. **Lineare Interpolation in lat/lng** für die Stoßlage. Unter 1 m Fehler bei Segmenten unter
   5 km, weit unter der Unschärfe des Zuschlags.
5. **Die zu 100 % verdeckten `1A` / `4E` sind deckungsgleiche Punkte zweier Strecken**
   (Endverzweiger). Der Befund benennt den Verdecker nicht — vor Schritt 1 einmal im Browser
   nachmessen. Regel R4 deckt den Fall unabhängig davon ab.
6. **Fünf Bauzustände, `abgebaut` fehlt bewusst.** Der Rückbau ist real; sechs Optionen sind es
   nicht wert, solange der Cognitive-Load-Befund offen ist.
7. **Der Status verdrängt die Verlegeart vom Strich.** Der Rückfallschalter
   `optionen.linienkodierung` macht die Entscheidung umkehrbar, falls die Praxis widerspricht.
