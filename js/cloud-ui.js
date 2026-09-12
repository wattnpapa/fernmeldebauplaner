// cloud-ui.js – Oberfläche zum eigenen Speicher: Einrichten, Stand, Konflikt

/* Die Anbindung ist der einzige Teil dieser Anwendung, bei dem Planungsdaten
   das Gerät verlassen. Deshalb steht der Hinweis darauf hier im
   Einrichtungsgang und nicht im Kleingedruckten: er nennt, was übertragen
   wird, an wen, und wer über die dienstliche Seite entscheidet.

   Der zweite Teil ist die Standanzeige. Ohne sie glaubt der Nutzer, es sei
   gesichert, und es ist es nicht – das ist schlimmer als gar keine Anbindung,
   weil er sich dann auf sie verlässt. */

import { dialog, schliesseDialog, hinweis } from './ui.js';
import { escapeHtml } from './strecken.js';
import { store } from './state.js';
import {
  ANBIETER, anbieterById, verbindung, verbindungSetzen, verbindungTrennen,
  rueckwegAdresse, rueckseiteVergessen, WURZEL
} from './cloud.js';
import {
  abgleichLage, aufAbgleich, jetztAbgleichen, konfliktEntscheiden, konfliktVertagen,
  planungenAmSpeicher, vomSpeicherHolen, abgleichVergessen, bindungVon
} from './abgleich.js';

const $ = s => document.querySelector(s);

// ---------------------------------------------------------------- Bausteine

function el(tag, klasse, inhalt) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (inhalt !== undefined) e.innerHTML = inhalt;
  return e;
}

function knopf(text, tun, klasse = '') {
  const b = el('button', 'knopf ' + klasse, escapeHtml(text));
  b.type = 'button';
  b.onclick = tun;
  return b;
}

const zeitKurz = iso => {
  const d = new Date(iso);
  if (!iso || isNaN(d)) return '—';
  const heute = d.toDateString() === new Date().toDateString();
  return d.toLocaleString('de-DE', heute
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

// ---------------------------------------------------------------- Standanzeige

/* Sechs Zustände, und jeder sagt in wenigen Worten, woran der Nutzer ist.
   „bereit“ nennt die Uhrzeit: „gesichert“ ohne Zeitpunkt ist eine Behauptung,
   die sich nicht prüfen lässt. */
const STAND_TEXT = {
  aus:        () => '',
  bereit:     l => 'Speicher: ' + zeitKurz(l.seit),
  laeuft:     () => 'Speicher: wird übertragen …',
  ausstehend: () => 'Speicher: ausstehend',
  fehler:     () => 'Speicher: Fehler',
  anmeldung:  () => 'Speicher: Anmeldung erneuern',
  konflikt:   () => 'Speicher: Konflikt'
};

const STAND_TITEL = {
  bereit:     l => `Zuletzt vollständig übertragen: ${zeitKurz(l.seit)}`,
  laeuft:     () => 'Die Planung wird gerade zum Speicher übertragen.',
  ausstehend: () => 'Änderungen warten auf die Übertragung.',
  fehler:     l => l.meldung || 'Die Übertragung ist fehlgeschlagen.',
  anmeldung:  l => l.meldung || 'Die Anmeldung am Speicher muss erneuert werden.',
  konflikt:   () => 'Dieselbe Planung wurde auf einem zweiten Gerät geändert.'
};

/** Der Knopf in der Kopfzeile und die Zeile im Band darunter */
function standZeigen(lage) {
  const knopfEl = $('#cloudstatus');
  const bandEl = $('#sb-cloud');
  if (!knopfEl) return;

  const aus = lage.stand === 'aus';
  knopfEl.hidden = aus;
  if (bandEl) bandEl.hidden = aus;
  if (aus) return;

  const text = (STAND_TEXT[lage.stand] || STAND_TEXT.bereit)(lage);
  const mahnen = lage.stand === 'ausstehend' || lage.stand === 'anmeldung';
  const stoerung = lage.stand === 'fehler' || lage.stand === 'konflikt';
  knopfEl.textContent = text;
  knopfEl.title = (STAND_TITEL[lage.stand] || (() => ''))(lage);
  knopfEl.classList.toggle('mahnung', mahnen);
  knopfEl.classList.toggle('fehler', stoerung);
  if (bandEl) {
    bandEl.textContent = text;
    bandEl.classList.toggle('mahnung', mahnen);
    bandEl.classList.toggle('fehler', stoerung);
  }

  zeichneSpeicherAbschnitt();
}

let konfliktGezeigt = null;

/** Den Abgleich an die Oberfläche hängen. Läuft einmal beim Start. */
export function cloudUiStarten() {
  aufAbgleich(lage => {
    standZeigen(lage);
    /* Ein Konflikt darf nicht in einer Statuszeile versanden: er hält die
       Übertragung an, bis jemand entscheidet. Gezeigt wird er aber nur
       einmal je Fall – wer ihn wegklickt, findet ihn über den Knopf wieder. */
    if (lage.konflikt && konfliktGezeigt !== lage.konflikt.pid) {
      konfliktGezeigt = lage.konflikt.pid;
      konfliktDialog(lage.konflikt);
    }
    if (!lage.konflikt) konfliktGezeigt = null;
  });
  const knopfEl = $('#cloudstatus');
  if (knopfEl) knopfEl.onclick = speicherDialog;
  standZeigen(abgleichLage());
}

// ---------------------------------------------------------------- Hauptdialog

/** „Eigener Speicher“ – eingerichtet oder nicht, alles läuft über diesen Weg */
export function speicherDialog() {
  const v = verbindung();
  if (v) return standDialog(v);
  anbieterWahlDialog();
}

// -------------------------------------------------- ohne Verbindung

function anbieterWahlDialog() {
  const box = el('div', 'speicher-dialog');
  box.appendChild(hinweisKasten());

  box.appendChild(el('h3', 'gruppen-titel', 'Wohin die Planungen gehen sollen'));
  const liste = el('div', 'anbieterliste');
  for (const a of ANBIETER) {
    const kann = a.verfuegbar();
    const zeile = el('button', 'anbieter-zeile' + (kann ? '' : ' gesperrt'));
    zeile.type = 'button';
    zeile.disabled = !kann;
    zeile.innerHTML =
      `<b>${escapeHtml(a.name)}</b>
       <span class="klein">${escapeHtml(kann ? a.kurz : a.fehlt || a.kurz)}</span>`;
    zeile.onclick = () => einrichtenDialog(a);
    liste.appendChild(zeile);
  }
  box.appendChild(liste);

  dialog({
    titel: 'Eigenen Speicher einrichten',
    inhalt: box,
    breit: true,
    fuss: [{ text: 'Abbrechen', primaer: true }]
  });
}

/* Der Hinweis steht vor der Wahl und nicht dahinter: Wer schon einen Anbieter
   angetippt hat, liest keinen Absatz mehr, der ihm die Entscheidung abnimmt. */
function hinweisKasten() {
  const k = el('div', 'speicher-hinweis');
  k.innerHTML =
    `<p><b>Bis hierher hat diese Anwendung keine Planungsdaten nach außen gegeben.</b>
        Mit einer eingerichteten Verbindung ändert sich das: Von da an gehen die
        <b>vollständige Planung samt aller Koordinaten und Lichtbilder</b> an den
        Speicher, den du gleich auswählst. Das können Einsatzdaten sein.</p>
     <p>Wohin sie gehen, bestimmst du. Die Anwendung hat bei keinem Anbieter ein
        eigenes Konto – sie legt die Dateien in deinem ab. Ob eine <b>dienstliche</b>
        Planung des THW in einem privaten Cloudkonto liegen darf, ist keine
        technische Frage; das entscheidest du mit deinem Ortsverband.</p>
     <p class="klein">Der Rückweg: Die Verbindung lässt sich jederzeit trennen, und den
        Zugriff widerrufst du beim Anbieter selbst. Die abgelegten Dateien bleiben
        dabei liegen – sie zu löschen, ist deine Sache, nicht die dieses Programms.
        Zugangsschlüssel und Anmeldemarken liegen im Speicher dieses Browsers; auf
        einem geteilten Rechner gehört die Verbindung nach der Arbeit getrennt.</p>`;
  return k;
}

// -------------------------------------------------- Einrichtungsformular

function einrichtenDialog(anbieter, vorbelegung = {}) {
  const box = el('div', 'speicher-dialog');
  const anleitung = ANLEITUNG[anbieter.id];
  if (anleitung) box.appendChild(el('div', 'speicher-anleitung', anleitung()));

  const werte = {};
  for (const f of anbieter.felder) {
    werte[f.schluessel] = vorbelegung[f.schluessel] ?? f.vorgabe ?? '';
    box.appendChild(eingabefeld(f, werte));
  }

  const meldung = el('p', 'speicher-meldung');
  meldung.hidden = true;
  box.appendChild(meldung);

  const inhalt = dialog({
    titel: anbieter.name,
    inhalt: box,
    breit: true,
    fuss: [
      { text: 'Zurück', tun: () => { anbieterWahlDialog(); return false; } },
      { text: anbieter.id === 'ordner' ? 'Ordner wählen …' : 'Verbinden',
        primaer: true, tun: () => { verbinden(); return false; } }
    ]
  });

  const fussKnoepfe = document.getElementById('dialog-fuss').querySelectorAll('.knopf');
  const verbindenKnopf = fussKnoepfe[fussKnoepfe.length - 1];

  async function verbinden() {
    meldung.hidden = true;
    meldung.classList.remove('fehler');
    verbindenKnopf.disabled = true;
    verbindenKnopf.textContent = 'Verbinde …';
    try {
      const modul = await import(anbieter.modul);
      const ergebnis = await modul.einrichten(werte);
      await verbindungSetzen({
        anbieter: anbieter.id,
        angaben: ergebnis.angaben,
        name: ergebnis.name || anbieter.name,
        seit: new Date().toISOString()
      });
      schliesseDialog();
      hinweis(`Speicher verbunden: ${ergebnis.name || anbieter.name}`);
      zeichneSpeicherAbschnitt();
      jetztAbgleichen().catch(() => {});
    } catch (e) {
      meldung.textContent = e.message || String(e);
      meldung.classList.add('fehler');
      meldung.hidden = false;
    } finally {
      verbindenKnopf.disabled = false;
      verbindenKnopf.textContent = anbieter.id === 'ordner' ? 'Ordner wählen …' : 'Verbinden';
    }
  }

  /* Der Rückweg wird zum Kopieren angeboten und nicht nur zum Abschreiben:
     ein Tippfehler darin ist der häufigste Grund, aus dem eine Anmeldung ohne
     erkennbaren Grund scheitert. */
  if (anbieter.id !== 'ordner') inhalt.appendChild(rueckwegZeile());
}

function eingabefeld(f, werte) {
  const wrap = el('label', 'feld');
  wrap.appendChild(el('span', 'feld-titel', escapeHtml(f.titel) + (f.pflicht ? '' : ' (frei)')));
  let ein;
  if (f.typ === 'select') {
    ein = document.createElement('select');
    for (const [w, t] of f.werte) {
      const op = document.createElement('option');
      op.value = w; op.textContent = t;
      op.selected = String(werte[f.schluessel]) === String(w);
      ein.appendChild(op);
    }
  } else {
    ein = document.createElement('input');
    ein.type = f.typ || 'text';
    ein.autocomplete = f.typ === 'password' ? 'new-password' : 'off';
    ein.spellcheck = false;
    if (f.platzhalter) ein.placeholder = f.platzhalter;
    ein.value = werte[f.schluessel] || '';
  }
  ein.addEventListener(f.typ === 'select' ? 'change' : 'input',
    () => { werte[f.schluessel] = ein.value; });
  wrap.appendChild(ein);
  if (f.hinweis) wrap.appendChild(el('span', 'feld-fuss klein', escapeHtml(f.hinweis)));
  return wrap;
}

function rueckwegZeile() {
  const adresse = rueckwegAdresse();
  const zeile = el('div', 'rueckweg');
  zeile.innerHTML =
    `<span class="feld-titel">Rückweg (Redirect URI) – genau so beim Anbieter eintragen</span>
     <code class="mono">${escapeHtml(adresse)}</code>`;
  zeile.appendChild(knopf('Kopieren', () => {
    const lauf = navigator.clipboard?.writeText(adresse);
    if (!lauf) return hinweis('Kopieren nicht möglich', 'fehler');
    lauf.then(() => hinweis('Rückweg kopiert')).catch(() => hinweis('Kopieren nicht möglich', 'fehler'));
  }, 'klein'));
  return zeile;
}

// -------------------------------------------------- mit Verbindung

function standDialog(v) {
  const anbieter = anbieterById(v.anbieter);
  const lage = abgleichLage();
  const box = el('div', 'speicher-dialog');

  box.innerHTML =
    `<p><b>${escapeHtml(anbieter ? anbieter.name : v.anbieter)}</b> –
        ${escapeHtml(v.name || '')}<br>
        <span class="klein">Verbunden seit ${escapeHtml(zeitKurz(v.seit))}.
        Die Planungen liegen dort im Ordner <b>${escapeHtml(WURZEL)}</b>, je Planung
        ein Unterordner mit <b>planung.json</b> und den Lichtbildern daneben.</span></p>`;

  const stand = el('p', 'speicher-stand' +
    (lage.stand === 'fehler' || lage.stand === 'konflikt' ? ' fehler' : ''));
  stand.textContent = standSatz(lage);
  box.appendChild(stand);

  const tasten = el('div', 'tastenreihe');
  if (lage.stand === 'anmeldung') {
    tasten.appendChild(knopf('Anmeldung erneuern', () => anmeldungErneuern(v), 'primaer'));
  } else if (lage.konflikt) {
    tasten.appendChild(knopf('Konflikt klären', () => konfliktDialog(lage.konflikt), 'primaer'));
  } else {
    tasten.appendChild(knopf('Jetzt abgleichen', () => {
      hinweis('Abgleich läuft …');
      jetztAbgleichen().catch(() => {});
      schliesseDialog();
    }, 'primaer'));
  }
  tasten.appendChild(knopf('Planungen am Speicher …', () => speicherlisteDialog()));
  box.appendChild(tasten);

  box.appendChild(el('p', 'klein',
    `Getrennt wird ohne Folgen für die Dateien: Sie bleiben liegen, wo sie sind.
     Der Zugriff dieser Anwendung auf dein Konto endet damit nicht von selbst –
     den widerrufst du beim Anbieter.`));

  dialog({
    titel: 'Eigener Speicher',
    inhalt: box,
    breit: true,
    fuss: [
      { text: 'Verbindung trennen', gefahr: true, tun: () => { trennenDialog(); return false; } },
      { text: 'Schließen', primaer: true }
    ]
  });
}

function standSatz(lage) {
  switch (lage.stand) {
    case 'bereit': return `Zuletzt vollständig übertragen: ${zeitKurz(lage.seit)}.`;
    case 'laeuft': return 'Es wird gerade übertragen …';
    case 'ausstehend': return lage.meldung ||
      'Änderungen warten auf die Übertragung – sie geht von selbst hinaus, sobald Netz da ist.';
    case 'fehler': return 'Die letzte Übertragung ist fehlgeschlagen: ' + lage.meldung;
    case 'anmeldung': return lage.meldung || 'Die Anmeldung am Speicher muss erneuert werden.';
    case 'konflikt': return lage.meldung || 'Es steht ein Konflikt an.';
    default: return 'Noch nichts übertragen.';
  }
}

async function anmeldungErneuern(v) {
  const anbieter = anbieterById(v.anbieter);
  try {
    const modul = await import(anbieter.modul);
    /* Ein Anbieter, der sich neu anmelden lässt, bringt `erneuern` mit; die
       übrigen führen über denselben Weg wie beim ersten Mal – bei ihnen sind
       die eingetragenen Angaben die Vorbelegung. */
    const ergebnis = modul.erneuern
      ? await modul.erneuern(v.angaben)
      : await modul.einrichten(v.angaben);
    await verbindungSetzen({ ...v, angaben: ergebnis.angaben, name: ergebnis.name || v.name });
    rueckseiteVergessen();
    schliesseDialog();
    hinweis('Anmeldung erneuert');
    jetztAbgleichen().catch(() => {});
  } catch (e) {
    hinweis(e.message || String(e), 'fehler');
  }
}

function trennenDialog() {
  const box = el('div');
  box.innerHTML =
    `<p>Die Verbindung wird getrennt. Ab dann bleibt jede Planung wieder <b>nur in
        diesem Browser</b> – und die Dateisicherung ist der einzige Weg nach außen.</p>
     <p class="klein">Was schon am Speicher liegt, bleibt dort unangetastet liegen.
        Löschen kannst du es nur dort selbst; ebenso den Zugriff dieser Anwendung
        auf dein Konto, den du beim Anbieter widerrufst.</p>`;
  dialog({
    titel: 'Verbindung trennen',
    inhalt: box,
    fuss: [
      { text: 'Abbrechen', tun: () => { speicherDialog(); return false; } },
      { text: 'Trennen', gefahr: true, tun: () => {
          verbindungTrennen()
            .then(() => abgleichVergessen())
            .then(() => { hinweis('Verbindung getrennt'); zeichneSpeicherAbschnitt(); })
            .catch(e => hinweis('Trennen fehlgeschlagen: ' + e.message, 'fehler'));
        } }
    ]
  });
}

// ---------------------------------------------------------------- Konflikt

/* Nicht zusammenführen, sondern nebeneinanderstellen und fragen. Der Dialog
   nennt zu beiden Ständen dasselbe: wann zuletzt geändert und wie viel darin
   steckt. Mehr braucht die Entscheidung nicht, und weniger reicht nicht. */
function konfliktDialog(k) {
  const box = el('div', 'konflikt');
  box.innerHTML =
    `<p>Die Planung <b>${escapeHtml(k.name)}</b> wurde auch auf einem anderen Gerät
        geändert. <b>Zusammengeführt wird nichts</b> – eine falsch verschmolzene Trasse
        wäre schlimmer als zwei Stände, zwischen denen du entscheidest.</p>
     <div class="konflikt-paar">
       ${fassung('Auf diesem Gerät', k.meine)}
       ${fassung('Am Speicher', k.fremde)}
     </div>`;

  dialog({
    titel: 'Zwei Stände derselben Planung',
    inhalt: box,
    breit: true,
    fuss: [
      { text: 'Später entscheiden', tun: () => { konfliktVertagen(); } },
      { text: 'Beide behalten', primaer: true, tun: () => entscheiden('beide') },
      { text: 'Dieses Gerät gilt', tun: () => entscheiden('meine') },
      { text: 'Speicher gilt', tun: () => entscheiden('fremde') }
    ]
  });

  function entscheiden(wahl) {
    konfliktEntscheiden(wahl)
      .then(() => hinweis(MELDUNG[wahl]))
      .catch(e => hinweis('Auflösen fehlgeschlagen: ' + e.message, 'fehler'));
  }
}

const MELDUNG = {
  meine: 'Der Stand dieses Geräts gilt und wurde übertragen.',
  fremde: 'Der Stand vom Speicher gilt – der eigene liegt als zweite Planung daneben.',
  beide: 'Beide Stände liegen jetzt als eigene Planungen vor.'
};

function fassung(titel, u) {
  const teile = [
    u.strecken && `${u.strecken} ${u.strecken === 1 ? 'Strecke' : 'Strecken'}`,
    u.punkte && `${u.punkte} Punkte`,
    u.zeichen && `${u.zeichen} Zeichen`,
    u.flaechen && `${u.flaechen} ${u.flaechen === 1 ? 'Fläche' : 'Flächen'}`,
    u.relaisstellen && `${u.relaisstellen} Relais`,
    u.bilder && `${u.bilder} ${u.bilder === 1 ? 'Bild' : 'Bilder'}`
  ].filter(Boolean);
  return `<div class="konflikt-fassung">
            <b>${escapeHtml(titel)}</b>
            <span class="klein">Geändert: ${escapeHtml(zeitKurz(u.geaendert))}</span>
            <span class="klein">${escapeHtml(teile.join(' · ') || 'leer')}</span>
          </div>`;
}

// ---------------------------------------------------------------- Speicherliste

function speicherlisteDialog() {
  const box = el('div', 'projektliste');
  box.appendChild(el('p', 'klein', 'Wird gelesen …'));
  dialog({
    titel: 'Planungen am Speicher',
    inhalt: box,
    breit: true,
    fuss: [{ text: 'Schließen', primaer: true }]
  });

  planungenAmSpeicher().then(liste => {
    box.innerHTML = '';
    if (!liste.length) {
      box.appendChild(el('p', 'klein',
        `Am Speicher liegt noch keine Planung. Sie entstehen dort von selbst,
         sobald der nächste Abgleich gelaufen ist.`));
      return;
    }
    box.appendChild(el('p', 'klein',
      `Eine Planung, die hier noch nicht liegt, wird beim Öffnen mitsamt ihren
       Lichtbildern auf dieses Gerät geholt.`));
    for (const p of liste) {
      const offen = store.projekt.id === p.pid;
      const zeile = el('div', 'pl-zeile' + (offen ? ' aktiv' : ''));
      const u = p.umfang;
      zeile.innerHTML =
        `<div class="pl-text"><b>${escapeHtml(p.name)}</b>
          <span class="klein">${u.strecken} Strecken · ${u.zeichen} Zeichen${
            u.bilder ? ` · ${u.bilder} Bilder` : ''} · ${escapeHtml(zeitKurz(p.geaendert))}${
            offen ? ' · <b class="pl-offen">gerade geöffnet</b>'
                  : p.hier ? ' · liegt auch hier' : ''}</span></div>`;
      const tasten = el('div', 'pl-tasten');
      const holen = knopf(p.hier ? 'Öffnen' : 'Holen und öffnen', () => {
        vomSpeicherHolen(p.ordner)
          .then(pr => { schliesseDialog(); hinweis(`„${pr.name}“ geöffnet`); })
          .catch(e => hinweis('Holen fehlgeschlagen: ' + e.message, 'fehler'));
      }, offen ? '' : 'primaer');
      holen.disabled = offen;
      tasten.appendChild(holen);
      zeile.appendChild(tasten);
      box.appendChild(zeile);
    }
  }).catch(e => {
    box.innerHTML = '';
    box.appendChild(el('p', 'klein', escapeHtml('Der Speicher ist nicht lesbar: ' + e.message)));
  });
}

// ---------------------------------------------------------------- Projektreiter

/** Der Abschnitt „Eigener Speicher“ im Reiter Projekt */
export function zeichneSpeicherAbschnitt() {
  const ziel = $('#projekt-cloud');
  if (!ziel) return;
  ziel.innerHTML = '';
  ziel.appendChild(el('h3', 'gruppen-titel', 'Eigener Speicher'));

  const v = verbindung();
  if (!v) {
    ziel.appendChild(el('p', 'klein',
      `Diese Planung liegt <b>nur in diesem Browser</b>. Wer sie auf einem zweiten Gerät
       weiterführen will – oder wem der Browserspeicher des iPads nach zwei Wochen Pause
       zu unsicher ist –, kann sie zusätzlich in einem eigenen Speicher ablegen:
       in einem Ordner auf dem Gerät, in Dropbox, OneDrive, Nextcloud, einem
       S3-Eimer oder Google Drive.`));
    const tasten = el('div', 'tastenreihe');
    tasten.appendChild(knopf('Speicher einrichten …', speicherDialog, 'primaer'));
    ziel.appendChild(tasten);
    return;
  }

  const lage = abgleichLage();
  const anbieter = anbieterById(v.anbieter);
  ziel.appendChild(el('p', 'klein',
    `Verbunden mit <b>${escapeHtml(anbieter ? anbieter.name : v.anbieter)}</b>
     (${escapeHtml(v.name || '')}). ${escapeHtml(standSatz(lage))}`));

  /* Was für diese eine Planung gilt, steht daneben: Der Gesamtstand sagt
     nichts darüber, ob ausgerechnet die offene schon oben liegt. */
  bindungVon(store.projekt.id).then(b => {
    if (!document.contains(ziel)) return;
    const zeile = el('p', 'klein', b && b.zuletzt
      ? `Diese Planung liegt am Speicher im Ordner <b>${escapeHtml(b.ordner)}</b>,
         zuletzt abgeglichen ${escapeHtml(zeitKurz(b.zuletzt))}.`
      : `Diese Planung ist noch nicht am Speicher – sie geht mit dem nächsten
         Abgleich hinaus.`);
    ziel.appendChild(zeile);
  }).catch(() => {});

  const tasten = el('div', 'tastenreihe');
  tasten.append(
    knopf('Jetzt abgleichen', () => {
      hinweis('Abgleich läuft …');
      jetztAbgleichen().catch(() => {});
    }, 'primaer'),
    knopf('Planungen am Speicher …', speicherlisteDialog),
    knopf('Verbindung …', speicherDialog)
  );
  ziel.appendChild(tasten);
}

// ---------------------------------------------------------------- Anleitungen

/* Was beim Anbieter einzurichten ist, bevor hier etwas eingetragen wird. Der
   Text steht vor dem Formular und nicht als Fehlermeldung dahinter: Wer alles
   ausgefüllt hat und dann erfährt, dass seine Nextcloud gar nicht in Frage
   kommt, hat die Zeit umsonst aufgewendet. */
const ANLEITUNG = {
  ordner: () =>
    `<p>Wähle im nächsten Schritt einen Ordner. Die Anwendung darf dann dauerhaft
        hineinschreiben und legt darin <b>${escapeHtml(WURZEL)}</b> an.</p>
     <p>Zeigst du auf den Sync-Ordner eines Cloud-Programms – iCloud Drive, OneDrive,
        Dropbox, Nextcloud, Synology Drive –, erledigt dessen Programm die
        Übertragung. Die Anwendung selbst gibt dabei <b>kein einziges Byte nach
        außen</b>: Für sie ist es ein Ordner wie jeder andere.</p>
     <p class="klein">Die Freigabe gilt für diesen Browser auf diesem Gerät. Nach einem
        Neustart des Browsers fragt er einmal nach, ob sie weiter gilt.</p>`,

  dropbox: () =>
    `<p>Lege dir auf <b>dropbox.com/developers/apps</b> eine eigene App an:
        „Scoped access“, Zugriff <b>App folder</b> (dann sieht die Anwendung nur
        ihren eigenen Ordner), und gib ihr einen Namen.</p>
     <p>Unter <b>Permissions</b> die vier Rechte setzen: <b>files.content.write</b>,
        <b>files.content.read</b>, <b>files.metadata.read</b> und
        <b>account_info.read</b>. Danach unter <b>Settings</b> den Rückweg unten als
        <b>Redirect URI</b> eintragen und den <b>App key</b> hier einsetzen.</p>
     <p class="klein">Ein App-Schlüssel ist kein Geheimnis: Bei einer Anwendung ohne
        Serveranteil ist er eine Kennung und steht ohnehin im Browser. Das
        <b>App secret</b> wird hier nicht gebraucht und gehört nirgendwo hinein.</p>`,

  onedrive: () =>
    `<p>Registriere unter <b>Microsoft Entra – App registrations</b> eine neue
        Anwendung. Als Plattform unbedingt <b>Single-page application (SPA)</b>
        wählen und nicht „Web“: Nur dann gibt Microsoft die Kopfzeilen frei, ohne
        die der Browser den Markentausch abbricht.</p>
     <p>Als <b>Redirect URI</b> den Rückweg unten eintragen, dann die
        <b>Application (client) ID</b> hier einsetzen. Weitere Rechte sind nicht
        einzustellen – <b>Files.ReadWrite</b> und <b>offline_access</b> erfragt die
        Anwendung bei der Anmeldung selbst.</p>
     <p class="klein">Bei einem dienstlichen Konto kann die Zustimmung beim
        Administrator liegen. Dann bricht die Anmeldung ab, und daran lässt sich
        von hier aus nichts ändern.</p>`,

  webdav: () =>
    `<p><b>Der Haken zuerst:</b> Nextcloud sendet über WebDAV keine CORS-Kopfzeilen.
        Der Browser bricht die Anfrage dann ab, bevor sie den Server überhaupt
        erreicht. Bei einer <b>fremden</b> Instanz, an deren Einstellungen du nicht
        herankommst, ist das das Ende – dort hilft nur der Weg über einen Ordner
        auf dem Gerät, in den der Nextcloud-Client synchronisiert.</p>
     <p>Bei einer <b>eigenen</b> Instanz ist es zu lösen: entweder die Kopfzeilen im
        Webserver setzen oder die Nextcloud-App <b>WebAppPassword</b> installieren,
        die genau das übernimmt. Von Hand gebraucht werden:
        <b>Access-Control-Allow-Origin</b> für <b>${escapeHtml(location.origin)}</b>,
        die Methoden <b>PROPFIND, PUT, DELETE, MKCOL</b>, die Kopfzeilen
        <b>Authorization, Content-Type, Depth, If-Match, If-None-Match,
        X-Requested-With</b> und <b>Access-Control-Expose-Headers: ETag</b>.
        <b>Authorization</b> muss dabei ausgeschrieben dastehen – ein Stern
        deckt sie nicht ab.</p>
     <p>Die Adresse des WebDAV-Ordners steht in Nextcloud unten links unter
        „Einstellungen“ in der Dateiansicht. Als Passwort ein
        <b>App-Passwort</b> erzeugen (Einstellungen → Sicherheit) und nicht das
        Kennwort des Kontos eintragen.</p>`,

  s3: () =>
    `<p>Lege einen Eimer an und dazu ein Schlüsselpaar, das nur auf ihn Zugriff
        hat. Der Eimer braucht eine <b>CORS-Regel</b>, sonst lässt der Browser keine
        Anfrage hinaus:</p>
     <pre class="mono">[{ "AllowedOrigins": ["${escapeHtml(location.origin)}"],
   "AllowedMethods": ["GET","PUT","DELETE","HEAD"],
   "AllowedHeaders": ["*"],
   "ExposeHeaders": ["ETag"] }]</pre>
     <p class="klein"><b>ExposeHeaders</b> mit <b>ETag</b> ist nicht optional: Ohne
        diese Freigabe kommt zwar jede Datei an, aber ohne Marke – und dann kann
        der Abgleich zwei Geräte nicht mehr auseinanderhalten.</p>
     <p class="klein">Der geheime Schlüssel liegt danach im Speicher dieses Browsers.
        Nimm deshalb ein Paar, das nur diesen einen Eimer öffnet, und nicht den
        Hauptschlüssel des Kontos.</p>`,

  gdrive: () =>
    `<p>Lege in der <b>Google Cloud Console</b> ein Projekt an, aktiviere die
        <b>Google Drive API</b> und erzeuge unter „Anmeldedaten“ eine
        <b>OAuth-Client-ID</b> vom Typ <b>Webanwendung</b>. Als „Autorisierten
        Weiterleitungs-URI“ den Rückweg unten eintragen, ebenso
        <b>${escapeHtml(location.origin)}</b> als autorisierte JavaScript-Quelle.</p>
     <p>Solange der Zustimmungsbildschirm auf „Testing“ steht, müssen die Konten,
        die ihn nutzen, dort als Testnutzer eingetragen sein.</p>
     <p class="klein">Der Weg, auf dem die Anmeldemarke hier ankommt, gilt bei Google als
        überholt. Er ist der einzige, der ohne Serveranteil auskommt – alle anderen
        verlangen beim Markentausch ein Client-Geheimnis, das eine Anwendung im Browser
        nicht haben kann. Es ist deshalb möglich, dass Google ihn für eine neu
        eingerichtete Client-ID ablehnt; dann bleibt einer der übrigen fünf Wege.</p>
     <p class="klein">Google gibt einer Anwendung ohne Serveranteil <b>keine Marke zum
        Auffrischen</b>. Die Anmeldung läuft deshalb nach etwa einer Stunde ab und
        muss von Hand erneuert werden; bis dahin warten die Änderungen als
        „ausstehend“. Der Zugriff beschränkt sich auf <b>drive.file</b> – Google
        zeigt der Anwendung nur, was sie selbst angelegt hat.</p>`
};
