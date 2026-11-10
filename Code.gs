/**
 * Inter-CVL ZESE — Réception des productions dans Google Drive — v4
 *
 * Déployer ce script comme Application Web :
 *   - Exécuter en tant que : Moi
 *   - Qui a accès : Toute personne disposant du lien (ou l'option équivalente)
 *
 * Le site envoie :
 *   - une sauvegarde JSON du carnet ;
 *   - le PDF réellement généré dans le navigateur.
 */

const ROOT_FOLDER_NAME = 'INTERCVL ZESE - Productions';
const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 Mo maximum par PDF
const ALLOWED_ATELIERS = ['atelier1', 'atelier2', 'atelier3', 'atelier-ia', 'charte-ia'];

function doGet() {
  try {
    // Ce test vérifie aussi que le script a bien été autorisé à utiliser Google Drive.
    DriveApp.getRootFolder().getName();
    return json_({
      ok: true,
      service: 'INTERCVL ZESE Drive receiver',
      version: 4,
      driveReady: true
    });
  } catch (err) {
    return json_({
      ok: false,
      service: 'INTERCVL ZESE Drive receiver',
      version: 4,
      driveReady: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}

/**
 * À exécuter UNE FOIS manuellement depuis l'éditeur Apps Script.
 * Cela déclenche l'autorisation Google Drive et crée le dossier racine.
 */
function setupIntercvl() {
  const root = getOrCreateFolder_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);
  Logger.log('INTERCVL prêt : ' + root.getName());
  return 'OK - ' + root.getName();
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Requête vide.');
    }

    const data = JSON.parse(e.postData.contents);
    const atelier = cleanToken_(data.atelier, 40);
    const tableName = cleanText_(data.tableName || 'table', 100);
    const action = data.action === 'pdf' ? 'pdf' : 'backup';

    if (!ALLOWED_ATELIERS.includes(atelier)) {
      throw new Error('Atelier non autorisé.');
    }

    const root = getOrCreateFolder_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);
    const workshopFolder = getOrCreateFolder_(root, folderNameForAtelier_(atelier));

    const now = new Date();
    const tz = Session.getScriptTimeZone() || 'Europe/Paris';
    const stamp = Utilities.formatDate(now, tz, 'yyyyMMdd_HHmmss');
    const base = `${stamp}_${cleanFilename_(tableName || 'table')}`;

    let jsonFile = null;
    if (data.jsonBackup !== undefined && data.jsonBackup !== null) {
      const jsonText = JSON.stringify(data.jsonBackup, null, 2);
      const jsonBlob = Utilities.newBlob(jsonText, 'application/json', `${base}_carnet.json`);
      jsonFile = workshopFolder.createFile(jsonBlob);
    }

    let pdfFile = null;
    if (action === 'pdf') {
      if (!data.pdfBase64) {
        throw new Error('Le PDF est absent de la requête.');
      }

      let b64 = String(data.pdfBase64).replace(/^data:application\/pdf;base64,/, '').replace(/\s+/g, '');
      const bytes = Utilities.base64Decode(b64);
      if (bytes.length < 1000) {
        throw new Error('PDF invalide ou anormalement petit.');
      }
      if (bytes.length > MAX_PDF_BYTES) {
        throw new Error('PDF trop volumineux (maximum 15 Mo).');
      }
      if (bytes[0] !== 37 || bytes[1] !== 80 || bytes[2] !== 68 || bytes[3] !== 70) {
        throw new Error('Le fichier reçu n’est pas un PDF valide.');
      }

      const requested = cleanFilename_(data.pdfFileName || `${base}.pdf`);
      const pdfName = requested.toLowerCase().endsWith('.pdf') ? requested : `${requested}.pdf`;
      const uniquePdfName = `${stamp}_${pdfName}`;
      const pdfBlob = Utilities.newBlob(bytes, 'application/pdf', uniquePdfName);
      pdfFile = workshopFolder.createFile(pdfBlob);
    }

    return json_({
      ok: true,
      pdfSaved: !!pdfFile,
      jsonSaved: !!jsonFile,
      folderName: workshopFolder.getName(),
      pdfName: pdfFile ? pdfFile.getName() : null,
      pdfUrl: pdfFile ? pdfFile.getUrl() : null,
      jsonUrl: jsonFile ? jsonFile.getUrl() : null
    });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function folderNameForAtelier_(atelier) {
  const names = {
    'atelier1': '01 - Atelier 1 - Faire Reseau',
    'atelier2': '02 - Atelier 2 - Vivre Reseau',
    'atelier3': '03 - Atelier 3 - Construire le Reseau',
    'atelier-ia': '04 - LAB IA',
    'charte-ia': '05 - Charte IA'
  };
  return names[atelier] || atelier;
}

function getOrCreateFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function cleanFilename_(value) {
  return cleanText_(value, 120)
    .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'production';
}

function cleanToken_(value, max) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max || 40);
}

function cleanText_(value, max) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max || 120);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
