# Lizenzen

FMBauplaner selbst steht unter der **EUPL-1.2**, siehe `LICENSE`. Diese Datei führt
auf, was zusätzlich mitgeliefert oder zur Laufzeit abgerufen wird.

## Verwendete Fremdbibliotheken

Beide Bibliotheken liegen unverändert unter `vendor/` im Repository, damit die
Anwendung ohne Netzwerkzugriff auf fremde CDNs auskommt.

| Bibliothek | Version | Lizenz | Herkunft |
|---|---|---|---|
| Leaflet | 1.9.4 | BSD-2-Clause | https://leafletjs.com |
| mgrs (proj4 team) | 2.1.0 | MIT | https://github.com/proj4js/mgrs |

Der vollständige Lizenztext von `mgrs` liegt in `vendor/mgrs.LICENSE.md`,
der von Leaflet im Kopf von `vendor/leaflet/leaflet.js`.

## Taktische Zeichen

Die taktischen Zeichen stammen aus der Sammlung
[jonas-koeritz/Taktische-Zeichen](https://github.com/jonas-koeritz/Taktische-Zeichen),
Release `v2.0.0`. Die fertigen Exporte aus dem Release-Archiv stehen unter
**CC0-1.0** (Gemeinfreiheit), der Quelltext der Sammlung unter **CC BY 4.0**.

Mitgeliefert werden:

| Datei | Inhalt | Lizenz |
|---|---|---|
| `js/zeichen-daten.js` | 894 Zeichen als SVG-Rumpf, erzeugt aus dem Release-Archiv | CC0-1.0 |
| `fonts/roboto-slab-bold.woff` | Roboto Slab Bold, die Beschriftungsschrift der Zeichen | Apache-2.0 |

`scripts/taktische-zeichen-holen.py` erzeugt beide Dateien neu;
`.github/workflows/taktische-zeichen.yml` prüft wöchentlich auf ein neueres
Release der Sammlung.

Die Schrift Roboto Slab ist Teil der Sammlung und dort in jedes einzelne Zeichen
eingebettet; hier liegt sie einmal separat. Roboto Slab steht unter der
Apache License 2.0 (https://github.com/googlefonts/robotoslab).

## Reichweitenmessung

`js/`-fremdes Skript, das zur Laufzeit von einem fremden Server geladen wird:
`count.js` von **GoatCounter** (`gc.zgo.at`), eingebunden in `index.html`.
GoatCounter steht unter der **EUPL-1.2**, Quellcode:
https://github.com/arp242/goatcounter. Was dabei übertragen wird und wie sich die
Zählung abschalten lässt, steht in `datenschutz.html`.

## Kartendienste

Die Kacheldienste werden zur Laufzeit aus dem Browser des Anwenders abgerufen.
Es gelten deren Nutzungsbedingungen:

- **TopPlusOpen** – Bundesamt für Kartographie und Geodäsie (BKG),
  Datenlizenz Deutschland – Namensnennung 2.0 (`dl-de/by-2-0`)
- **OpenStreetMap** – © OpenStreetMap-Mitwirkende, ODbL
- **OpenTopoMap** – CC-BY-SA, Daten aus OpenStreetMap
- **Esri World Imagery** – nur für Sichtprüfung, Nutzungsbedingungen von Esri beachten

Die Quellenangabe wird auf jedem Bauauftrag im Blattfuß mitgedruckt.
