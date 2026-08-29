# Verwendete Fremdbibliotheken

Beide Bibliotheken liegen unverändert unter `vendor/` im Repository, damit die
Anwendung ohne Netzwerkzugriff auf fremde CDNs auskommt.

| Bibliothek | Version | Lizenz | Herkunft |
|---|---|---|---|
| Leaflet | 1.9.4 | BSD-2-Clause | https://leafletjs.com |
| mgrs (proj4 team) | 2.1.0 | MIT | https://github.com/proj4js/mgrs |

Der vollständige Lizenztext von `mgrs` liegt in `vendor/mgrs.LICENSE.md`,
der von Leaflet im Kopf von `vendor/leaflet/leaflet.js`.

## Kartendienste

Die Kacheldienste werden zur Laufzeit aus dem Browser des Anwenders abgerufen.
Es gelten deren Nutzungsbedingungen:

- **TopPlusOpen** – Bundesamt für Kartographie und Geodäsie (BKG),
  Datenlizenz Deutschland – Namensnennung 2.0 (`dl-de/by-2-0`)
- **OpenStreetMap** – © OpenStreetMap-Mitwirkende, ODbL
- **OpenTopoMap** – CC-BY-SA, Daten aus OpenStreetMap
- **Esri World Imagery** – nur für Sichtprüfung, Nutzungsbedingungen von Esri beachten

Die Quellenangabe wird auf jedem Bauauftrag im Blattfuß mitgedruckt.
