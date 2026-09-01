---
name: FMBauplaner
description: GIS-Planungswerkzeug für den Fernmeldebau des THW – vom Bildschirm zum druckfertigen Bauauftrag
colors:
  thw: "#003399"
  thw-hell: "#0a4fbf"
  thw-blass: "#e8eefb"
  grund: "#eef1f6"
  flaeche: "#ffffff"
  flaeche-2: "#f7f9fc"
  linie: "#d5dce6"
  linie-stark: "#b6c1d1"
  text: "#16202e"
  text-schwach: "#5c6879"
  gefahr: "#c62828"
  warnung: "#b26a00"
  warnung-flaeche: "#fdf3e0"
  warnung-linie: "#e6c893"
  warnung-tief: "#7a4b00"
  gut: "#1b7a3d"
typography:
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.45
  titel:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "13.5px"
    fontWeight: 600
    lineHeight: 1.45
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  bedienschrift:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 550
    lineHeight: 1.45
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.6px"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
rounded:
  mini: "4px"
  klein: "5px"
  standard: "8px"
  dialog: "10px"
spacing:
  fuge: "6px"
  reihe: "8px"
  kachel: "10px"
  tafel: "12px"
  gruppe: "14px"
components:
  knopf:
    backgroundColor: "{colors.flaeche}"
    textColor: "{colors.text}"
    rounded: "{rounded.klein}"
    padding: "7px 12px"
  knopf-primaer:
    backgroundColor: "{colors.thw}"
    textColor: "{colors.flaeche}"
    rounded: "{rounded.klein}"
    padding: "7px 12px"
  knopf-primaer-hover:
    backgroundColor: "{colors.thw-hell}"
  knopf-klein:
    backgroundColor: "{colors.flaeche}"
    textColor: "{colors.text}"
    rounded: "{rounded.klein}"
    padding: "4px 9px"
  feld-eingabe:
    backgroundColor: "{colors.flaeche}"
    textColor: "{colors.text}"
    rounded: "{rounded.klein}"
    padding: "6px 9px"
  eintrag:
    backgroundColor: "{colors.flaeche}"
    rounded: "{rounded.standard}"
  hinweisbox:
    backgroundColor: "rgba(20,28,40,.95)"
    textColor: "#ffffff"
    rounded: "20px"
    padding: "9px 16px"
---

# Design System: FMBauplaner

## Overview

**Creative North Star: „Das Blatt hinter dem Glas“**

Die Oberfläche ist das Werkzeug, das ein amtliches Blatt erzeugt – Bauauftrag,
Sammel-Bauauftrag, Lagekarte. Der Bildschirm ahmt das Papier nie nach, aber er
dient ihm: harte Kanten statt weicher Höfe, Formularsprache statt App-Sprache,
und die Ausgabezeile klebt am unteren Rand jeder Streckenkarte, weil das
Erzeugnis nie mehr als null Scrolls entfernt sein darf. Wo die Vorschrift einen
Wert kennt, steht er mit Gliederungsnummer am Entscheidungsort.

Der Charakter der Bedienung ist **dienstlich-präzise**: wie gutes Gerät –
klare Rastung, keine Verzierung, jede Fläche hat einen Zweck. Die Dichte ist
die eines Fachwerkzeugs (Operate), nicht die einer Broschüre; sie wächst auf
Touchgeräten in der Trefferzone, nie im Sichtbaren. Bestätigte Abgrenzung:
**kein GIS-Profi-Wust** – keine Werkzeugleisten-Gebirge, keine Menübäume;
Mächtigkeit darf nie Einweisung verlangen.

**Key Characteristics:**
- Vom gedruckten Erzeugnis her komponiert; die Karte ist der Weg, das Blatt das Ziel
- Eine einzige Bedienfarbe (THW-Blau); Streckenfarben sind Daten
- Systemschrift, Ziffern tabellarisch, Koordinaten in Mono – funktauglich
- Harte, gerichtete Schatten; Tiefe erklärt Zustand, nie Dekoration
- Fachsprache und Fundstellen der KatS-Dv 861 als sichtbarer Teil der Oberfläche

## Colors

Ein einziges kräftiges Blau führt; alles andere ist blaugestimmtes Grau oder
eine Meldung mit fester Bedeutung.

### Primary
- **THW-Blau** (#003399): die einzige Bedienfarbe – Kopfzeile, Primärknöpfe,
  aktive Reiter, gewählte Einträge, Fokusringe (als Hellstufe). Zugleich die
  Markenfarbe des Trägers.
- **THW-Blau hell** (#0a4fbf): Hover- und Fokusstufe des Blaus; nie eigenständig.
- **THW-Blass** (#e8eefb): Auswahl- und Summenflächen – „hier ist etwas aktiv“,
  ohne zu leuchten.

### Neutral
- **Grund** (#eef1f6): die Werkbank hinter allem; kühles Blaugrau.
- **Fläche** (#ffffff): Karten, Tafeln, Eingaben – das Papier des Bildschirms.
- **Fläche 2** (#f7f9fc): abgesetzte Innenflächen (Kennzahlen, Punktzeilen, Menü-Hover).
- **Linie** (#d5dce6) / **Linie stark** (#b6c1d1): Trennung fast immer über
  1-px-Linien statt über Schatten; „stark“ trägt Bedienelement-Ränder.
- **Marineschwarz** (#16202e): Text – ein Schwarz mit dem Blau der Marke darin.
- **Text schwach** (#5c6879): Zweitinformationen; besteht überall ≥ 4,5:1.

### Meldefarben
- **Gefahr** (#c62828): Löschen, Fehler; stets mit eigener Randfarbe abgesetzt.
- **Warnung** (#b26a00) mit **Warnfläche** (#fdf3e0), **Warnlinie** (#e6c893),
  **Warnton tief** (#7a4b00): der Mahnton (ungesichert, Grenzwert überschritten)
  spricht in einer Sprache – Fläche, Linie und Tiefton wandern gemeinsam.
- **Gut** (#1b7a3d): Bestätigungen, sparsam.

### Named Rules
**Die Ein-Stimme-Regel.** THW-Blau ist die einzige Bedienfarbe der Oberfläche.
Die zehn Streckenfarben sind Nutzdaten (`--farbe` je Element), niemals
Gestaltung – eine neue Bedienfarbe gibt es nicht.

**Die Farbe-plus-Fettung-Regel.** Eine Warnung trägt nie Farbe allein, sondern
immer Farbe **und** Fettung – wegen Tageslicht auf blassen Schirmen und weil
im Schwarz-Weiß-Druck jede Farbe verschwindet.

## Typography

**Bildschirmschrift:** Systemschrift-Kette (-apple-system … Segoe UI … Roboto … Arial)
**Zahlen/Koordinaten:** ui-monospace-Kette (SF Mono, Menlo, Consolas)
**Zeichenbeschriftung:** Roboto Slab Bold – ausschließlich für die Kürzel der
taktischen Zeichen; die Sammlung setzt sie voraus
**Druckerzeugnis:** Helvetica Neue/Helvetica/Arial (8.6 pt auf A4, 10 pt auf A3)

**Character:** Unaufgeregt und amtsfähig. Die Systemschrift läuft auf jedem
OV-Rechner ohne Webfont; Charakter entsteht aus Gewichtsstufen (400/550/600/650/700)
und Ziffernbehandlung, nicht aus einer Schmuckschrift.

### Hierarchy
- **Headline** (700, 15 px): Wortmarke und Dialogtitel – die größte Schrift der
  Anwendung; alles darüber gehört dem Blatt.
- **Titel** (600, 13.5 px): Namen von Strecken, Zeichen, Listeneinträgen.
- **Body** (400, 14 px, 1.45): Grundtext; Formulare und Menüs 13 px.
- **Bedienschrift** (550, 13 px): Knöpfe – halbfett genug für Tageslicht.
- **Label** (600, 11 px, +0.6 px, VERSALIEN): Gruppentitel, Rubriken der
  Statusleiste, Kennzahlen-Beschriftung.
- **Mono** (400, 12 px, tabular): MGRS, GPS, Datum-Zeit-Gruppe – alles, was
  über Funk durchgegeben oder abgetippt wird.

### Named Rules
**Die 11-Pixel-Regel.** Keine Schrift der Oberfläche unterschreitet 11 px –
sie wird bei Tageslicht auf kleinen Schirmen gelesen.

**Die Ziffern-Regel.** Wo Zahlen stehen, stehen sie tabellarisch
(`font-variant-numeric: tabular-nums`); Koordinaten und Zeitgruppen zusätzlich
in Mono. Werte müssen untereinander fluchten wie im Formular.

## Layout

Blaue Kopfzeile (52 px) über Speicherband und Arbeitsfläche; links die
Seitenleiste (372 px) mit drei Reitern, rechts die Karte mit aufgesetzten
Tafeln (Werkzeuge, Kartenoptionen, Statusleiste), alle mit 12 px Randabstand.
Unter 900 px lösen Liste und Karte einander ab; der Umschalter (52 px plus
Safe-Area) ist der einzige, immer sichtbare Rückweg. Leistenhöhen werden zur
Laufzeit **gemessen** und als CSS-Variablen gesetzt (`--sl-hoehe`,
`--karten-kopf` …) – geratene Festwerte sind hier schon einmal falsch geworden.

Der Raumrhythmus ist eng und regelmäßig: 6 px Fuge, 8 px Reihe, 10 px
Kachel-Innenraum, 12 px Tafel-Polster, 14 px Gruppenabstand. Dichte ist
gewollt (Fachwerkzeug), Gruppierung entsteht über Nähe und 1-px-Linien, nicht
über verschachtelte Kästen – Einsatzabschnitte klammern ihre Strecken mit
einer 2-px-Kante links statt mit einem zweiten Rahmen. Auf groben Zeigern
(`pointer: coarse`) wachsen ausschließlich die Trefferzonen (::after-Flächen
auf ~44 px); die sichtbare Dichte bleibt.

## Elevation & Depth

Erhebung in einer Sprache: ein knapper Kontaktschatten, darüber ein
gerichteter Abwurf von etwa doppelter Weichzeichnung – **kein breiter Hof**,
denn das gedruckte Erzeugnis dieses Programms hat harte Kanten, und die
Oberfläche verwischt sie nicht. Flächen sind standardmäßig flach und durch
Linien getrennt; Schatten tragen nur die Schichten, die wirklich über der
Karte oder dem Inhalt liegen.

### Shadow Vocabulary
- **Schatten** (`0 1px 2px rgba(16,32,56,.08), 0 4px 9px rgba(16,32,56,.12)`):
  Kopfzeile, Kartenaufsätze – die Normalerhebung.
- **Schatten stark** (`0 2px 4px rgba(16,32,56,.12), 0 8px 14px rgba(16,32,56,.22)`):
  Menü, Dialog, Modusleiste, Hinweisbox – was über allem schwebt.
- **Schatten oben** (gespiegelt): Leisten an der Unterkante (Umschalter).
- **Ausgabezeile** (`0 -2px 7px -4px rgba(16,32,56,.30)`): bewusst
  zurückgenommen – sie zeigt den Durchlauf des Inhalts, hebt die Zeile aber
  nicht ab.

### Named Rules
**Die Druckkanten-Regel.** Schatten haben Versatz und kurze Weichzeichnung;
ein farbiger Hof ohne Versatz ist Dekoration und kommt nicht vor.

## Shapes

Ruhige Rechtecke mit knappen Rundungen: 8 px für Karten und Tafeln, 5 px für
Bedienelemente, 4 px für Kleinstknöpfe, 10 px für den Dialog. Die einzige
Pille ist die Hinweisbox (20 px) – eine flüchtige Meldung, kein Möbelstück.

Kanten tragen Bedeutung: Ergebniskästen (Querschnitt, Reichweite) führen eine
3-px-Kante links in der Aussagenfarbe; Maßetiketten auf der Karte tragen die
Streckenfarbe als linke Kante; Einsatzabschnitte klammern mit einer 2-px-Kante.
Auf der Karte ist die Form Semantik: Kreis = Trassenpunkt, Quadrat =
Muffe/Verteiler, 45°-Raute = Querung, gefüllt = Anfang/Ende.

## Components

### Knöpfe
- **Form:** knapp gerundet (5 px), 1-px-Rand in Linie stark.
- **Standard:** weiße Fläche, Marineschwarz, Rand wird beim Hover THW-Blau hell.
- **Primär:** THW-Blau gefüllt, weiß; Hover eine Stufe heller. Je Ansicht
  führt genau ein Primärknopf.
- **Gefahr:** rote Schrift auf weiß mit rötlichem Rand; füllt sich nie.
- **Gesperrt:** 42 % Deckkraft – und der **Grund steht daneben** im Klartext,
  nie nur im `title`.
- **Coarse:** min. 44 px Höhe (kleine Knöpfe 40 px mit ::after-Zone).

### Werkzeugknopf (Signatur)
Beschriftete Zeile statt Icon-Rätsel: Glyphe, Wort und – nur am feinen
Zeiger – die Taste als gerahmtes Kürzel (`S`, `T`, `K`). Aktiv füllt sich die
Zeile THW-blau. Auf Touch wandert die Leiste als 2×2-Raster in den
Daumenbereich.

### Eintragskarten (Strecken, Zeichen)
Weiße Karte, 8 px, 1-px-Rand; geöffnet: blauer Rand plus 1-px-Blauring und
blasse Kopfzeile. Am Fuß der geöffneten Streckenkarte klebt die
**Ausgabezeile** (`position: sticky`) mit dem Bauauftrag-Knopf – das Erzeugnis
scrollt nie weg. Ausgeblendete Einträge treten als Ganzes zurück (Farbe und
Name verblassen, das Auge warnfarben).

### Felder
Titel klein und halbfett über der Eingabe; Eingabe weiß, 5 px, Rand Linie
stark; Einheiten (`m`, `%`) stehen im Feld rechts. Fokus überall als
2-px-Ring in THW-Blau hell – auf der blauen Kopfzeile in Weiß.

### Reiter
Drei gleichbreite Reiter mit 2-px-Unterkante; aktiv: THW-Blau auf weißer
Fläche. Pfeiltasten wechseln, Tab betritt das Reiterwerk genau einmal.

### Dialog & Menü
Dialog mittig (max. 560/880 px), 10 px, starker Schatten, Fuß mit
rechtsbündigen Knöpfen; der Hintergrund wird `inert`, der Fokus kehrt zum
Auslöser zurück. Das Datei-Menü ist eine weiße Tafel mit Hover in THW-Blass.

### Hinweisbox
Dunkle Pille, zentriert unten, verschwindet von selbst (3,2 s / 6 s bei
Fehlern); Fehler füllen sich Gefahr-rot, Warnungen Warnung-orange.

### Kennzahlen
Vier flache Kacheln (Fläche 2, 1-px-Rand): Versalien-Label über tabellarischer
Zahl. Schmal zwei statt vier nebeneinander, damit „309,67 km“ nie umbricht.

### Die Druckwelt (Signatur)
Das Blatt ist eine eigene Welt: Helvetica auf Weiß, VS-Band oben, Kopf wie ein
Formular, Kilometergitter mit Randzahlen, Zeichenerklärung, Kennzahlenband und
Unterschriftenfelder. Im Schwarz-Weiß-Druck unterscheiden **Strichmuster**
die Strecken und die Karte wechselt auf die amtliche Graustufenquelle – nie
CSS-Filter (Firefox druckt gefilterte Bereiche nicht). Auf dem Bildschirm
liegt das Blatt beschattet auf dunkler Bühne; gedruckt hat es keinerlei
Bildschirm-Zierde.

## Do's and Don'ts

### Do:
- **Do** Tastenkürzel sichtbar in die Beschriftung schreiben (`Fertig (Enter)`,
  Tastenkästchen im Werkzeugknopf) – `title` zeigt kein Touchgerät.
- **Do** den Grund einer Sperrung neben das gesperrte Element stellen
  (`.ausgabe-grund`), im Klartext.
- **Do** Trefferzonen bei `pointer: coarse` über ::after aufziehen –
  senkrecht großzügig, waagerecht nie über die Fuge zum Nachbarn.
- **Do** fachliche Werte mit ihrer Dv-861-Gliederungsnummer zeigen – am
  Bauort wird nach der Nummer gesucht.
- **Do** Zustände doppelt tragen: Farbe **und** Fettung, Symbol **und**
  Zeilenverhalten (ausgeblendete Einträge verblassen als Ganzes).
- **Do** neue Farben und Maße ausschließlich über die `:root`-Variablen von
  `css/app.css` einführen.

### Don't:
- **Don't** eine zweite Bedienfarbe neben THW-Blau einführen; Streckenfarben
  bleiben Daten.
- **Don't** Schrift unter 11 px setzen – auch nicht in Fremd-Overrides.
- **Don't** breite, versatzlose Schattenhöfe oder Glanz verwenden; die
  Druckkanten-Regel gilt überall.
- **Don't** Funktionen hinter Werkzeugleisten-Gebirgen oder Menübäumen
  stapeln (bestätigte Abgrenzung: kein GIS-Profi-Wust) – jede neue Funktion
  muss ohne Einweisung auffindbar sein, notfalls über gestufte Enthüllung.
- **Don't** Icon-Fonts, Emoji oder Icon-Bibliotheken einbinden; Sinnbilder
  sind sparsame Textglyphen des Bestands oder eigenes Inline-SVG in einer
  Strichstärke.
- **Don't** im Druckpfad „vereinfachen“, was als Firefox-Umgehung kommentiert
  ist (Graustufen-Kachelquelle, `mix-blend-mode: normal`) – vier Formate in
  Farbe und S/W sind der Prüfmaßstab.
