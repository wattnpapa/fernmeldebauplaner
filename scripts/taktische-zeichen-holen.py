#!/usr/bin/env python3
"""Holt die taktischen Zeichen aus jonas-koeritz/Taktische-Zeichen.

Erzeugt aus dem Release-Archiv zwei Dateien, die eingecheckt werden:

    js/zeichen-daten.js       Katalog und SVG-Rumpf aller Zeichen
    fonts/roboto-slab-bold.woff   die Schrift, die die Zeichen benutzen

Warum nicht die SVG-Dateien direkt ausliefern: jede einzelne trägt dieselbe
Schrift als Base64 mit sich (19 KB pro Datei, 19 MB für den ganzen Satz).
Herausgelöst bleiben rund 630 KB Zeichnung übrig, die Schrift kommt einmal
über die CSS-Regel in css/app.css dazu.

    python3 scripts/taktische-zeichen-holen.py [version]

Ohne Argument wird die unten festgeschriebene Version geholt. Der Workflow
.github/workflows/taktische-zeichen.yml liest genau diese Zeile aus, um zu
erkennen, ob es drüben etwas Neueres gibt.
"""

import base64
import io
import json
import re
import sys
import unicodedata
import urllib.request
import zipfile
from pathlib import Path

SAMMLUNG = sys.argv[1] if len(sys.argv) > 1 else "v2.0.0"

REPO = "jonas-koeritz/Taktische-Zeichen"
WURZEL = Path(__file__).resolve().parent.parent


def slug(text):
    """ASCII-Kennung: Umlaute ausschreiben, Rest auf a-z0-9- eindampfen."""
    ers = {"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss", "Ä": "ae", "Ö": "oe", "Ü": "ue"}
    text = "".join(ers.get(c, c) for c in text)
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-").lower()
    return text


def rumpf(svg):
    """Inhalt zwischen <svg> und </svg>, ohne Titel und ohne Schrifteinbettung."""
    svg = re.sub(r"<defs>.*?</defs>", "", svg, flags=re.S)
    svg = re.sub(r"<title>.*?</title>", "", svg, flags=re.S)
    inhalt = re.search(r"<svg[^>]*>(.*)</svg>", svg, flags=re.S)
    if not inhalt:
        raise ValueError("kein <svg>-Element")
    # Die Zeichen kommen mit Tabs und Zeilenumbrüchen; für die Datei reicht
    # eine Zeile je Zeichen.
    return re.sub(r"\s+", " ", inhalt.group(1)).strip()


def titel(svg):
    t = re.search(r"<title>(.*?)</title>", svg, flags=re.S)
    return re.sub(r"\s+", " ", t.group(1)).strip() if t else ""


def schrift(svg):
    """Die eingebettete WOFF-Schrift als Bytes, oder None."""
    m = re.search(r"base64,([A-Za-z0-9+/=]+)", svg)
    return base64.b64decode(m.group(1)) if m else None


def hole_archiv(version):
    url = f"https://github.com/{REPO}/releases/download/{version}/release.zip"
    print(f"Lade {url}", file=sys.stderr)
    with urllib.request.urlopen(url) as antwort:
        return zipfile.ZipFile(io.BytesIO(antwort.read()))


def main():
    archiv = hole_archiv(SAMMLUNG)

    farbe, druck = {}, {}
    for name in archiv.namelist():
        if not name.endswith(".svg"):
            continue
        if name.startswith("print/svg/"):
            druck[name[len("print/svg/"):]] = name
        elif name.startswith("svg/"):
            farbe[name[len("svg/"):]] = name

    if not farbe:
        raise SystemExit("Im Archiv liegen keine SVG unter svg/ — Aufbau geändert?")

    woff = None
    kategorien = {}
    zeichen = {}
    druckabweichung = {}

    for pfad in sorted(farbe):
        quelle = archiv.read(farbe[pfad]).decode("utf-8")
        if woff is None:
            woff = schrift(quelle)

        ordner, datei = pfad.rsplit("/", 1)
        kat = slug(ordner)
        kategorien.setdefault(kat, ordner.replace("_", " ").replace("/", " · "))

        kennung = f"{kat}/{slug(datei[:-4])}"
        if kennung in zeichen:
            raise SystemExit(f"Kennung doppelt: {kennung}")

        koerper = rumpf(quelle)
        zeichen[kennung] = {"n": titel(quelle) or datei[:-4].replace("_", " "), "k": kat, "i": koerper}

        if pfad in druck:
            sw = rumpf(archiv.read(druck[pfad]).decode("utf-8"))
            if sw != koerper:
                druckabweichung[kennung] = sw

    if woff is None:
        raise SystemExit("Keine eingebettete Schrift gefunden — Aufbau geändert?")

    schriftdatei = WURZEL / "fonts" / "roboto-slab-bold.woff"
    schriftdatei.parent.mkdir(exist_ok=True)
    schriftdatei.write_bytes(woff)

    zeilen = [
        "// Erzeugt von scripts/taktische-zeichen-holen.py — nicht von Hand ändern.",
        f"// Quelle: {REPO}, Release {SAMMLUNG}, Exporte unter CC0-1.0.",
        "// Alle Zeichen sind auf viewBox 0 0 256 256 gezeichnet.",
        "",
        f"export const SAMMLUNG = '{SAMMLUNG}';",
        "",
        "export const KATEGORIEN = [",
    ]
    for kat in sorted(kategorien, key=lambda k: kategorien[k]):
        zeilen.append(f"  {{ id: {json.dumps(kat)}, name: {json.dumps(kategorien[kat])} }},")
    zeilen += ["];", "", "export const ZEICHEN = {"]
    for kennung in sorted(zeichen):
        z = zeichen[kennung]
        zeilen.append(
            f"  {json.dumps(kennung)}: {{ n: {json.dumps(z['n'])}, k: {json.dumps(z['k'])}, "
            f"i: {json.dumps(z['i'])} }},"
        )
    zeilen += ["};", "", "// Nur die Zeichen, deren Druckfassung von der farbigen abweicht.", "export const DRUCK = {"]
    for kennung in sorted(druckabweichung):
        zeilen.append(f"  {json.dumps(kennung)}: {json.dumps(druckabweichung[kennung])},")
    zeilen += ["};", ""]

    ziel = WURZEL / "js" / "zeichen-daten.js"
    ziel.write_text("\n".join(zeilen), encoding="utf-8")

    print(
        f"{len(zeichen)} Zeichen in {len(kategorien)} Kategorien, "
        f"{len(druckabweichung)} mit eigener Druckfassung, "
        f"{ziel.stat().st_size // 1024} KB",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
