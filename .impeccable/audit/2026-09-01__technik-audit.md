---
target: index.html (Anwendung), css/*, js/*
total_score: 17
max_score: 20
p0_count: 0
p1_count: 2
p2_count: 5
p3_count: 6
timestamp: 2026-09-01
---

# Technik-Audit FMBauplaner

Methode: statische Analyse (alle CSS, Kern-JS), `detect.mjs` über index.html + CSS + UI-JS,
Browserprüfung mit Messskripten (Kontraste, Trefferflächen, Überlauf, Fokus) bei 1280 × 800
und 375 × 812 mit Touch-Emulation. Konsole fehlerfrei, alle Anfragen 200.

## Audit Health Score

| # | Dimension | Punkte | Kernbefund |
|---|-----------|--------|------------|
| 1 | Barrierefreiheit | 3 | Dialog fängt den Fokus nicht (kein inert, keine Falle, keine Rückgabe) |
| 2 | Performance | 3 | Modul-Wasserfall 4 Ebenen tief; 836-KB-Zeichendatei wird zuletzt entdeckt |
| 3 | Responsive | 3 | `seite-zu`-Falle beim Überschreiten von 900 px (Tablet-Rotation) |
| 4 | Theming | 4 | Bewusste Ein-Look-Festlegung, Token-Disziplin; Warnfarben-Trio dreifach wörtlich |
| 5 | Umsetzungsintegrität | 4 | Alle 9 Detektor-Warnungen als absichtsvoll verifiziert |
| **Gesamt** | | **17/20** | **Gut – schwache Dimensionen gezielt angehen** |

## Integritäts-Urteil

**Bestanden.** Der Detektor meldete 9 Warnungen (side-tab-Kanten, Roboto, Helvetica) –
alle im Kontext geprüft und als absichtsvoll belegt: die linken Farbkanten sind das
dokumentierte Codiersystem der Strecken- und Ergebniskästen, Roboto Slab ist die von der
Zeichensammlung vorausgesetzte Beschriftungsschrift, Helvetica das bewusste Formular-
Register des gedruckten Bauauftrags. Keine Schablonenmuster, durchgängig begründete
Entscheidungen im Quelltext.

## Frühere Befunde (Critique 2026-08-30) – Stand heute

- ✔ `istGehaltvoll` misst jetzt Arbeitsmenge (≥ 4 Punkte oder ≥ 3 Zeichen) – Mahnband
  greift beim Regelfall „eine große Strecke“ (im Browser bestätigt)
- ✔ Geisterstrecke: „Fertig“ ohne Punkte löscht den Rumpf auf beiden Pfaden
- ✔ Kleinste Schriften wieder ≥ 11 px (gemessen: alle Kontrastproben 5,0–16,4 : 1)
- ✔ Kurzanleitung als „?“ in der Kopfzeile und oben im Datei-Menü
- ✔ Druckansicht Telefon: „Tippen: Originalgröße“-Geste vorhanden
- ◐ Kartenoptionen weichen nur im Zeichenmodus; beim Betrachten decken sie schmal
  weiter ~47 % der Kartenbreite

## Befunde

### [P1] Dialog verwaltet den Fokus nicht (Barrierefreiheit)
- **Ort:** `js/ui.js` `dialog()` / `schliesseDialog()`, `index.html` `#dialog`
- **Gemessen:** `aria-modal="true"`, aber Hintergrund nicht `inert`, kein Tab-Fang,
  keine Fokus-Rückgabe an den Auslöser; bei reinen Text-Dialogen (Kurzanleitung)
  wandert der Fokus gar nicht erst hinein (activeElement bleibt dahinter)
- **Wirkung:** Tastatur- und Screenreader-Nutzer tabben hinter den Modal; `aria-modal`
  verspricht eine Abschottung, die nicht existiert – WCAG 2.4.3
- **Abhilfe:** beim Öffnen `#app` `inert` setzen, Auslöser merken und beim Schließen
  fokussieren; Text-Dialoge auf den Schließen-Knopf fokussieren
- **Befehl:** `/impeccable harden`

### [P1] `seite-zu` überlebt den Breitenwechsel – Liste unerreichbar (Responsive)
- **Ort:** `js/app.js:342` (`ansichtSetzen`), `css/app.css:184`
- **Gemessen:** Schmal „Karte“ wählen, Fenster über 900 px ziehen → `body.seite-zu`
  bleibt, `.seite` ist `display:none`, der einzige Rückweg `.ansicht-wechsel` ist
  breit `display:none`
- **Wirkung:** iPad-Rotation quer (1024 px > 900 px) lässt die gesamte Streckenliste
  verschwinden, ohne sichtbaren Weg zurück
- **Abhilfe:** `matchMedia('(max-width: 900px)')` mit `change`-Listener: beim
  Verlassen der Schmalansicht `seite-zu` entfernen
- **Befehl:** `/impeccable adapt`

### [P2] Kartenoptionen-Zeilen unter der eigenen Touch-Untergrenze
- **Ort:** `css/app.css` `.ko-zeile`/`.ko-haken`; `@media (pointer: coarse)` lässt sie aus
- **Gemessen:** 19 px Zeilenhöhe bei 6 px Lücke unter Touch-Emulation – gegen
  WCAG 2.5.8 (24 px) und den eigenen, sonst konsequent umgesetzten 44-px-Standard
- **Abhilfe:** im coarse-Block `.ko-zeile { min-height/padding }` ergänzen
- **Befehl:** `/impeccable adapt`

### [P2] Zeichnen nur mit Zeiger möglich (Barrierefreiheit)
- **Ort:** `js/strecken.js`/`js/app.js` – Punkte entstehen ausschließlich per Kartenklick
- **Wirkung:** Tastaturnutzer können Listen, Formulare und Druck vollständig bedienen,
  aber keine Strecke erzeugen – WCAG 2.1.1; `role="application"` auf `#karte` kündigt
  zudem ein Tastaturmodell an, das es nicht gibt (ehrlicher: `role="region"`)
- **Abhilfe (mindestens):** Punkt-Anfügen über die Koordinatensuche/Punktliste
  ermöglichen; `role` korrigieren
- **Befehl:** `/impeccable harden`

### [P2] Modul-Wasserfall verzögert den Start (Performance)
- **Ort:** `index.html` – Importkette `app.js → state.js → symbols.js → zeichen-daten.js`
- **Gemessen:** 4 sequenzielle Entdeckungsstufen; `zeichen-daten.js` (836 KB roh, größte
  Datei) wird zuletzt gefunden. Lokal DCL 711 ms; über Mobilfunk kostet jede Stufe
  eine Rundreise
- **Abhilfe:** `<link rel="modulepreload">` für die tiefe Kette (ohne Build-Schritt
  möglich); optional `zeichen-daten.js` dynamisch nachladen
- **Befehl:** `/impeccable optimize`

### [P2] ARIA-Gerüste ohne Verhalten (Barrierefreiheit)
- **Ort:** `index.html:82` `role="tablist"` ohne `aria-controls`/Pfeiltasten/rovendem
  tabindex, Inhalte ohne `role="tabpanel"`
- **Wirkung:** kündigt Reiterverhalten an, das die Tastatur nicht einlöst
- **Befehl:** `/impeccable harden`

### [P2] Kartenoptionen decken schmal ~47 % der Kartenbreite (Responsive)
- **Ort:** `css/app.css:638` – 176 × 184 px fest eingeblendet außerhalb des Zeichenmodus
- **Abhilfe:** einklappbar machen (Zustand je Sitzung), wie im Critique vorgeschlagen
- **Befehl:** `/impeccable layout`

### P3 (Auswahl)
- Kein `h1` auf der Anwendungsseite; Abschnitte ohne Überschriften
- Esc schließt das Datei-Menü nicht (Dialog, Modi: ja)
- Platzhalter „Name der Planung“ 3,9 : 1 (aria-label vorhanden – geringe Wirkung)
- Warnfarben-Trio `#fdf3e0/#e6c893/#7a4b00` dreifach wörtlich statt als Token
- „Taktische Zeichen“ bricht bei 375 px zweizeilig, Reiter ungleich hoch
- Erklärung des Koordinatengitter-Hakens nur im `title` (Touch zeigt ihn nie)

## Muster

Beide P1 und zwei P2 haben dieselbe Wurzel: **Zustände, die nur ein Eingabekanal
setzen oder verlassen kann** (Fokus nur per Maus zurück, `seite-zu` nur schmal
umkehrbar, Zeichnen nur per Zeiger, Reiter nur per Klick). Die Sorgfalt, die die
Oberfläche für Touch aufbringt, fehlt an vier Stellen für Tastatur und Zustandswechsel.

## Positiv

- Kontrastdisziplin: jede Messprobe ≥ 5,0 : 1, selbst die 62-%-Versionsnummer
- `pointer: coarse` mit ::after-Trefferzonen statt Aufblähung; 44-px-Werkzeuge im Daumenbereich
- `prefers-reduced-motion` erhält Zustände; keinerlei Keyframes/will-change nötig
- Fokusringe überall, mit eigener Weiß-Variante auf der blauen Kopfleiste
- Durchdachte Live-Region-Entscheidung (bewusst KEIN aria-live am Speicherstatus, begründet)
- `escapeHtml` konsequent (81 Verwendungen), Konsole fehlerfrei
- Safe-Area-Insets, gemessene statt geratene Leistenhöhen, `scroll-margin` unter der Sticky-Zeile

## Empfohlene Reihenfolge

1. **[P1] `/impeccable harden`** – Dialog-Fokus (inert, Rückgabe), Esc fürs Menü,
   Tastaturweg zum Punktesetzen, Tablist-Verhalten
2. **[P1] `/impeccable adapt`** – `seite-zu` beim Breitenwechsel auflösen,
   `.ko-zeile`-Trefferhöhen im coarse-Block
3. **[P2] `/impeccable optimize`** – modulepreload-Kette, optional zeichen-daten dynamisch
4. **[P2] `/impeccable layout`** – Kartenoptionen einklappbar
5. **`/impeccable polish`** – Abschlussdurchgang inkl. P3-Splitter
