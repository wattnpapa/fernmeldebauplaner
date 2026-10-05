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
  istSollZuordnen, offeneSollPunkte, sollVorschlag, andereStreckeNahe, istPunktUmhaengen,
  baustrecke, baustreckeSetzen, aktiverBauabschnitt, bauabschnitte, bauabschnittAktivSetzen,
  quelleText, punktartText, ABWEICHUNG_SCHWELLE, ABSEITS_SCHWELLE
} from './baudoku.js';
import { toMGRS, formatLaenge, distanz } from './geo.js';
import { escapeHtml } from './strecken.js';

let ctx = null;   // { karte, sl, hinweis, hinweisAus, modusAnzeigen, zurKarte }

export function initBaukarte(kontext) {
  ctx = kontext;
  /* Geht die Bildschirmtastatur auf, schrumpft das Fenster, und das Feld mit
     dem Schreibzeichen lag im Audit genau unter dem klebenden „Fertig“ – es
     wurde blind getippt. Nachgerückt wird, sobald die Tastatur steht; wie weit,
     sagt `scroll-padding-bottom` am Blatt. */
  document.addEventListener('focusin', e => {
    const f = e.target;
    if (!f.matches || !f.matches('input, textarea') || !f.closest('.punktkarte')) return;
    setTimeout(() => f.scrollIntoView({ block: 'nearest' }), 350);
  });
  /* Ein frisch aufgeschlagenes Blatt nimmt die ersten Augenblicke keinen Tipp
     an. Bei schneller Ortung schlug es genau dort auf, wo eben „Punkt hier“
     stand, und der zweite Tipp eines Doppeltipps – mit Handschuh die Regel –
     traf „Fertig“: das Blatt war zu, ehe es gelesen war, und die Pille sagte
     „die Art fehlt“. Abgefangen wird in der Einfangphase, also vor dem Griff
     selbst, und nur, was ein Finger auslöst (`isTrusted`): ein Aufruf aus dem
     Programm ist kein verirrter zweiter Tipp. */
  document.addEventListener('click', e => {
    if (!e.isTrusted || performance.now() - aufgeschlagen >= TIPPSPERRE_MS) return;
    const b = blatt();
    if (!b || b.hidden || !b.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);
}

/* Wie lange das Blatt nach dem Aufschlagen taub bleibt. Ein Doppeltipp liegt
   bei 100 bis 300 ms; wer das Blatt liest, bevor er tippt, braucht länger als
   400 ms. */
const TIPPSPERRE_MS = 400;
let aufgeschlagen = -Infinity;

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
  /* Eine Ortung zur Zeit. Bei langsamer Ortung (4 s) startete jeder weitere
     Tipp eine eigene, und am Ende standen zwei deckungsgleiche Punkte da –
     der Knopf hatte nicht gezeigt, dass er schon arbeitet. Jetzt zeigt er es,
     und ein zweiter Tipp startet nichts. */
  if (ortungLaeuft) return hinweis('Die Position wird noch ermittelt …');
  hinweis('Position wird ermittelt …');
  ortungAnzeigen(true);
  const abschnittId = (aktiverBauabschnitt(store.strecke(sid)) || {}).id || null;
  navigator.geolocation.getCurrentPosition(pos => {
    ortungAnzeigen(false);
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    const s = store.strecke(sid);
    if (!s) return hinweis('Die Strecke gibt es nicht mehr – nichts aufgenommen.', 'fehler');
    /* Ohne gewählten geplanten Punkt („Punkt hier“ aus der Bauleiste) wird der
       eine offene Punkt vorgeschlagen, der in Ortungsnähe liegt – sichtbar und
       benannt im Blatt, „zusätzlich“ einen Tipp daneben (`sollVorschlag`).
       Das ist kein Raten im Sinne von „geraten wird nichts“: geraten hieße,
       still zuzuordnen, was der Trupp nicht sieht. Hier steht die Wahl im
       Blatt, das ohnehin aufschlägt, gedrückt und mit dem Wort
       „vorgeschlagen“ – und wo zwei Punkte in Frage kommen, wird weiter
       gefragt. Vorher stand „zusätzlich“ vorgewählt, auch 6 m neben Punkt 2,
       und wer gleich „Fertig“ tippte, hatte „0 von 3 bestätigt“. */
    const vorschlag = !sollPunktId && !o.ersetzt ? sollVorschlag(s, { lat, lng }) : null;
    const gewuenscht = sollPunktId ? s.punkte.find(pt => pt.id === sollPunktId)
      : vorschlag ? vorschlag.punkt : null;
    /* „◉ hier“ an einem geplanten Punkt bestätigte ihn mit JEDER Ortung – im
       Audit mit einer 82 km entfernten, danach stand dort ein grünes „gebaut“.
       Liegt die Ortung weiter als eine Umgehung reichen kann, wird sie als
       zusätzlicher Punkt aufgenommen und nicht dem geplanten gutgeschrieben:
       die Aufnahme ist gesichert, die Zuordnung bleibt eine Entscheidung, die
       der Trupp in der Punktkarte bewusst trifft. */
    const zuWeit = gewuenscht && distanz(gewuenscht, { lat, lng }) >= ABSEITS_SCHWELLE;
    const sollPunkt = zuWeit ? null : gewuenscht;
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
          /* Ohne geplanten Punkt bleibt die Art OFFEN: „Punkt hier“ sagt, WO
             der Trupp steht, nicht WAS dort ist. Die Frage danach stellt das
             Blatt, das gleich darauf aufschlägt. */
          art: sollPunkt ? sollPunkt.art : 'offen',
          bauweise: sollPunkt && sollPunkt.art === 'querung' ? sollPunkt.bauweise : null,
          name: sollPunkt ? sollPunkt.name : ''
        }),
        quelle: 'standort', genauigkeit: accuracy,
        abschnitt: abschnitt ? abschnitt.id : null
      });
    }, 'bau');
    if (vorschlag && neu && neu.sollPunkt === vorschlag.punkt.id) vorgeschlagen = neu.id;
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
    if (zuWeit) {
      hinweis(`Standort liegt ${formatLaenge(distanz(gewuenscht, { lat, lng }))} vom geplanten ` +
        `Punkt ${s.punkte.indexOf(gewuenscht) + 1} – als zusätzlicher Punkt aufgenommen. ` +
        'Ortung prüfen.', 'warnung');
    } else if (!neu || !offen || offen.istId !== neu.id) {
      hinweis(abw !== null && abw >= ABWEICHUNG_SCHWELLE
        ? `Punkt aufgenommen (±${Math.round(accuracy)} m) – ${formatLaenge(abw)} vom Plan`
        : `Punkt aufgenommen (±${Math.round(accuracy)} m)`);
    } else {
      /* Abräumen, nicht bloß nichts melden: „Position wird ermittelt …“ läuft
         noch und stünde sonst 3,2 s über der Karte, während das Blatt den
         fertigen Punkt schon zeigt. */
      hinweisAus();
    }
  }, err => { ortungAnzeigen(false); ortungFehlerMelden(err, sid, sollPunktId, o); },
     /* Eine frische Position, keine gemerkte. Mit `maximumAge: 10000` gab das
        Gerät 5 s nach dem ersten Punkt dieselbe Koordinate zurück, obwohl der
        Trupp 60 m weiter stand – und das Blatt nannte „Standort ±6 m“. Akku
        kostet das kaum: geortet wird je Tipp einmal, nicht laufend, und wer
        „Standort“ eingeschaltet hat, hält das Gerät ohnehin warm. Der Preis
        ist Zeit, wo kein Fix vorliegt; dafür gilt weiter die Frist von 12 s,
        und das Fehlerblatt bietet danach „Noch einmal orten“ und die Karte. */
     { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
}

let ortungLaeuft = false;
/* Der Knopf „Punkt hier“ zeigt, dass er arbeitet. Nur der in der Bauleiste:
   die Griffe der Liste entstehen bei jeder Änderung neu, sie hält der Merker
   oben. */
function ortungAnzeigen(an) {
  ortungLaeuft = an;
  const k = document.getElementById('wz-punkt-hier');
  if (!k) return;
  const wort = k.querySelector('span:not(.wz-icon)');
  if (wort) wort.textContent = an ? 'ortet …' : 'Punkt hier';
  k.classList.toggle('ortet', an);
  k.setAttribute('aria-busy', String(an));
}

/**
 * Was der Trupp liest, wenn die Ortung nicht kommt.
 *
 * Vorher stand da „Position nicht verfügbar: “ und dahinter das, was der
 * Browser mitgab – auf dem Telefon oft nichts. Ein Satz, der mit einem
 * Doppelpunkt endet, nennt weder die Ursache noch den nächsten Schritt, und den
 * gibt es: der Punkt lässt sich auf der Karte setzen. Deshalb sagt jeder der
 * drei Fälle, was zu tun ist, und der Ausweg steht als Griff in der Meldung –
 * am Bauort wird nicht gesucht, wo er sonst noch stünde.
 */
function ortungFehlerMelden(err, sid, sollPunktId, o = {}) {
  const codes = {
    1: 'Der Standort ist für diese Seite gesperrt. Im Browser die Freigabe für ' +
       'den Standort erlauben – oder den Punkt auf der Karte setzen.',
    2: 'Kein Standort zu bekommen – unter Bewuchs, im Fahrzeug oder zwischen ' +
       'Wänden findet das Gerät keinen. Ins Freie treten oder den Punkt auf ' +
       'der Karte setzen.',
    3: 'Der Standort kam in zwölf Sekunden nicht – das Gerät sucht noch. ' +
       'Noch einmal versuchen oder den Punkt auf der Karte setzen.'
  };
  const text = codes[err && err.code] ||
    'Standort nicht zu bekommen. Den Punkt auf der Karte setzen.';
  hinweis(text, 'fehler');
  /* Der Ausweg steht als GRIFF und nicht nur als Satz. In die Meldungspille
     gehört er nicht: die nimmt seit dem Gerätelauf ausdrücklich keine Tipps
     mehr entgegen, weil sie sonst die Griffe darunter abfing. Also trägt ihn
     das Blatt, das an dieser Stelle ohnehin aufschlüge, wenn die Ortung
     gelungen wäre – dieselbe Stelle, derselbe Daumen. */
  const s = store.strecke(sid);
  if (s) punktkarteFehlerOeffnen(s, { text, sollPunktId, ersetzt: o.ersetzt || null });
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

/**
 * Die Zielstrecke an der Bauleiste nennen – und, wenn die Strecke Abschnitte
 * hat, keiner aber gewählt ist, auch das.
 *
 * Vorher stand die Strecke erst NACH der Aufnahme im Kopf des Blattes, und
 * wer nach dem Neuladen oder aus der Planung kam, nahm an der falschen auf,
 * ohne es vorher sehen zu können. Ein Merker auf der Oberkante der Leiste und
 * keine eigene Zeile: die Leiste ist ein Streifen von höchstens 64 px, und
 * jede Zeile mehr geht der Karte ab. Er nimmt keine Tipps an – er läge sonst
 * mit seiner Trefferfläche über „Punkt hier“. Gewechselt wird im Bau-Reiter.
 */
export function bauzielNachfuehren() {
  const z = document.getElementById('bau-ziel');
  if (!z) return;
  const s = store.projekt && store.projekt.strecken.length ? baustrecke() : null;
  const a = s ? aktiverBauabschnitt(s) : null;
  const ohneAbschnitt = !!s && !a && bauabschnitte(s).length > 0;
  const text = !s ? '' : `an ${s.name}` +
    (a ? ` · ${a.trupp || a.name}` : ohneAbschnitt ? ' · kein Bauabschnitt gewählt' : '');
  if (z.textContent !== text) z.textContent = text;
  z.hidden = !text;
  z.classList.toggle('bau-ziel-offen', ohneAbschnitt);
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

let offen = null;   // { sid, istId, sollId, fehler } oder null
/* Der Punkt, dessen Zuordnung die Ortung vorgeschlagen und der Trupp noch
   nicht selbst gewählt hat – solange heißt sie im Blatt „vorgeschlagen“, und
   die Wahl bleibt offen. Und der Punkt, an dem er selbst gewählt hat: dort
   mahnt „Fertig“ keine Zuordnung an, die er bewusst nicht wollte. */
let vorgeschlagen = null;
let selbstGewaehlt = null;

const blatt = () => document.getElementById('punktkarte');

export function punktkarteOffen() { return !!offen; }

export function punktkarteSchliessen() {
  if (!offen) return;
  offen = null;
  vorgeschlagen = null;
  selbstGewaehlt = null;
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
    sollId: soll ? soll.id : (ist && ist.sollPunkt) || null,
    fehler: null
  };
  punktkarteZeichnen(true);
  /* Die Zurück-Taste schließt die Punktkarte (siehe `fbp:ebene` in app.js). */
  document.dispatchEvent(new CustomEvent('fbp:ebene'));
  if (ctx.zurKarte) ctx.zurKarte();
  insBild(ist || soll);
}

/**
 * Den Punkt ins Bild rücken, wenn er außerhalb des freien Kartenbandes liegt.
 *
 * Nach „Punkt hier“ blieb der Ausschnitt stehen, wo er war, und der eigene
 * Punkt lag oft außerhalb – das Blatt fragte „Was ist hier?“, und „hier“ war
 * nicht zu sehen. Frei ist, was das Blatt unten und Zoom samt Kartenoptionen
 * oben übrig lassen; gerückt wird nur, wenn der Punkt dort nicht steht, und
 * nur so weit wie nötig – ein Sprung bei jeder Aufnahme nähme dem Trupp den
 * Überblick, den er sich eingestellt hat. Ein Bild später, wenn das Blatt
 * seine Höhe hat; die Schmalansicht schiebt die Karte erst in 280 ms herein,
 * deshalb zählt das Maß von #karte, das davon nicht berührt wird.
 */
function insBild(pt) {
  if (!pt || !ctx || !ctx.karte) return;
  requestAnimationFrame(() => {
    const karte = ctx.karte;
    const rahmen = karte.getContainer().getBoundingClientRect();
    if (!rahmen.width || !rahmen.height) return;
    let oben = 12, unten = rahmen.height - 12;
    const b = blatt();
    if (b && !b.hidden) {
      const r = b.getBoundingClientRect();
      if (r.top - rahmen.top > rahmen.height / 3) unten = Math.min(unten, r.top - rahmen.top - 28);
    }
    for (const wahl of ['.leaflet-control-zoom', '.kartenoptionen']) {
      const e = document.querySelector(wahl);
      const r = e && e.getBoundingClientRect();
      if (r && r.height && r.top - rahmen.top < rahmen.height / 3) {
        oben = Math.max(oben, r.bottom - rahmen.top + 24);
      }
    }
    if (unten - oben < 40) return;
    const p = karte.latLngToContainerPoint([pt.lat, pt.lng]);
    const rand = 24;
    let dx = 0, dy = 0;
    if (p.x < rand) dx = p.x - rand;
    else if (p.x > rahmen.width - rand) dx = p.x - (rahmen.width - rand);
    if (p.y < oben) dy = p.y - oben;
    else if (p.y > unten) dy = p.y - unten;
    if (dx || dy) karte.panBy([dx, dy], { animate: false });
  });
}

/** Das Blatt zu einer gescheiterten Ortung: der Grund und die beiden Auswege */
export function punktkarteFehlerOeffnen(s, fehler) {
  offen = { sid: s.id, istId: null, sollId: fehler.sollPunktId || null, fehler };
  punktkarteZeichnen(true);
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
  /* Das Fehlerblatt hängt an keinem Punkt – es steht, bis der Trupp einen der
     beiden Auswege nimmt oder es schließt. Ein Neuzeichnen bräuchte es nicht,
     und die Prüfung darunter schlösse es, weil sie nichts fände. */
  if (offen.fehler) return;
  const ist = offen.istId ? istPunkte(s).find(pt => pt.id === offen.istId) : null;
  const soll = offen.sollId ? s.punkte.find(pt => pt.id === offen.sollId) : null;
  if (!ist && !soll) return punktkarteSchliessen();
  punktkarteZeichnen();
}

function punktkarteZeichnen(neuAufgeschlagen = false) {
  const b = blatt();
  const s = store.strecke(offen.sid);
  if (!b || !s) return punktkarteSchliessen();
  /* Der Rollstand wird über den Neuaufbau gerettet und nicht dem Browser
     überlassen. Zwei Gründe, und beide sind am Gerät aufgefallen: ein frisch
     aufgeschlagenes Blatt beginnt oben, sonst stünde der Kopf unerreichbar
     darüber; und wer unten bei der Bemerkung war, soll nach einem Tipp auf
     einen Chip nicht wieder oben landen. Dazwischen liegt der Fall, den die
     Geräteprüfung fand: beim Neuaufbau verschob die Rollverankerung des
     Browsers das Blatt um 2 bis 18 px, und damit stand das Schließkreuz nicht
     mehr ungerollt im Bild. */
  const rollstand = neuAufgeschlagen ? 0 : b.scrollTop;
  if (neuAufgeschlagen) aufgeschlagen = performance.now();
  if (offen.fehler) {
    b.innerHTML = '';
    b.appendChild(fehlerBlatt(s, offen.fehler));
    b.hidden = false;
    b.scrollTop = rollstand;
    document.body.classList.add('punktkarte-offen');
    return;
  }
  const soll = offen.sollId ? s.punkte.find(pt => pt.id === offen.sollId) : null;
  let ist = offen.istId ? istPunkte(s).find(pt => pt.id === offen.istId) : null;
  /* Ein geplanter Punkt, der inzwischen bestätigt wurde – etwa über „wie
     geplant“ aus diesem Blatt heraus –, zeigt von nun an seine Aufnahme. */
  if (!ist && soll) ist = istZuSoll(s, soll.id);
  /* Steht ein aufgenommener Punkt da, gilt SEINE Zuordnung und nicht die, mit
     der das Blatt aufschlug: wer den vorgeschlagenen Punkt auf „zusätzlich“
     stellt, sähe sonst weiter „Punkt 1“ – ohne die Reihe, um es zu ändern. */
  if (ist) { offen.istId = ist.id; offen.sollId = ist.sollPunkt || null; }
  b.innerHTML = '';
  b.appendChild(ist ? istBlatt(s, ist, sollZuIst(s, ist)) : sollBlatt(s, soll));
  b.hidden = false;
  b.scrollTop = Math.min(rollstand, Math.max(0, b.scrollHeight - b.clientHeight));
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

/**
 * Eine Stelle des Blattes ins Bild rollen.
 *
 * Das Blatt ist gedeckelt (höchstens 60 % des Kartenbereichs) und rollt innen;
 * bei 390×690 sind 313 px sichtbar und der Inhalt misst 636. Was eine Wahl erst
 * ERZEUGT, liegt deshalb regelmäßig unter der festgehaltenen Abschlusszeile –
 * und wird dann nicht beantwortet. Genau das ist mit der Bauweise geschehen:
 * Wer „Querung“ antippte, sah die Frage „Wie gequert?“ nicht, drückte „Fertig“,
 * und die eine Angabe, wegen der die Querung aufgenommen wird, fehlte still.
 *
 * Gerollt wird nach dem Neuzeichnen (ein Bild später), sonst zielte es auf das
 * Blatt von vorhin. Dass der Kopf festgehalten ist, wird abgezogen – sonst
 * landete die Zeile darunter.
 */
function zeigeImBlatt(wahl) {
  requestAnimationFrame(() => {
    const b = blatt();
    const ziel = b && b.querySelector(wahl);
    if (!ziel) return;
    const kopfHoehe = (b.querySelector('.pk-kopf') || {}).offsetHeight || 0;
    /* Sprunghaft und nicht weich: das Blatt misst gedeckelt 313 px, die
       Bewegung wäre kürzer als ihre eigene Dauer. Wer mit dem Handschuh einen
       Chip trifft, soll die nächste Frage sofort lesen und nicht auf eine
       Animation warten – und solange sie läuft, steht der Rollstand weder für
       den Trupp noch für die Geräteprüfung fest. */
    b.scrollTo({ top: Math.max(0, ziel.offsetTop - kopfHoehe - 8), behavior: 'auto' });
  });
}

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
let schreibFn = null;
function schreib(fn) {
  if (schreibTimer) clearTimeout(schreibTimer);
  schreibFn = fn;
  schreibTimer = setTimeout(blattSchreiben, 150);
}
/* Sofort schreiben, was im Blatt getippt und noch nicht übernommen ist – beim
   Verlassen der Seite läuft der Zeitgeber nicht mehr ab (siehe
   `formularSchreiben` in ui.js, dort steht derselbe Fall). */
export function blattSchreiben() {
  if (!schreibTimer) return;
  clearTimeout(schreibTimer);
  const fn = schreibFn;
  schreibTimer = null;
  schreibFn = null;
  store.aendern(fn, 'formular');
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
  /* Zwei Spalten, die hochkant keine sind: `.pk-spalte` steht dort auf
     `display: contents`, die Kinder liegen also unmittelbar im Blatt wie
     vorher. Quer auf dem Telefon rücken sie nebeneinander – bei 667×375 blieb
     zwischen festgehaltenem Kopf und festgehaltenem Abschluss ein Fenster von
     rund 40 px für Befund, Chips und Felder, und die Chipreihe, wegen der das
     Blatt aufschlägt, war darin nicht zu sehen. Nebeneinander steht links, was
     angetippt wird, und rechts, was geschrieben wird. */
  const links = el('div', 'pk-spalte pk-links');
  const rechts = el('div', 'pk-spalte pk-rechts');

  const abw = soll ? distanz(soll, ist) : null;
  const abschnitt = bauabschnittById(s, ist.abschnitt);
  const befund = el('div', 'pk-befund');
  befund.innerHTML =
    `<span>${escapeHtml(quelleText(ist))}</span>` +
    `<span class="mono">${escapeHtml(toMGRS(ist.lat, ist.lng, 5))}</span>` +
    (abw !== null && abw >= ABWEICHUNG_SCHWELLE
      ? `<span class="bp-abweichung">${escapeHtml(formatLaenge(abw))} vom Plan</span>` : '') +
    (abschnitt ? `<span>${escapeHtml(abschnitt.trupp || abschnitt.name)}</span>` : '');
  links.appendChild(befund);

  /* Der Punkt weiß nicht, welchen geplanten er bestätigt: über die Bauleiste
     aufgenommen, kennt er nur seine Koordinate. Genau hier wird das
     entschieden, und zwar im Augenblick der Aufnahme – das Blatt schlägt
     dafür ohnehin auf. Die offenen Punkte stehen nach Entfernung sortiert, der
     nächstliegende zuerst und mit seiner Entfernung daneben; geraten wird
     nichts. Ohne diese Reihe blieb „0 von 3 Punkten“ stehen, auch wenn der
     Trupp genau auf Punkt 2 stand, und die gemeldete Abweichung war die
     Trassenlänge statt der Abweichung.

     Nur die drei nächsten, und die Frage in derselben Zeile: das Blatt ist
     gedeckelt, und jede Zeile geht der Karte ab – am Bauort will der Trupp
     sehen, WO der Punkt liegt, den er benennt. Wer weiter greifen muss, findet
     die ganze Liste im Bau-Reiter: die Liste ist der Bogen, die Karte der
     Griff. */
  const vorschlagAktiv = !!soll && vorgeschlagen === ist.id;
  if (!soll || vorschlagAktiv) {
    /* Steht die Zuordnung nur als Vorschlag, bleibt die Reihe stehen: der
       vorgeschlagene Punkt gedrückt und als solcher benannt, „zusätzlich“ einen
       Tipp daneben. */
    const offeneSoll = vorschlagAktiv
      ? [{ punkt: soll, nr, weg: distanz(soll, ist) }, ...offeneSollPunkte(s, ist).slice(0, 2)]
      : offeneSollPunkte(s, ist).slice(0, 3);
    /* Liegt der Standort an einer ANDEREN Strecke, ist das die Auskunft und
       nicht „Stimmt die Ortung?“. Im Audit nahm „Punkt hier“ nach dem
       Neuladen Strecke 1, das Blatt fragte nach 5,86 km – die Ortung stimmte,
       gewählt war die falsche Strecke. Der Griff hängt den Punkt um, mit
       allem, was schon an ihm steht. */
    const andere = andereStreckeNahe(store.projekt, s, ist);
    if (andere) {
      const w = el('div', 'pk-warnung pk-andere',
        `Der Standort liegt an <b>${escapeHtml(andere.strecke.name)}</b> – Punkt ${andere.nr} ` +
        `ist ${escapeHtml(formatLaenge(andere.weg))} entfernt.`);
      w.appendChild(knopf(`Zu ${andere.strecke.name} · ` +
        (andere.offen ? `Punkt ${andere.nr}` : 'zusätzlich'), () => {
        const ziel = andere.strecke;
        const a = aktiverBauabschnitt(ziel);
        let neu = null;
        store.aendern(() => {
          neu = istPunktUmhaengen(s, ziel, ist, andere.offen ? andere.punkt.id : null,
            a ? a.id : null);
        }, 'bau');
        if (!neu) return;
        punktkarteOeffnen(ziel, { ist: neu });
        hinweis(`An ${ziel.name} aufgenommen – „↶“ oben nimmt es zurück`);
      }, 'klein'));
      links.appendChild(w);
    }
    if (offeneSoll.length) {
      const reihe = el('div', 'pk-zuordnung');
      reihe.appendChild(el('span', 'pk-frage', vorschlagAktiv
        ? `Welcher Punkt? <span class="pk-vorschlag">vorgeschlagen: Punkt ${nr}</span>`
        : 'Welcher Punkt?'));
      /* Ein Punkt, der weiter weg liegt, als eine Umgehung reicht, verlangt
         eine eigene Bestätigung. Im Audit stand „Punkt 1 · 82,43 km“
         gleichrangig neben „zusätzlich“, ein Tipp machte daraus „✓ gebaut“.
         Ein zweiter Tipp auf denselben Chip genügte danach auch nicht: mit
         Handschuh tippt man ohnehin oft doppelt, und die Warnung stand nur in
         einer Pille unten. Bestätigt wird deshalb über einen Knopf, der erst
         erscheint und an anderer Stelle steht als der Chip. */
      let rueckfrage = null;
      const weit = new Map(offeneSoll.map(e => [e.punkt.id, e]));
      const zuordnung = chips(
        [...offeneSoll.map(e => [e.punkt.id,
          `Punkt ${e.nr} · ${formatLaenge(e.weg)}${e.weg >= ABSEITS_SCHWELLE ? ' ⚠' : ''}`]),
         ['', 'zusätzlich']],
        vorschlagAktiv ? soll.id : '',
        pid => {
          const e = pid ? weit.get(pid) : null;
          if (rueckfrage) { rueckfrage.remove(); rueckfrage = null; }
          if (e && e.weg >= ABSEITS_SCHWELLE) {
            rueckfrage = el('div', 'pk-warnung pk-rueckfrage',
              `Punkt ${e.nr} liegt ${escapeHtml(formatLaenge(e.weg))} von hier. ` +
              'Stimmt die Ortung wirklich?');
            rueckfrage.appendChild(knopf(`Ja, das ist Punkt ${e.nr}`, () => {
              vorgeschlagen = null;
              selbstGewaehlt = ist.id;
              store.aendern(() => istSollZuordnen(s, ist, pid), 'bau');
            }, 'klein'));
            reihe.after(rueckfrage);
            /* Ganz ins Bild, und über „Fertig“: im Audit reichte der Knopf
               halb unter die klebende Abschlusszeile. */
            rueckfrage.scrollIntoView({ block: 'nearest' });
            return;
          }
          /* Wer tippt, hat gewählt – auch den Vorschlag selbst. Danach heißt
             nichts mehr „vorgeschlagen“, und „Fertig“ mahnt nichts an. */
          vorgeschlagen = null;
          selbstGewaehlt = ist.id;
          store.aendern(() => istSollZuordnen(s, ist, pid || null), 'bau');
        },
        'Zuordnung zum Plan');
      if (vorschlagAktiv) {
        const c = zuordnung.querySelector(`[data-wert="${CSS.escape(soll.id)}"]`);
        if (c) c.classList.add('pk-chip-vorschlag');
      }
      reihe.appendChild(zuordnung);
      /* Die Warnung steht VOR der Frage und nicht darunter: darunter lag sie
         im Audit unter dem Rand des Blattes, sichtbar war nur „Fertig“. */
      if (!andere && offeneSoll[0].weg >= ABSEITS_SCHWELLE) {
        links.appendChild(el('p', 'pk-warnung',
          `Der Standort liegt ${escapeHtml(formatLaenge(offeneSoll[0].weg))} von der ` +
          'nächsten geplanten Stelle entfernt. Stimmt die Ortung?'));
      }
      links.appendChild(reihe);
    }
  }

  links.appendChild(el('div', 'pk-frage' + (ist.art === 'offen' ? ' pk-frage-offen' : ''),
    ist.art === 'offen' ? 'Was ist hier? <span>fehlt noch</span>' : 'Was ist hier?'));
  /* Anfang und Ende stehen zur Wahl, wenn der Punkt sie trägt ODER der
     geplante Punkt sie trug: wer am Anfangspunkt versehentlich „Muffe“
     antippt, muss zum Anfang zurückkönnen, ohne Rückgängig zu suchen. */
  /* „Art noch offen“ steht NICHT als Chip da: sie ist keine Antwort auf „Was
     ist hier?“, sondern deren Ausbleiben – ein Griff, der sie setzt, wäre eine
     Aussage über nichts. Dass sie offen ist, sagt die Frage darüber. */
  const extra = [ist.art, soll ? soll.art : null]
    .filter(a => a && a !== 'offen' && !CHIP_ARTEN.includes(a));
  const arten = [...new Set(extra), ...CHIP_ARTEN];
  links.appendChild(chips(
    arten.map(a => [a, CHIP_NAMEN[a] || punktartById(a).name]), ist.art,
    art => {
      store.aendern(() => istArtSetzen(ist, art), 'bau');
      /* Die Querung stellt eine zweite Frage, und sie entsteht unter dem
         sichtbaren Ausschnitt. Wer sie nicht sieht, beantwortet sie nicht. */
      if (art === 'querung') zeigeImBlatt('.pk-bauweise');
    }, 'Punktart'));

  /* Die Bauweise nur an der Querung, und erst nach der Wahl: vier Griffe
     mehr für jeden Punkt hätten das Blatt auf drei Reihen wachsen lassen.
     Sie ist an der Querung die Angabe, um die es geht – Überbau oder Unterbau
     entscheidet, was der nächste Trupp dort vorfindet –, deshalb nennt die
     Frage sich selbst als offen, solange keine steht. */
  if (ist.art === 'querung') {
    links.appendChild(el('div', 'pk-frage pk-bauweise' + (ist.bauweise ? '' : ' pk-frage-offen'),
      ist.bauweise ? 'Wie gequert?' : 'Wie gequert? <span>fehlt noch</span>'));
    links.appendChild(chips(
      QUERUNG_BAUWEISEN.map(b => [b.id, b.id === 'trasse' ? 'wie die Trasse'
        : b.id === 'bauwerk' ? 'an Brücke' : b.name.replace(/ \(.*\)$/, '')]),
      ist.bauweise,
      bw => store.aendern(() => { ist.bauweise = bw; }, 'bau'), 'Bauweise'));
  }

  /* Kein Bauabschnitt gewählt, obwohl die Strecke welche hat: nach dem
     Neuladen ist das die Regel (die Wahl ist Sitzungszustand, und ohne Wahl
     fällt nichts einem Abschnitt zu). Gesagt wurde es nirgends, und die Punkte
     gingen ohne Trupp in die Meldung. Hier steht es, mit den Abschnitten als
     Griff – die Wahl gilt dann für diesen und jeden weiteren Punkt. Nach der
     Art und nicht davor: die ist die Frage, wegen der das Blatt aufschlägt. */
  if (!ist.abschnitt && bauabschnitte(s).length && !aktiverBauabschnitt(s)) {
    const reihe = el('div', 'pk-zuordnung pk-abschnitt');
    reihe.appendChild(el('span', 'pk-frage pk-frage-offen',
      'Bauabschnitt? <span>keiner gewählt</span>'));
    reihe.appendChild(chips(bauabschnitte(s).map(a => [a.id, a.trupp || a.name]), '', aid => {
      bauabschnittAktivSetzen(aid);
      store.aendern(() => { ist.abschnitt = aid; }, 'bau');
    }, 'Bauabschnitt'));
    links.appendChild(reihe);
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
  rechts.appendChild(felder);

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
  rechts.appendChild(tasten);
  box.appendChild(links);
  box.appendChild(rechts);

  /* „Fertig“ schließt in jedem Fall – am Bauort wird nicht verhandelt, und ein
     Blatt, das sich nicht schließen lässt, ist schlimmer als eine Lücke. Es
     sagt aber, was offen bleibt: der Trupp geht sonst weiter im Glauben, den
     Punkt beschrieben zu haben, und erfährt es erst beim Planer. */
  const abschluss = el('div', 'pk-abschluss');
  abschluss.appendChild(knopf('Fertig', () => {
    const fehlt = [];
    if (ist.art === 'offen') fehlt.push('die Art');
    if (ist.art === 'querung' && !ist.bauweise) fehlt.push('die Bauweise');
    /* Und die Zuordnung, wenn ein offener geplanter Punkt in Ortungsnähe liegt
       und der Trupp nicht selbst „zusätzlich“ gesagt hat – das ist der Fall,
       in dem zwei Punkte in Frage kamen und deshalb nichts vorgeschlagen
       wurde. Sonst blieb „0 von 3 geplanten bestätigt“ ohne ein Wort. */
    const nah = !ist.sollPunkt && selbstGewaehlt !== ist.id ? offeneSollPunkte(s, ist)[0] : null;
    if (nah && nah.weg < ABWEICHUNG_SCHWELLE) {
      fehlt.push(`die Zuordnung (Punkt ${nah.nr} liegt ${formatLaenge(nah.weg)} daneben)`);
    }
    punktkarteSchliessen();
    if (fehlt.length) {
      hinweis(`Punkt steht, ${fehlt.join(' und ')} ${fehlt.length > 1 ? 'fehlen' : 'fehlt'} – ` +
        'der Bau-Reiter führt hin.', 'warnung');
    }
  }, 'primaer'));
  box.appendChild(abschluss);
  return box;
}

// ------------------------------------------------------------ Das Fehlerblatt

/* Die Ortung ist der eine der drei Wege, der scheitern kann – im Fahrzeug,
   unter Bewuchs, ohne Freigabe. Vorher blieb davon ein Satz in der Pille, der
   mit einem Doppelpunkt endete, und der Trupp drückte noch einmal denselben
   Griff. Jetzt steht der Grund im Blatt und darunter beides, was hilft: noch
   einmal orten (das Gerät sucht oft schon, nur langsamer als die zwölf
   Sekunden) und den Punkt auf der Karte setzen – und zwar mit allem, was die
   Aufnahme sonst mitbekommen hätte: geplanter Punkt, Bauweise, Bauabschnitt.
   Ohne das verlöre der Trupp mit dem Fehlversuch auch die Zuordnung. */
function fehlerBlatt(s, f) {
  const box = el('div', 'pk-ist pk-fehler');
  const soll = f.sollPunktId ? s.punkte.find(pt => pt.id === f.sollPunktId) : null;
  const nr = soll ? s.punkte.indexOf(soll) + 1 : 0;
  box.appendChild(kopf(soll ? `Punkt ${nr}` : 'Kein Standort',
    soll ? punktartText(soll) : '', s));
  box.appendChild(el('p', 'pk-fehlertext', escapeHtml(f.text)));

  const tasten = el('div', 'pk-tasten pk-aufnahme');
  tasten.appendChild(knopf('◉ Noch einmal orten', () => {
    punktkarteSchliessen();
    istPunktAusStandort(s.id, f.sollPunktId || null, {
      ersetzt: f.ersetzt || null,
      danach: (st, pt) => punktkarteOeffnen(st, { ist: pt })
    });
  }, 'bau-taste'));
  tasten.appendChild(knopf('✛ Auf Karte setzen', () => {
    const a = aktiverBauabschnitt(s);
    punktkarteSchliessen();
    ctx.sl.starteIstSetzen(s.id, {
      ersetzt: f.ersetzt || null,
      sollPunkt: f.sollPunktId || null,
      ...(soll ? { art: soll.art, bauweise: soll.art === 'querung' ? soll.bauweise : null } : {}),
      abschnitt: a ? a.id : null
    });
    ctx.modusAnzeigen();
    hinweis('Auf die Karte tippen, wo der Punkt wirklich liegt.');
  }, 'bau-taste primaer'));
  box.appendChild(tasten);
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
