// cloud-ordner.js – Rückseite: ein Ordner auf diesem Gerät

/* Die Rückseite mit dem größten Nutzen je Aufwand. Der Nutzer wählt einen
   Ordner und erlaubt der Anwendung dauerhaft, hineinzuschreiben. Zeigt er
   dabei auf den Sync-Ordner eines Cloud-Programms, sind iCloud Drive,
   OneDrive, Dropbox, Nextcloud und Synology Drive miterledigt – ohne Konto,
   ohne Zugangsschlüssel, und ohne dass die Anwendung selbst ein einziges Byte
   überträgt. Das Übertragen bleibt Sache des Programms, das der Nutzer ohnehin
   laufen hat.

   Bezahlt wird das mit der Reichweite: die Dateisystem-Schnittstelle gibt es
   nur in Chrome und Edge. Firefox und Safari haben sie nicht. */

import {
  CloudFehler, KonfliktFehler, ablageLesen, ablageSchreiben, ablageLoeschen
} from './cloud.js';

const SCHLUESSEL = 'ordner-handle';

/* Das `FileSystemDirectoryHandle` lässt sich nicht in Text fassen – es geht
   nur in die IndexedDB. Es liegt deshalb nicht in den Verbindungsangaben,
   sondern daneben; die Angaben tragen nur den Namen zum Anzeigen. */

// ---------------------------------------------------------------- Einrichten

/**
 * Ordner auswählen lassen. Muss aus einem Klick heraus laufen – der Browser
 * öffnet den Auswahldialog sonst nicht.
 */
export async function einrichten() {
  if (typeof window.showDirectoryPicker !== 'function') {
    throw new CloudFehler('Dieser Browser kann keinen Ordner freigeben.');
  }
  let wahl;
  try {
    wahl = await window.showDirectoryPicker({ id: 'fbp-cloud', mode: 'readwrite' });
  } catch (e) {
    throw new CloudFehler('Es wurde kein Ordner ausgewählt.');
  }
  if (await wahl.requestPermission({ mode: 'readwrite' }) !== 'granted') {
    throw new CloudFehler('Ohne Schreibrecht auf den Ordner geht es nicht.');
  }
  await ablageSchreiben(SCHLUESSEL, wahl);
  return { angaben: { name: wahl.name }, name: wahl.name };
}

export async function abmelden() {
  await ablageLoeschen(SCHLUESSEL);
}

// ---------------------------------------------------------------- Rückseite

export function bauen(angaben) {
  /* Gearbeitet wird ab dem freigegebenen Ordner; den Unterordner
     `fmbauplaner.app` legt `cloud.js` für alle Rückseiten gleich davor. Er
     entsteht dabei beim ersten Schreiben und nicht schon beim Einrichten: wer
     eine Verbindung anlegt und nie eine Planung ablegt, soll keinen leeren
     Ordner vorfinden. Lesend wird deshalb nichts angelegt – dort heißt
     „nicht da“ schlicht „noch nichts abgelegt“. */
  const wurzel = () => ordnerGriff();

  return {
    async auflisten(pfad) {
      const ordner = await ordnerAn(await wurzel(), pfad, false);
      if (!ordner) return [];
      const raus = [];
      for await (const [name, griff] of ordner.entries()) {
        if (griff.kind === 'directory') { raus.push({ name, ordner: true, marke: null }); continue; }
        const datei = await griff.getFile();
        raus.push({ name, ordner: false, marke: marke(datei), groesse: datei.size });
      }
      return raus;
    },

    async lesen(pfad) {
      const griff = await dateiGriff(await wurzel(), pfad, false);
      if (!griff) return null;
      const datei = await griff.getFile();
      return { blob: datei, marke: marke(datei) };
    },

    async schreiben(pfad, blob, erwartet) {
      /* Ein Schreiben, das nur dann greift, wenn dort noch genau das liegt,
         was zuletzt gesehen wurde, kennt diese Schnittstelle nicht. Sie kann
         nur nachsehen und dann schreiben. Zwischen beidem bleibt ein Spalt,
         in den ein zweites Gerät hineinschreiben könnte – in der Praxis
         bedeutungslos, denn ein Sync-Programm braucht für dieselbe Datei
         Sekunden, nicht Millisekunden. Wo ein Anbieter es besser kann,
         nutzt seine Rückseite die eigene Marke des Servers.

         Nachgesehen wird ausdrücklich ohne `create`: ein Griff, der die Datei
         gleich anlegt, findet danach immer eine vor – und gerade die Prüfung
         „die darf es noch nicht geben“ schlüge damit jedes Mal fehl. */
      if (erwartet !== undefined) {
        const alterGriff = await dateiGriff(await wurzel(), pfad, false);
        let vorhanden = null;
        if (alterGriff) {
          try { vorhanden = marke(await alterGriff.getFile()); } catch (e) { vorhanden = null; }
        }
        if (erwartet === null ? vorhanden !== null : vorhanden !== erwartet) {
          throw new KonfliktFehler();
        }
      }

      const griff = await dateiGriff(await wurzel(), pfad, true);
      if (!griff) throw new CloudFehler('Die Datei ließ sich im Ordner nicht anlegen.');
      const strom = await griff.createWritable();
      await strom.write(blob);
      await strom.close();
      return marke(await griff.getFile());
    },

    async loeschen(pfad) {
      const teile = pfad.split('/');
      const name = teile.pop();
      const ordner = await ordnerAn(await wurzel(), teile.join('/'), false);
      if (!ordner) return;
      try { await ordner.removeEntry(name); } catch (e) { /* schon fort */ }
    },

    /** Nur zum Anzeigen im Einrichtungstext – der Ordner hat keine Adresse */
    beschreibung: () => `Ordner „${angaben.name || '?'}“ auf diesem Gerät`
  };
}

// ---------------------------------------------------------------- Innereien

/* Änderungszeit und Größe zusammen sind die Marke. Eine der beiden allein
   reichte nicht: die Größe bleibt gleich, wenn nur ein Komma umzieht, und die
   Änderungszeit springt bei manchen Sync-Programmen auf die Sekunde genau
   zurück, wenn sie eine Datei aus der Cloud neu schreiben. */
const marke = datei => `${datei.lastModified}:${datei.size}`;

let wurzelGriff = null;

async function ordnerGriff() {
  if (wurzelGriff) return wurzelGriff;
  const griff = await ablageLesen(SCHLUESSEL);
  if (!griff) throw new CloudFehler('Der freigegebene Ordner ist nicht mehr bekannt.', { erneuern: true });
  /* Nach dem Neustart des Browsers steht das Recht auf „prompt“: es lebt
     weiter, muss aber einmal je Sitzung bestätigt werden – und das geht nur
     aus einem Klick heraus. Deshalb wird hier nicht gefragt, sondern gemeldet;
     die Oberfläche bietet daraufhin „Ordner erneut freigeben“ an. */
  const stand = await griff.queryPermission({ mode: 'readwrite' });
  if (stand !== 'granted') {
    throw new CloudFehler('Der Ordner ist gesperrt und muss erneut freigegeben werden.',
      { erneuern: true });
  }
  wurzelGriff = griff;
  return griff;
}

/**
 * Den gemerkten Ordner erneut freigeben lassen. Läuft aus einem Klick heraus
 * und ist der Weg zurück, wenn `ordnerGriff()` mit `erneuern` abgebrochen hat.
 */
export async function erneuern() {
  const griff = await ablageLesen(SCHLUESSEL);
  if (!griff) throw new CloudFehler('Der Ordner ist nicht mehr bekannt – bitte neu auswählen.');
  if (await griff.requestPermission({ mode: 'readwrite' }) !== 'granted') {
    throw new CloudFehler('Ohne Schreibrecht auf den Ordner geht es nicht.');
  }
  wurzelGriff = griff;
  return { angaben: { name: griff.name }, name: griff.name };
}

/** Den Ordner an einem Pfad; `null`, wenn er nicht da ist und nicht angelegt wird */
async function ordnerAn(start, pfad, anlegen) {
  let hier = start;
  if (!hier) return null;
  for (const stueck of String(pfad || '').split('/').filter(Boolean)) {
    try { hier = await hier.getDirectoryHandle(stueck, { create: anlegen }); }
    catch (e) { return null; }
  }
  return hier;
}

async function dateiGriff(wurzel, pfad, anlegen) {
  if (!wurzel) return null;
  const teile = String(pfad).split('/').filter(Boolean);
  const name = teile.pop();
  const ordner = await ordnerAn(wurzel, teile.join('/'), anlegen);
  if (!ordner) return null;
  try { return await ordner.getFileHandle(name, { create: anlegen }); }
  catch (e) { return null; }
}
