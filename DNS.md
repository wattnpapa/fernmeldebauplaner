# DNS-Einträge für fmbauplaner.app

Die Anwendung liegt auf GitHub Pages im Repository `wattnpapa/fernmeldebauplaner`.
Die Domain ist in den Repository-Einstellungen hinterlegt, die Datei `CNAME` im
Wurzelverzeichnis hält sie zusätzlich im Repository fest.

## Pflichteinträge für die Apex-Domain

Beim Domainanbieter für `fmbauplaner.app` anlegen — Name/Host bleibt leer
bzw. `@`, je nach Oberfläche:

| Typ | Name | Wert | TTL |
|---|---|---|---|
| A | `@` | `185.199.108.153` | 3600 |
| A | `@` | `185.199.109.153` | 3600 |
| A | `@` | `185.199.110.153` | 3600 |
| A | `@` | `185.199.111.153` | 3600 |
| AAAA | `@` | `2606:50c0:8000::153` | 3600 |
| AAAA | `@` | `2606:50c0:8001::153` | 3600 |
| AAAA | `@` | `2606:50c0:8002::153` | 3600 |
| AAAA | `@` | `2606:50c0:8003::153` | 3600 |

Alle vier A-Einträge anlegen, nicht nur einen – GitHub verteilt die Last darüber.
Die AAAA-Einträge sind für IPv6 und gehören dazu.

Unterstützt der Anbieter **ALIAS**, **ANAME** oder **CNAME-Flattening** auf der
Apex-Domain, ist stattdessen ein einzelner Eintrag auf `wattnpapa.github.io`
die bessere Wahl: GitHub kann die Adressen dann ändern, ohne dass etwas kaputtgeht.

## www-Variante (empfohlen)

| Typ | Name | Wert | TTL |
|---|---|---|---|
| CNAME | `www` | `wattnpapa.github.io.` | 3600 |

GitHub leitet `www.fmbauplaner.app` dann automatisch auf die Apex-Domain um.

## Domain verifizieren (empfohlen)

Verhindert, dass jemand anders die Domain für seine Pages-Seite beansprucht,
falls das Repository einmal gelöscht wird. Den Code holt man sich unter
**GitHub → Settings → Pages → Verified domains → Add a domain**:

| Typ | Name | Wert |
|---|---|---|
| TXT | `_github-pages-challenge-wattnpapa` | (Code aus der GitHub-Oberfläche) |

## Wichtig bei `.app`

`.app` steht auf der **HSTS-Preload-Liste**. Browser rufen die Domain deshalb
ausschließlich über HTTPS auf – einen HTTP-Fallback gibt es nicht. Praktisch heißt das:

1. DNS-Einträge setzen und Auflösung abwarten (meist Minuten, laut TTL bis zu 24 h).
2. GitHub stellt danach automatisch ein Let's-Encrypt-Zertifikat aus. Das dauert
   ab korrekter DNS-Auflösung typischerweise wenige Minuten bis zu einer Stunde.
3. Erst dann **Settings → Pages → Enforce HTTPS** aktivieren (bzw. prüfen, dass
   der Haken gesetzt ist). Vorher meldet GitHub „Certificate not yet created".

Bis dahin ist die Seite unter `https://wattnpapa.github.io/fernmeldebauplaner/`
erreichbar.

## Prüfen

```bash
dig +short fmbauplaner.app A
dig +short fmbauplaner.app AAAA
curl -sI https://fmbauplaner.app | head -3
gh api repos/wattnpapa/fernmeldebauplaner/pages
```

In der letzten Ausgabe sollen `status` auf `built` und `https_enforced` auf `true` stehen.
