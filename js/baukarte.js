// baukarte.js – Baumodus auf der Karte: Bauleiste, Punktkarte und Ortung

/* Am Bauort steht die Anwendung auf einem Telefon, und dort liegt die Liste
   VOR der Karte – wer einen Punkt aufnehmen will, muss erst umschalten,
   dann rollen, dann treffen. Dieses Modul legt die drei Handgriffe des
   Baumodus auf die Karte selbst: die Bauleiste unten im Daumenbereich nimmt
   den Punkt auf, die Punktkarte darüber sagt, was an der Stelle ist.

   Die Liste im Bau-Reiter (`ui.js`) bleibt vollständig; sie ist der Bogen,
   auf dem am Ende alles steht. Hier steht nur, was am Bauort in der Hand
   gebraucht wird – und beides schreibt in denselben `bau`-Block, über
   dieselben Fabriken in `baudoku.js`.

   Kein Import aus `ui.js`: das Modul wird von dort aus gebraucht (die Ortung
   dient beiden Listen), und ein Ring zwischen beiden liefe beim Laden ins
   Leere. Was aus der Oberfläche gebraucht wird – Hinweisbox, Modusleiste,
   Ansichtswechsel –, reicht `app.js` beim Start herein. */

import { store, punktartById } from './state.js';
import { QUERUNG_BAUWEISEN } from './vorschrift.js';
import {
  istPunkte, istZuSoll, sollZuIst, istPunktSetzen, istArtSetzen, bauabschnittById,
  baustrecke, baustreckeSetzen, aktiverBauabschnitt, quelleText,
  punktartText, ABWEICHUNG_SCHWELLE
} from './baudoku.js';
import { toMGRS, formatLaenge, distanz } from './geo.js';
import { escapeHtml } from './strecken.js';

let ctx = null;   // { karte, sl, hinweis, hinweisAus, modusAnzeigen, zurKarte }

export function initBaukarte(kontext) { ctx = kontext; }

const hinweis = (text, art) => ctx && ctx.hinweis(text, art);
const hinweisAus = () => ctx && ctx.hinweisAus();

// ---------------------------------------------------------------- Ortung

/**
 * Die Ortung durch das Gerät – der eine der drei Wege, der schiefgehen kann:
 * im Gebäude, unter Bewuchs, ohne Freigabe. Er meldet das im Klartext, denn
 * ein Punkt, der still auf einer alten Position landet, wäre schlimmer als
 * keiner.
 *
 * Gehalten werden nur die KENNUNGEN von Strecke und Punkt, nicht die Objekte.
 * Zwischen dem Griff und der Antwort des Geräts liegen bis zu zwölf Sekunden,
 * und in dieser Zeit kann ein Rückgängig, ein Wiederholen oder ein Stand vom
 * angebundenen Speicher den ganzen Objektbaum austauschen (`store.undo` in
 * `state.js` setzt `projekt` neu). Ein festgehaltenes Streckenobjekt gehörte
 * danach zu keiner Planung mehr: die Aufnahme liefe ins Leere, während die
 * Meldung „Aufgenommen“ sagt. Derselbe Grund, aus dem der Kartenweg in
 * `strecken.js` die Strecke erst im Klickmoment nachschlägt.
 *
 * `o.ersetzt` nennt einen aufgenommenen Punkt, der die neue Koordinate
 * bekommt – seine Art, Bemerkung und Zuordnung bleiben ihm (`istPunktSetzen`).
 * `o.danach(s, pt)` läuft, wenn der Punkt steht; die Karte schlägt damit die
 * Punktkarte auf, die Liste braucht das nicht.
 */
export function istPunktAusStandort(sid, sollPunktId, o = {}) {
  if (!navigator.geolocation) return hinweis('Dieses Gerät liefert keine Position.', 'fehler');
  hinweis('Position wird ermittelt …');
  const abschnittId = (aktiverBauabschnitt(store.strecke(sid)) || {}).id || null;
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    const s = store.strecke(sid);
    if (!s) return hinweis('Die Strecke gibt es nicht mehr – nichts aufgenommen.', 'fehler');
    const sollPunkt = sollPunktId ? s.punkte.find(pt => pt.id === sollPunktId) : null;
    /* Der Bauabschnitt wird noch einmal geprüft: er kann in der Wartezeit
       gelöscht worden sein, und ein Verweis ins Leere machte den Punkt
       truppenlos, ohne dass es jemand sieht. */
    const abschnitt = bauabschnittById(s, abschnittId);
    /* Wird ein Punkt neu geortet, bleibt seine Art, wie der Trupp sie gesetzt
       hat – die Art des Plans gilt nur für die erste Aufnahme. Sonst machte
       „Neu orten“ aus der eingetragenen Kabelreserve wieder den geplanten
       Trassenpunkt. */
    const ersetzt = o.ersetzt && istPunkte(s).some(pt => pt.id === o.ersetzt) ? o.ersetzt : null;
    let neu = null;
    store.aendern(() => {
      neu = istPunktSetzen(s, lat, lng, {
        ersetzt,
        sollPunkt: sollPunkt ? sollPunkt.id : null,
        ...(ersetzt ? {} : {
          art: sollPunkt ? sollPunkt.art : 'punkt',
          bauweise: sollPunkt && sollPunkt.art === 'querung' ? sollPunkt.bauweise : null,
          name: sollPunkt ? sollPunkt.name : ''
        }),
        quelle: 'standort', genauigkeit: accuracy,
        abschnitt: abschnitt ? abschnitt.id : null
      });
    }, 'bau');
    if (o.danach && neu) o.danach(s, neu);
    /* Gemeldet wird nur, was das Blatt nicht schon zeigt. Schlägt die
       Punktkarte am frischen Punkt auf, nennt sie Herkunft, Genauigkeit,
       Gitterangabe und Abweichung – die Pille sagte dasselbe ein zweites Mal
       und stünde dabei 3,2 s über Statusleiste und Maßstab. Aus der Liste
       heraus schlägt kein Blatt auf; dort ist sie die einzige Rückmeldung und
       bleibt. Die Gitterangabe fehlt ihr: mit ihr war sie bei 320 px
       dreizeilig und deckte zwei Griffe der Bauleiste zu, und die Zahl steht
       in der Zeile, die gerade entstanden ist. */
    const abw = sollPunkt ? distanz(sollPunkt, { lat, lng }) : null;
    if (!neu || !offen || offen.istId !== neu.id) {
      hinweis(abw !== null && abw >= ABWEICHUNG_SCHWELLE
        ? `Punkt aufgenommen (±${Math.round(accuracy)} m) – ${formatLaenge(abw)} vom Plan`
        : `Punkt aufgenommen (±${Math.round(accuracy)} m)`);
    } else {
      /* Abräumen, nicht bloß nichts melden: „Position wird ermittelt …“ läuft
         noch und stünde sonst 3,2 s über der Karte, während das Blatt den
         fertigen Punkt schon zeigt. */
      hinweisAus();
    }
  }, err => hinweis('Position nicht verfügbar: ' + err.message, 'fehler'),
     { enableHighAccuracy: true, timeout: 12000, maximumAge: 10000 });
}

// ---------------------------------------------------------------- Bauleiste

/* Die zwei Griffe der Bauleiste. Sie gelten der Strecke, die im Bau-Reiter
   gewählt ist – oder, wenn dort noch niemand gewählt hat, der zuletzt
   gebauten. Welche das ist, sagt die Punktkarte hinterher im Kopf; wer die
   falsche sieht, wechselt sie oben im Reiter. */

function streckeOderHinweis() {
  const s = baustrecke();
  if (!s) hinweis('Noch keine Strecke in dieser Planung – erst planen, dann bauen.', 'warnung');
  return s;
}

/** „Punkt hier“: Standort des Geräts als zusätzlichen Punkt aufnehmen */
export function punktHierAufnehmen() {
  const s = streckeOderHinweis();
  if (!s) return;
  punktkarteSchliessen();
  istPunktAusStandort(s.id, null, { danach: (st, pt) => punktkarteOeffnen(st, { ist: pt }) });
}

/** „Auf Karte“: der nächste Tipp auf die Karte ist der Punkt */
export function punktAufKarteStarten() {
  const s = streckeOderHinweis();
  if (!s) return;
  punktkarteSchliessen();
  const a = aktiverBauabschnitt(s);
  ctx.sl.starteIstSetzen(s.id, { abschnitt: a ? a.id : null });
  ctx.modusAnzeigen();
  hinweis('Auf die Karte tippen, wo der Punkt wirklich liegt.');
}

/** Ein angetippter Kartenpunkt wird zum aufgenommenen Punkt – aus dem Koordinaten-Popup */
export function punktAusKoordinate(lat, lng) {
  const s = streckeOderHinweis();
  if (!s) return;
  const a = aktiverBauabschnitt(s);
  let neu = null;
  store.aendern(() => {
    neu = istPunktSetzen(s, lat, lng, { quelle: 'karte', abschnitt: a ? a.id : null });
  }, 'bau');
  if (neu) punktkarteOeffnen(s, { ist: neu });
}

// ---------------------------------------------------------------- Punktkarte

/* Das Blatt am unteren Kartenrand. Es zeigt EINEN Punkt: einen aufgenommenen
   mit der Frage „Was ist hier?“, oder einen geplanten, der noch offen ist,
   mit den drei Wegen ihn aufzunehmen. Es ist kein Dialog – die Karte bleibt
   bedienbar, ein Tipp auf sie schließt das Blatt – und es steht dort, wo die
   Bauleiste steht: die eine löst die andere ab, beide brauchen den Daumen.

   Gehalten werden Kennungen, keine Objekte, aus demselben Grund wie bei der
   Ortung: die Liste wird bei jeder Änderung neu aufgebaut, Undo tauscht den
   ganzen Baum. `istPunktSetzen` behält beim Ersetzen die Kennung – deshalb
   bleibt das Blatt über ein „Neu orten“ hinweg am selben Punkt. */

let offen = null;   // { sid, istId, sollId } oder null

const blatt = () => document.getElementById('punktkarte');

export function punktkarteOffen() { return !!offen; }

export function punktkarteSchliessen() {
  if (!offen) return;
  offen = null;
  const b = blatt();
  if (b) { b.hidden = true; b.innerHTML = ''; }
  document.body.classList.remove('punktkarte-offen');
}

/** Das Blatt zu einem Punkt aufschlagen: `ist` oder `soll`, dazu die Strecke */
export function punktkarteOeffnen(s, { ist = null, soll = null } = {}) {
  if (!s || (!ist && !soll)) return;
  /* Wer einen Punkt einer Strecke antippt, baut an dieser Strecke – die
     nächste Aufnahme über die Bauleiste soll dorthin gehen und nicht an die
     Strecke, die im Reiter zufällig oben stand. */
  baustreckeSetzen(s.id);
  offen = {
    sid: s.id,
    istId: ist ? ist.id : null,
    sollId: soll ? soll.id : (ist && ist.sollPunkt) || null
  };
  punktkarteZeichnen();
  if (ctx.zurKarte) ctx.zurKarte();
}

/**
 * Nach jeder Änderung der Planung nachziehen. Der Punkt kann verschwunden
 * sein (Rückgängig, Löschen aus der Liste) – dann schließt das Blatt, statt
 * einen Punkt zu zeigen, den es nicht mehr gibt. Formulareingaben zeichnen
 * nicht neu: sie kommen aus dem Blatt selbst, und ein Neuaufbau nähme dem
 * Feld den Fokus mitten im Wort.
 */
export function punktkarteNachfuehren(grund) {
  if (!offen || grund === 'formular') return;
  const s = store.strecke(offen.sid);
  if (!s) return punktkarteSchliessen();
  const ist = offen.istId ? istPunkte(s).find(pt => pt.id === offen.istId) : null;
  const soll = offen.sollId ? s.punkte.find(pt => pt.id === offen.sollId) : null;
  if (!ist && !soll) return punktkarteSchliessen();
  punktkarteZeichnen();
}

function punktkarteZeichnen() {
  const b = blatt();
  const s = store.strecke(offen.sid);
  if (!b || !s) return punktkarteSchliessen();
  const soll = offen.sollId ? s.punkte.find(pt => pt.id === offen.sollId) : null;
  let ist = offen.istId ? istPunkte(s).find(pt => pt.id === offen.istId) : null;
  /* Ein geplanter Punkt, der inzwischen bestätigt wurde – etwa über „wie
     geplant“ aus diesem Blatt heraus –, zeigt von nun an seine Aufnahme. */
  if (!ist && soll) ist = istZuSoll(s, soll.id);
  if (ist) offen.istId = ist.id;
  b.innerHTML = '';
  b.appendChild(ist ? istBlatt(s, ist, soll || sollZuIst(s, ist)) : sollBlatt(s, soll));
  b.hidden = false;
  document.body.classList.add('punktkarte-offen');
}

// ---------------------------------------------------------------- Bausteine

function el(tag, klasse, inhalt) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (inhalt !== undefined) e.innerHTML = inhalt;
  return e;
}

function knopf(text, tun, klasse = '') {
  const k = el('button', 'knopf ' + klasse, escapeHtml(text));
  k.type = 'button';
  k.onclick = tun;
  return k;
}

function kopf(titel, untertitel, s) {
  const k = el('header', 'pk-kopf');
  /* Der Schließgriff steht links, und zwar vor dem Titel im Baum: rechts oben
     liegt Leaflets Zoomsteuerung über dem Blatt, und von den 44 px des
     Kreuzes waren dort nur 25 wirksam – die rechte Hälfte zoomte aus, statt
     zu schließen. Links steht bei keiner Breite etwas von Leaflet. */
  const zu = el('button', 'mini-knopf pk-zu', '✕');
  zu.type = 'button';
  zu.setAttribute('aria-label', 'Schließen');
  zu.onclick = punktkarteSchliessen;
  k.appendChild(zu);
  k.appendChild(el('div', 'pk-titel',
    `<b>${escapeHtml(titel)}</b>` +
    (untertitel ? `<span class="pk-unter">${escapeHtml(untertitel)}</span>` : '') +
    `<span class="pk-strecke">${escapeHtml(s.name)}</span>`));
  return k;
}

/* Die Arten, die am Bauort zur Wahl stehen. Anfang und Ende sind keine Wahl –
   sie sind die Stellen, an denen die Trasse beginnt und endet, und die kennt
   der Plan. Sie erscheinen nur, wenn der Punkt sie schon trägt, damit die
   Anzeige nicht lügt. Kurze Wörter statt der Namen der Vorschrift: in zwei
   Reihen à 44 px müssen sieben Griffe nebeneinander Platz finden; das ganze
   Wort steht im Bogen und in der Liste. */
const CHIP_NAMEN = {
  punkt: 'Trassenpunkt', muffe: 'Muffe', reserve: 'Reserve', mast: 'Mast',
  querung: 'Querung', verteiler: 'Verteiler', sonstiges: 'Sonstiges',
  start: 'Anfang', ziel: 'Ende'
};
const CHIP_ARTEN = ['punkt', 'muffe', 'reserve', 'mast', 'querung', 'verteiler', 'sonstiges'];

function chips(werte, gewaehlt, beiWahl, beschriftung) {
  const reihe = el('div', 'pk-chips');
  reihe.setAttribute('role', 'group');
  reihe.setAttribute('aria-label', beschriftung);
  for (const [id, name] of werte) {
    const c = el('button', 'pk-chip', escapeHtml(name));
    c.type = 'button';
    c.dataset.wert = id;
    c.setAttribute('aria-pressed', String(id === gewaehlt));
    c.onclick = () => beiWahl(id);
    reihe.appendChild(c);
  }
  return reihe;
}

/* Eingabe aus dem Blatt: gesammelt und mit dem Grund „formular“ geschrieben,
   damit weder Liste noch Blatt bei jedem Tastendruck neu entstehen – so hält
   es auch `schreib()` in ui.js. */
let schreibTimer = null;
function schreib(fn) {
  if (schreibTimer) clearTimeout(schreibTimer);
  schreibTimer = setTimeout(() => {
    schreibTimer = null;
    store.aendern(fn, 'formular');
  }, 150);
}

function textfeld(klasse, wert, platzhalter, beiAenderung) {
  const ein = document.createElement('input');
  ein.type = 'text';
  ein.className = klasse;
  ein.value = wert || '';
  ein.placeholder = platzhalter;
  ein.setAttribute('aria-label', platzhalter);
  ein.addEventListener('input', () => beiAenderung(ein.value));
  return ein;
}

// ---------------------------------------------------------------- Das Ist-Blatt

function istBlatt(s, ist, soll) {
  const box = el('div', 'pk-ist');
  const nr = soll ? s.punkte.indexOf(soll) + 1 : 0;
  box.appendChild(kopf(soll ? `Punkt ${nr}` : 'Zusätzlicher Punkt',
    soll ? punktartText(soll) + (soll.name ? ` · ${soll.name}` : '') : '', s));

  /* Der Befund in einer Zeile: woher die Koordinate stammt, wo sie liegt und
     – die Zahl, um die es geht – wie weit vom Plan. „✓ gebaut“ und die
     Uhrzeit standen hier und sagten dem Trupp nichts, was er nicht wüsste;
     auf einem Blatt, das nicht auf den Schirm passt, kostet jede Pille die
     Zeile, die die Punktart braucht. In der Liste des Bau-Reiters bleiben
     beide – dort wird über Punkte gelesen, die man nicht eben gesetzt hat. */
  const abw = soll ? distanz(soll, ist) : null;
  const abschnitt = bauabschnittById(s, ist.abschnitt);
  const befund = el('div', 'pk-befund');
  befund.innerHTML =
    `<span>${escapeHtml(quelleText(ist))}</span>` +
    `<span class="mono">${escapeHtml(toMGRS(ist.lat, ist.lng, 5))}</span>` +
    (abw !== null && abw >= ABWEICHUNG_SCHWELLE
      ? `<span class="bp-abweichung">${escapeHtml(formatLaenge(abw))} vom Plan</span>` : '') +
    (abschnitt ? `<span>${escapeHtml(abschnitt.trupp || abschnitt.name)}</span>` : '');
  box.appendChild(befund);

  box.appendChild(el('div', 'pk-frage', 'Was ist hier?'));
  /* Anfang und Ende stehen zur Wahl, wenn der Punkt sie trägt ODER der
     geplante Punkt sie trug: wer am Anfangspunkt versehentlich „Muffe“
     antippt, muss zum Anfang zurückkönnen, ohne Rückgängig zu suchen. */
  const extra = [ist.art, soll ? soll.art : null].filter(a => a && !CHIP_ARTEN.includes(a));
  const arten = [...new Set(extra), ...CHIP_ARTEN];
  box.appendChild(chips(
    arten.map(a => [a, CHIP_NAMEN[a] || punktartById(a).name]), ist.art,
    art => store.aendern(() => istArtSetzen(ist, art), 'bau'), 'Punktart'));

  /* Die Bauweise nur an der Querung, und erst nach der Wahl: vier Griffe
     mehr für jeden Punkt hätten das Blatt auf drei Reihen wachsen lassen. */
  if (ist.art === 'querung') {
    box.appendChild(el('div', 'pk-frage', 'Wie gequert?'));
    box.appendChild(chips(
      QUERUNG_BAUWEISEN.map(b => [b.id, b.id === 'trasse' ? 'wie die Trasse'
        : b.id === 'bauwerk' ? 'an Brücke' : b.name.replace(/ \(.*\)$/, '')]),
      ist.bauweise,
      bw => store.aendern(() => { ist.bauweise = bw; }, 'bau'), 'Bauweise'));
  }

  const felder = el('div', 'pk-felder');
  /* Die Bezeichnung nur für Punkte, die der Plan nicht kennt: der bestätigte
     Punkt heißt, wie er im Bauauftrag heißt – so wird er am Bauort gesucht. */
  if (!soll) {
    felder.appendChild(textfeld('pk-name', ist.name, 'Bezeichnung, z. B. Mast an der Scheune',
      w => schreib(() => { ist.name = w; })));
  }
  felder.appendChild(textfeld('pk-bemerkung', ist.bemerkung, 'Bemerkung – was hier anders war',
    w => schreib(() => { ist.bemerkung = w; })));
  box.appendChild(felder);

  /* Zwei Reihen statt einer: die Korrekturen oben, der Abschluss darunter
     allein und in voller Breite. Vorher stand „Zurücknehmen“ mit 6 px Abstand
     gleich groß neben „Fertig“ – mit dem Handschuh nimmt dieser Fehlgriff die
     eben eingetragene Aufnahme zurück, und der Rückweg dafür liegt oben in
     der Kopfzeile. */
  const tasten = el('div', 'pk-tasten');
  tasten.appendChild(knopf('◉ Neu orten', () =>
    istPunktAusStandort(s.id, ist.sollPunkt, { ersetzt: ist.id }), 'klein'));
  tasten.appendChild(knopf('✛ Verschieben', () => {
    punktkarteSchliessen();
    ctx.sl.starteIstSetzen(s.id, { ersetzt: ist.id, sollPunkt: ist.sollPunkt,
      abschnitt: ist.abschnitt });
    ctx.modusAnzeigen();
    hinweis('Auf die Karte tippen, wo der Punkt wirklich liegt.');
  }, 'klein'));
  tasten.appendChild(knopf(soll ? 'Zurücknehmen' : 'Löschen', () => {
    punktkarteSchliessen();
    store.aendern(() => { s.bau.punkte = s.bau.punkte.filter(x => x.id !== ist.id); }, 'bau');
    hinweis(soll
      ? `Punkt ${nr} wieder offen – „Rückgängig“ in der Kopfzeile holt ihn zurück`
      : 'Punkt gelöscht – „Rückgängig“ in der Kopfzeile holt ihn zurück');
  }, 'klein gefahr'));
  box.appendChild(tasten);

  const abschluss = el('div', 'pk-abschluss');
  abschluss.appendChild(knopf('Fertig', punktkarteSchliessen, 'primaer'));
  box.appendChild(abschluss);
  return box;
}

// ---------------------------------------------------------------- Das Soll-Blatt

/* Ein geplanter Punkt, der noch offen ist: dieselben drei Griffe wie in der
   Liste, nur eben dort, wo der Punkt auf der Karte steht. */
function sollBlatt(s, soll) {
  const box = el('div', 'pk-soll');
  const nr = s.punkte.indexOf(soll) + 1;
  box.appendChild(kopf(`Punkt ${nr}`,
    punktartText(soll) + (soll.name ? ` · ${soll.name}` : ''), s));

  const befund = el('div', 'pk-befund');
  befund.innerHTML =
    `<span class="pk-offen">noch nicht gebaut</span>` +
    `<span class="mono">${escapeHtml(toMGRS(soll.lat, soll.lng, 5))}</span>`;
  box.appendChild(befund);

  const a = aktiverBauabschnitt(s);
  const tasten = el('div', 'pk-tasten pk-aufnahme');
  tasten.appendChild(knopf('✓ Wie geplant', () => {
    store.aendern(() => {
      istPunktSetzen(s, soll.lat, soll.lng, {
        sollPunkt: soll.id, art: soll.art, name: soll.name, quelle: 'plan',
        bauweise: soll.art === 'querung' ? soll.bauweise : null,
        abschnitt: a ? a.id : null
      });
    }, 'bau');
  }, 'bau-taste primaer'));
  tasten.appendChild(knopf('◉ Hier', () => istPunktAusStandort(s.id, soll.id), 'bau-taste'));
  tasten.appendChild(knopf('✛ Auf Karte', () => {
    punktkarteSchliessen();
    ctx.sl.starteIstSetzen(s.id, { sollPunkt: soll.id, art: soll.art,
      bauweise: soll.art === 'querung' ? soll.bauweise : null, abschnitt: a ? a.id : null });
    ctx.modusAnzeigen();
    hinweis('Auf die Karte tippen, wo der Punkt wirklich liegt.');
  }, 'bau-taste'));
  box.appendChild(tasten);
  return box;
}
