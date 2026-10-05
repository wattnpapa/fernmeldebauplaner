// ziehen.js – Kartenmarken mit der Maus ziehen, mit dem Finger erst nach Halten

/* Leaflets eigenes Ziehen beginnt mit der ersten Bewegung, gleich womit. Mit
   der Maus ist das richtig. Mit dem Finger nicht: die Trefferfläche eines
   Trassenpunktes misst 44 px, und wer über eine gewählte Strecke wischt, um
   die Karte zu verschieben, setzt den Finger früher oder später auf eine
   Marke. Im Review verschob ein Wisch, 6 px neben Punkt 1 begonnen, den Punkt
   um rund 200 m – still, und mit derselben Geste, die sonst die Karte bewegt.

   Am Finger zieht eine Marke deshalb erst, wenn sie gehalten wurde. Bis dahin
   gehört die Geste der Karte: wer wischt, verschiebt die Ansicht. Die Marke
   zeigt das Halten an, und erst danach folgt sie dem Finger. Die Maus zieht
   wie bisher sofort – dort gibt es den Unterschied zwischen Wischen und
   Ziehen nicht.

   Leaflets `draggable` bleibt dafür aus und das Ziehen läuft hier über
   Zeigerereignisse. Leaflet selbst kann es nicht nach Zeigerart trennen: sein
   Ziehen hängt am Element und greift bei Finger und Maus gleich, und ein
   Riegel davor, der die Berührung abfinge, nähme sie auch der Karte – dann
   ließe sich über einer Marke gar nicht mehr wischen. */

/** Wie lange der Finger stehen muss, bis die Marke ihm folgt. Kürzer als
 *  das lange Drücken des Systems (rund 500 ms), damit die Marke vor dem
 *  Kontextmenü des Browsers zugreift; lang genug, dass ein Wisch, der auf
 *  einer Marke beginnt, sie nie erreicht. */
export const HALTEN_MS = 450;
/* Bis hierhin gilt der Finger als stehend. Ein Handschuh zittert um einige
   Bildpunkte; erst darüber hinaus ist es ein Wisch, und der gehört der Karte.
   14 und nicht mehr 10: im Review zitterte die Handschuhkuppe beim Halten
   über 10 px, und das Halten endete still als Fehlstart – die Marke blieb
   liegen, ohne dass etwas sagte, warum. Ein Wisch dagegen läuft in den
   ersten Millisekunden weit über 14 px hinaus; die Schwelle trennt ihn
   weiterhin sicher vom Halten. */
const RUHE_PX = 14;
/* So weit über dem Finger steht die Marke, solange sie am Finger gezogen
   wird. Unter der Kuppe – mit Handschuh rund 15 mm – war der Ort, an dem sie
   landet, nicht zu sehen, und abgesetzt wurde auf gut Glück. 40 px liegen
   knapp über der Kuppe; weiter oben verlöre die Marke den Bezug zum Finger.
   Die Maus zieht ohne Versatz: ihr Zeiger verdeckt nichts. */
const VERSATZ_PX = 40;
/* Wer so lange stand und dann doch abrutschte, wollte halten und nicht
   wischen – ein Wisch setzt sich in den ersten Millisekunden in Bewegung.
   Dann sagt es die Anwendung einmal (`fbp:ziehen-fehlstart`, js/app.js). */
const FEHLSTART_MS = 200;
/* Leaflets eigene Schwelle für die Maus: ein Klick, der um drei Bildpunkte
   verrutscht, bleibt ein Klick und kein Ziehen. */
const MAUS_PX = 3;

/* Nach einem Ziehen löst der Browser beim Loslassen noch einen Klick aus. Auf
   der Marke wählte er sie noch einmal, auf der Karte – wo der Finger nach dem
   Ziehen liegt – nähme ihn ein Setzmodus als Ort. Er wird einmal verschluckt,
   und nur dort, wo losgelassen wurde: ein schneller Griff auf „↶“ gleich
   danach ist kein Rest der Geste und muss ankommen. */
let klickSperre = null;
document.addEventListener('click', e => {
  const k = klickSperre;
  if (!k || Date.now() > k.bis) return;
  if (Math.hypot(e.clientX - k.x, e.clientY - k.y) > 16) return;
  klickSperre = null;
  e.stopPropagation(); e.preventDefault();
}, true);

/**
 * Eine Marke ziehbar machen.
 *
 * `start()` läuft beim ersten Schritt des Ziehens, nicht schon beim Halten:
 * wer hält und ohne Bewegung loslässt, hat nichts geändert, und ein leerer
 * Rückgängig-Schritt wäre ein Griff auf „↶“, der nichts tut.
 * `ziehen(latlng)` folgt jedem Schritt, `ende(latlng, ausgang)` schließt ab –
 * nur nach einem echten Schritt, und nach einem Abbruch mit dem Ausgangsort.
 */
export function ziehbar(karte, marke, { start = () => {}, ziehen = () => {}, ende = () => {} }) {
  const binden = () => {
    const el = marke.getElement();
    if (!el || el._fbpZiehbar) return;
    el._fbpZiehbar = true;
    el.classList.add('leaflet-marker-draggable');
    el.addEventListener('pointerdown', e => anfassen(karte, marke, el, e, { start, ziehen, ende }));
    /* Das lange Drücken öffnet sonst das Kontextmenü des Browsers – über einer
       Marke, die man gerade ziehen will, ist das nur im Weg. */
    el.addEventListener('contextmenu', e => e.preventDefault());
  };
  marke.on('add', binden);
  binden();
  return marke;
}

function anfassen(karte, marke, el, e, { start, ziehen, ende }) {
  if (e.button !== 0 || !e.isPrimary) return;
  const finger = e.pointerType !== 'mouse';
  const ausgang = marke.getLatLng();
  const ausgangPunkt = karte.latLngToContainerPoint(ausgang);
  const x0 = e.clientX, y0 = e.clientY;
  const t0 = performance.now();
  let gegriffen = !finger;   // die Maus greift sofort, der Finger nach dem Halten
  let gezogen = false;
  let uhr = null;

  /* Die Maus nimmt der Karte das Ziehen gleich ab: die Marke liegt über ihr,
     und sonst wanderten beide. Der Finger lässt es ihr, bis er gehalten hat. */
  const karteZiehtWar = karte.dragging.enabled();
  if (!finger) karte.dragging.disable();

  const greifen = () => {
    gegriffen = true;
    el.classList.remove('haelt');
    el.classList.add('gehalten');
    /* Ein laufendes Verschieben der Karte – ein paar Bildpunkte sind es
       innerhalb der Ruheschwelle – endet hier, die Marke übernimmt. */
    karte.dragging.disable();
    try { navigator.vibrate?.(15); } catch { /* ohne Rüttler eben ohne */ }
  };
  if (finger) {
    el.classList.add('haelt');
    uhr = setTimeout(greifen, HALTEN_MS);
  }

  const bewegen = ev => {
    if (ev.pointerId !== e.pointerId) {
      /* Ein zweiter Finger heißt Zoomen, nicht Ziehen. */
      if (!gegriffen) aufraeumen(false);
      return;
    }
    const dx = ev.clientX - x0, dy = ev.clientY - y0;
    if (!gegriffen) {
      if (Math.hypot(dx, dy) > RUHE_PX) {
        if (finger && performance.now() - t0 >= FEHLSTART_MS) {
          document.dispatchEvent(new CustomEvent('fbp:ziehen-fehlstart'));
          /* Auch der Klick beim Loslassen gehört noch zum Halten: er wählte
             sonst die Marke oder setzte eine Koordinate, wo der Finger
             abgerutscht war. */
          document.addEventListener('pointerup', auf => {
            if (auf.pointerId !== e.pointerId) return;
            klickSperre = { bis: Date.now() + 400, x: auf.clientX, y: auf.clientY };
          }, { capture: true, once: true });
        }
        aufraeumen(false);
      }
      return;
    }
    if (!gezogen && Math.hypot(dx, dy) <= (finger ? 0 : MAUS_PX)) return;
    ev.preventDefault();
    if (!gezogen) { gezogen = true; start(); }
    const ll = karte.containerPointToLatLng(
      ausgangPunkt.add(L.point(dx, dy - (finger ? VERSATZ_PX : 0))));
    marke.setLatLng(ll);
    ziehen(ll);
  };
  const loslassen = ev => {
    if (ev.pointerId !== e.pointerId) return;
    aufraeumen(ev.type === 'pointerup', ev);
  };

  function aufraeumen(abschliessen, ev = null) {
    clearTimeout(uhr);
    document.removeEventListener('pointermove', bewegen, true);
    document.removeEventListener('pointerup', loslassen, true);
    document.removeEventListener('pointercancel', loslassen, true);
    el.classList.remove('haelt', 'gehalten');
    if (karteZiehtWar) karte.dragging.enable();
    if (!gezogen) return;
    if (ev) klickSperre = { bis: Date.now() + 400, x: ev.clientX, y: ev.clientY };
    /* Bricht der Browser die Geste ab, gilt sie nicht: die Marke geht zurück,
       und nichts wird geschrieben, was niemand losgelassen hat. */
    if (!abschliessen) {
      marke.setLatLng(ausgang);
      ziehen(ausgang);
    }
    ende(abschliessen ? marke.getLatLng() : ausgang, ausgang);
  }

  document.addEventListener('pointermove', bewegen, true);
  document.addEventListener('pointerup', loslassen, true);
  document.addEventListener('pointercancel', loslassen, true);
}

/**
 * Am Finger melden, dass hier gehalten wird, ohne dass etwas zu ziehen ist.
 *
 * Gezogen wird nur ein Punkt der gewählten Strecke. Wer im Review einen Punkt
 * einer anderen hielt, sah nichts geschehen – kein Ring, keine Meldung – und
 * hielt das Ziehen für kaputt; dass erst gewählt sein muss, stand nur in der
 * Kurzanleitung. Dieselbe Haltezeit und dieselbe Ruheschwelle wie beim Ziehen,
 * damit ein Wisch über die Marke still bleibt.
 */
export function haltenOhneZiehen(marke, melden) {
  const binden = () => {
    const el = marke.getElement();
    if (!el || el._fbpHalten) return;
    el._fbpHalten = true;
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || !e.isPrimary) return;
      const x0 = e.clientX, y0 = e.clientY;
      const weg = () => {
        clearTimeout(uhr);
        document.removeEventListener('pointermove', bewegen, true);
        document.removeEventListener('pointerup', weg, true);
        document.removeEventListener('pointercancel', weg, true);
      };
      const bewegen = ev => {
        if (ev.pointerId !== e.pointerId ||
            Math.hypot(ev.clientX - x0, ev.clientY - y0) > RUHE_PX) weg();
      };
      const uhr = setTimeout(() => { weg(); melden(); }, HALTEN_MS);
      document.addEventListener('pointermove', bewegen, true);
      document.addEventListener('pointerup', weg, true);
      document.addEventListener('pointercancel', weg, true);
    });
  };
  marke.on('add', binden);
  binden();
  return marke;
}
