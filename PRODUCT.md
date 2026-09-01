# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Maßgebender Nutzer (bestätigt):** die planende Führungskraft im Ortsverband –
Zugführer bzw. Führungstrupp (etwa der FGr Kommunikation). Sie plant am
Schreibtisch vor Übung oder Einsatz, ermittelt Längen und Material und gibt
je Strecke einen Bauauftrag an die Trupps. Auf sie werden Entscheidungen
optimiert.

**Empfänger der Erzeugnisse (aus dem Bestand belegt):** Sie sind Prüfsteine,
nicht Bediener –

- der **Fernmeldebautrupp** am Bauort: gedruckter Bauauftrag in der Hand,
  Handschuhe, Tageslicht, ggf. Telefon zum Nachschlagen;
- die **Führungsstelle**: Lagekarte bis A0 an der Wand, gelesen aus zwei Metern;
- der **Zugführer unterwegs**: prüft einen Bauauftrag am Telefon oder Tablet im
  Fahrzeug, bevor er ihn freigibt.

## Product Purpose

GIS-Planungswerkzeug für den Fernmeldebau, ausgelegt auf die Arbeitsweise des
THW: Strecken auf der Karte planen, Längen und Materialbedarf ermitteln,
druckfertige Bauaufträge, Sammel-Bauaufträge und Lagekarten ausgeben.

**Erfolg (bestätigt):** In zwei Jahren nutzen viele Ortsverbände den
FMBauplaner wie selbstverständlich für Fernmeldebau-Planungen – Etablierung
im THW, nicht Verbreitung um jeden Preis.

## Positioning

Was ein Nachbarprodukt nicht wahrheitsgemäß kopieren könnte:

- Die fachlichen Werte und Auflagen der **KatS-Dv 861** stehen mit
  Gliederungsnummer am Entscheidungsort (Querungsarten, Mindesthöhen,
  Genehmigungspflichten) – am Bauort wird nach der Nummer gesucht.
- Das Werkzeug ist **vom gedruckten Erzeugnis her komponiert**: Bauauftrag,
  Sammel-Bauauftrag und Lagekarte sind das Produkt, die Karte ist der Weg dorthin.
- Es läuft **vollständig im Browser** – kein Server, kein Konto, keine
  Installation; einsetzbar auf jedem OV-Rechner ohne IT-Freigabeprozess.
- **894 taktische Zeichen** (davon 108 Fernmeldewesen) mit eigener
  S/W-Druckfassung, durchgängig MGRS/UTMREF samt Kilometergitter auf Karte
  und Ausdruck.

## Operating Context

- **Planung** am Schreibtisch mit Maus und Tastatur; Druck-Referenzbrowser ist
  Firefox auf macOS (dort entstehen und prüfen sich die PDFs).
- **Vorplanung** kommt teils aus Google Earth (KML/KMZ); zurückgegeben wird an
  Google Earth, Hand-GPS (GPX) und Excel (CSV).
- **Koordinaten** werden über Funk als MGRS durchgegeben – Eingabe und Anzeige
  müssen dieses Format ohne Umweg beherrschen.
- **Am Bauort**: Touchbedienung mit Handschuh bei Tageslicht; `title`-Tooltips
  existieren dort nicht.
- **Ausgabe**: Bürodrucker A4/A3 in Farbe und Schwarz-Weiß (Strichmuster statt
  Farbe); Lagekarten als PDF an Plotter bis A0 und Rollenmaß.
- **Geräte-Realität**: geteilte OV-Rechner und private Fenster – der Verlust
  ungesicherter Planungen ist ein reales Risiko, dem Mahnband, Sicherungsstand
  und `beforeunload` begegnen.

## Capabilities and Constraints

Funktionsumfang im Detail: siehe `README.md` (Strecken, Einsatzabschnitte,
Zeichengruppen, Rechengrößen, Koordinaten, drei Druckerzeugnisse, Austauschformate).

**Technische Randbedingungen (Ist-Stand, bewusst gewählt):**

- Statische Seite ohne Build-Schritt, reines ES-Modul-JavaScript, Fremdcode
  entpackt unter `vendor/` (Regeln in `CLAUDE.md`).
- Alle Pfade relativ; läuft auch im Unterverzeichnis.
- Zustand ausschließlich über `js/state.js` (`store.aendern`), Schema-Migration
  für echte Planungen im `localStorage`.
- Version setzt der Veröffentlichungs-Workflow (`YYYY.MMDD.HHMM`); jeder Push
  auf `main` veröffentlicht sofort auf fmbauplaner.app.
- Genauigkeitsgrenzen sind dokumentiert und bleiben ehrlich benannt:
  geodätische Direktstrecken plus Bauzuschlag, Querschnitt als
  Planungsrichtwert – verbindliche Auslegung durch die Elektrofachkraft.

**Bewusst NICHT als ewige Zusage markiert (Interview 2026-09-01):**
„Daten nur auf dem Gerät“, „ohne Build-Schritt“ und „Dv-861-Treue mit
Fundstelle“ sind heutige, absichtsvolle Entscheidungen – aber revidierbar,
wenn eine künftige Produktentscheidung es verlangt. Wer die Datenzusage
anfasst, ändert zugleich `datenschutz.html`; sie bricht kein Feature nebenbei.

**Terminologie:** Die Fachsprache des Fernmeldebaus ist verbindlich – Trasse,
Muffe, Endverzweiger, Kabelreserve, Bauzuschlag, Trommellänge, Verlegeleistung,
Einsatzabschnitt, Datum-Zeit-Gruppe. Keine App-Umschreibungen.

## Brand Commitments

- **Name:** FMBauplaner; Wortmarke „FM|Bauplaner“ mit Kabelzeichen-Bildmarke;
  Domain fmbauplaner.app.
- **Farbe:** THW-Blau `#003399` als Bedienfarbe der Oberfläche.
- **Sprache:** durchgehend Deutsch – Oberfläche, Bezeichner, Commits; Typografie
  mit „deutschen Anführungszeichen“, Gedankenstrich, geschütztem Leerzeichen
  vor Einheiten, Malzeichen × (Regeln in `CLAUDE.md`).
- **Ton:** sachlich-fachlich; die Sprache des Formulars und des Funkverkehrs,
  nicht die einer App („Auftrag an (Trupp)“, „F.d.R.“, VS-Einstufung).
- **Lizenz:** EUPL-1.2; Fremdanteile in `LIZENZEN.md`.

## Evidence on Hand

- **Taktische Zeichen:** Sammlung jonas-koeritz/Taktische-Zeichen (CC0),
  erzeugt nach `js/zeichen-daten.js` + `fonts/roboto-slab-bold.woff`;
  wöchentlicher Auffrisch-Workflow mit Prüfskript.
- **Vorschrift:** Werte und Auflagen der KatS-Dv 861 in `js/vorschrift.js`,
  jeweils mit Gliederungsnummer als Fundstelle.
- **Kabeldaten:** Trommellängen, Gewichte und Dämpfungswerte der
  Feldkabel-Familie nach Datenblättern t-fkb.de.
- **Kartengrundlagen:** BKG TopPlusOpen (farbig/grau/hell), OpenStreetMap,
  OpenTopoMap, Esri-Luftbild – Lizenzpflichten (dl-de/by-2-0, ODbL) werden auf
  jedem Blatt erfüllt.
- **Reichweite:** GoatCounter zählt anonyme Aufrufe – echte Zahlen vorhanden.
- **Nicht vorhanden (nichts erfinden):** Testimonials, Fallstudien,
  Nutzerzahlen je OV, offizielle THW-Anerkennung.

## Product Principles

1. **Das gedruckte Blatt ist das Produkt** (bestätigte Dauerzusage). Bauauftrag,
   Sammel-Bauauftrag und Lagekarte haben Vorrang; die Bildschirm-Oberfläche
   dient ihnen. Alle vier Formate (A4/A3 × hoch/quer) in Farbe und S/W sind
   der Prüfmaßstab jeder Änderung am Druckpfad.
2. **Für die planende Führungskraft gebaut, an den Empfängern gemessen.**
   Entscheidungen optimieren den Planenden am Schreibtisch; Trupp am Bauort,
   Führungsstelle an der Wand und Zugführer am Telefon sind die Prüfsteine
   jeder Ausgabe.
3. **Fachsprache vor App-Konvention.** Begriffe, Formularaufbau und
   Koordinatenformate folgen dem Fernmeldebau und dem Funkverkehr, nicht den
   Gewohnheiten von Web-Oberflächen.
4. **Selbstverständlich im OV-Alltag.** Etablierung im THW entsteht dadurch,
   dass das Werkzeug ohne Einweisung, ohne Installation und auf dem läuft, was
   ein Ortsverband hat – Browser, geteilte Rechner, Bürodrucker, Plotter.
5. **Zusagen brechen nicht nebenbei.** Was `datenschutz.html` und die
   dokumentierten Genauigkeitsgrenzen versprechen, ändert nur eine
   ausdrückliche Produktentscheidung – kein Feature als Nebenwirkung.

## Accessibility & Inclusion

Keine förmliche Norm-Vorgabe erhoben. Faktische, aus dem Einsatzumfeld
abgeleitete Anforderungen (aus dem Bestand belegt): Lesbarkeit bei Tageslicht
auf kleinen Schirmen (Schriftuntergrenze 11 px), Handschuhbedienung
(Trefferzonen ~44 px bei `pointer: coarse`), vollständige Tastaturbedienbarkeit
einschließlich Streckenerfassung über Koordinateneingabe, Farbe nie als
einziger Träger einer Aussage (S/W-Druck, Warnungen mit Farbe **und** Fettung).
