/**
 * Inter-CVL ZESE — Réception des productions dans Google Drive — v5 (ajout du Projet d'établissement)
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

function doGet(e) {
  const peAction = e && e.parameter && e.parameter.action ? String(e.parameter.action) : '';
  if (peAction.indexOf('pe_') === 0) {
    return json_(handlePE_(peAction, {}, true));
  }
  try {
    // Ce test vérifie aussi que le script a bien été autorisé à utiliser Google Drive.
    DriveApp.getRootFolder().getName();
    return json_({
      ok: true,
      service: 'INTERCVL ZESE Drive receiver',
      version: 5,
      driveReady: true
    });
  } catch (err) {
    return json_({
      ok: false,
      service: 'INTERCVL ZESE Drive receiver',
      version: 5,
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

    // Projet d'établissement (groupes, rubriques, restitution, administration)
    if (typeof data.action === 'string' && data.action.indexOf('pe_') === 0) {
      return json_(handlePE_(data.action, data, false));
    }

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


/* ======================================================================
 * PROJET D'ÉTABLISSEMENT — Lycée franco-chypriote de Nicosie
 *
 * Base de données : une Google Sheet (4 onglets créés automatiquement)
 * Fichiers        : dossier Drive PE_FOLDER_ID
 *                     /Groupes   (un PDF par groupe, remplacé à chaque génération)
 *                     /Syntheses (synthèse automatique par axe, générée par l'admin)
 *                     /Bilans   (documents déposés par les administrateurs)
 *
 * CODE ADMINISTRATEUR : il n'est PAS écrit dans ce fichier (le dépôt GitHub est public).
 * Apps Script > Paramètres du projet > Propriétés du script > ajouter :
 *     ADMIN_CODE = (le code choisi)
 * ====================================================================== */

const PE_SHEET_ID = '1KEj4YgP8VOWd-A4YKXFiRpCQO2kMqdUkAJgjz87jKMk';
const PE_FOLDER_ID = '1JtXAPRibfLMAkrSsocTc8rLcPhhfkHUR';
const PE_SCHOOL = 'Lycée franco-chypriote de Nicosie';
const PE_MAX_FILE_BYTES = 15 * 1024 * 1024;
const PE_FILE_EXT = ['pdf', 'doc', 'docx', 'odt', 'xls', 'xlsx', 'ppt', 'pptx', 'png', 'jpg', 'jpeg'];

const PE_TABS = {
  Groupes: ['id', 'axe', 'numero', 'membres', 'statut', 'creeLe', 'majLe', 'docUrl', 'docId', 'docLe'],
  Rubriques: ['id', 'groupeId', 'titre', 'auteur', 'creeLe'],
  Contributions: ['id', 'groupeId', 'rubriqueId', 'type', 'parentId', 'texte', 'auteur', 'creeLe', 'majLe'],
  Bilans: ['id', 'axe', 'titre', 'fileName', 'fileUrl', 'fileId', 'creeLe']
};

/** À exécuter UNE FOIS depuis l'éditeur : autorise Sheets + Drive et crée les onglets et dossiers. */
function setupProjetEtablissement() {
  Object.keys(PE_TABS).forEach(peSheet_);
  const root = DriveApp.getFolderById(PE_FOLDER_ID);
  getOrCreateFolder_(root, 'Groupes');
  getOrCreateFolder_(root, 'Bilans');
  const hasCode = !!PropertiesService.getScriptProperties().getProperty('ADMIN_CODE');
  Logger.log('Projet d\'établissement prêt. Code admin configuré : ' + hasCode);
  return 'OK - code admin configuré : ' + hasCode;
}

function handlePE_(action, p, isGet) {
  try {
    if (action === 'pe_data') return peData_();
    if (isGet) throw new Error('Action inconnue.');

    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      switch (action) {
        case 'pe_createGroup': return peCreateGroup_(p);
        case 'pe_joinGroup': return peJoinGroup_(p);
        case 'pe_joinOrCreate': return peJoinOrCreate_(p);
        case 'pe_setMembers': return peSetMembers_(p);
        case 'pe_addRubrique': return peAddRubrique_(p);
        case 'pe_editRubrique': return peEditRubrique_(p);
        case 'pe_deleteRubrique': return peDeleteRubrique_(p);
        case 'pe_addContribution': return peAddContribution_(p);
        case 'pe_editContribution': return peEditContribution_(p);
        case 'pe_deleteContribution': return peDeleteContribution_(p);
        case 'pe_generateDoc': return peGenerateDoc_(p);
        case 'pe_adminCheck': peRequireAdmin_(p.code); return { ok: true };
        case 'pe_adminDeleteGroup': return peAdminDeleteGroup_(p);
        case 'pe_uploadBilan': return peUploadBilan_(p);
        case 'pe_adminAxePdf': return peAdminAxePdf_(p);
        case 'pe_deleteBilan': return peDeleteBilan_(p);
        default: throw new Error('Action inconnue.');
      }
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/* ---------- Accès Sheet ---------- */

function peSheet_(name) {
  const ss = SpreadsheetApp.openById(PE_SHEET_ID);
  const headers = PE_TABS[name];
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@'); // tout en texte : aucune formule possible
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function peRead_(name) {
  const sh = peSheet_(name);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(r => r[0] !== '').map(r => {
    const o = {};
    headers.forEach((h, i) => { o[h] = r[i] === null || r[i] === undefined ? '' : String(r[i]); });
    return o;
  });
}

function peAppend_(name, obj) {
  const sh = peSheet_(name);
  const headers = PE_TABS[name];
  const row = sh.getLastRow() + 1;
  const range = sh.getRange(row, 1, 1, headers.length);
  range.setNumberFormat('@');
  range.setValues([headers.map(h => (obj[h] === undefined || obj[h] === null) ? '' : String(obj[h]))]);
}

function peRowOf_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(1, 1, last, 1).getValues();
  for (let i = 1; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 1;
  return -1;
}

function peUpdate_(name, id, patch) {
  const sh = peSheet_(name);
  const headers = PE_TABS[name];
  const row = peRowOf_(sh, id);
  if (row < 0) throw new Error('Élément introuvable.');
  const range = sh.getRange(row, 1, 1, headers.length);
  const cur = range.getValues()[0];
  const next = headers.map((h, i) => patch[h] !== undefined ? String(patch[h]) : cur[i]);
  range.setNumberFormat('@');
  range.setValues([next]);
}

function peDeleteIds_(name, ids) {
  if (!ids.length) return;
  const sh = peSheet_(name);
  const rows = ids.map(id => peRowOf_(sh, id)).filter(r => r > 0).sort((a, b) => b - a);
  rows.forEach(r => sh.deleteRow(r));
}

function peGet_(name, id) {
  const found = peRead_(name).filter(o => o.id === String(id))[0];
  if (!found) throw new Error('Élément introuvable.');
  return found;
}

function peNow_() { return new Date().toISOString(); }
function peId_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 10); }

function peIsAdmin_(code) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_CODE');
  return !!expected && String(code || '').trim() === String(expected).trim();
}

function peRequireAdmin_(code) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('pe_admin_fails') || 0);
  if (fails >= 10) throw new Error('Trop de tentatives. Réessayez dans quelques minutes.');
  if (!PropertiesService.getScriptProperties().getProperty('ADMIN_CODE')) {
    throw new Error('Le code administrateur n\'est pas configuré dans Apps Script (propriété ADMIN_CODE).');
  }
  if (!peIsAdmin_(code)) {
    cache.put('pe_admin_fails', String(fails + 1), 600);
    throw new Error('Code administrateur incorrect.');
  }
}

/* ---------- Nettoyage des entrées ---------- */

function peClean_(v, max) { return cleanText_(v, max); }

function peCleanLong_(v, max) {
  return String(v || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim().slice(0, max || 5000);
}

function peMembers_(list) {
  const out = [];
  (Array.isArray(list) ? list : []).slice(0, 15).forEach(m => {
    const prenom = peClean_(m && m.prenom, 60);
    const nom = peClean_(m && m.nom, 60);
    if (!prenom && !nom) return;
    const dup = out.some(o => o.prenom.toLowerCase() === prenom.toLowerCase() && o.nom.toLowerCase() === nom.toLowerCase());
    if (!dup) out.push({ prenom, nom });
  });
  return out;
}

function peParseMembers_(s) { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }

function peAuthor_(v) {
  const a = peClean_(v, 120);
  if (!a) throw new Error('Indiquez votre nom et votre prénom.');
  return a;
}

function peSameAuthor_(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }

/* ---------- Lecture ---------- */

function peData_() {
  const groupes = peRead_('Groupes').map(g => {
    g.membres = peParseMembers_(g.membres);
    return g;
  });
  return {
    ok: true,
    now: peNow_(),
    groupes,
    rubriques: peRead_('Rubriques'),
    contributions: peRead_('Contributions'),
    bilans: peRead_('Bilans')
  };
}

/* ---------- Groupes ---------- */

function peCreateGroup_(p) {
  const axe = Number(p.axe), numero = Number(p.numero);
  if (!(axe >= 1 && axe <= 4)) throw new Error('Axe invalide.');
  if (!(numero >= 1 && numero <= 30)) throw new Error('Numéro de groupe invalide.');
  const membres = peMembers_(p.membres);
  if (!membres.length) throw new Error('Ajoutez au moins un membre au groupe.');
  const exists = peRead_('Groupes').some(g => Number(g.axe) === axe && Number(g.numero) === numero);
  if (exists) throw new Error('Ce groupe existe déjà pour cet axe : rejoignez-le plutôt que d\'en créer un second.');
  const now = peNow_();
  const g = { id: peId_(), axe, numero, membres: JSON.stringify(membres), statut: 'En cours', creeLe: now, majLe: now, docUrl: '', docId: '', docLe: '' };
  peAppend_('Groupes', g);
  return { ok: true, groupId: g.id };
}

function peJoinGroup_(p) {
  const g = peGet_('Groupes', p.groupId);
  const membres = peMembers_(peParseMembers_(g.membres).concat(peMembers_([{ prenom: p.prenom, nom: p.nom }])));
  peUpdate_('Groupes', g.id, { membres: JSON.stringify(membres), majLe: peNow_() });
  return { ok: true };
}

/** Rejoint le groupe (axe, numéro) avec une ou plusieurs personnes ; le groupe est créé à la première arrivée. */
function peJoinOrCreate_(p) {
  const axe = Number(p.axe), numero = Number(p.numero);
  if (!(axe >= 1 && axe <= 4)) throw new Error('Axe invalide.');
  if (!(numero >= 1 && numero <= 30)) throw new Error('Numéro de groupe invalide.');
  const nouveaux = peMembers_(p.membres);
  if (!nouveaux.length) throw new Error('Indiquez au moins une personne devant l\'écran.');
  const existing = peRead_('Groupes').filter(g => Number(g.axe) === axe && Number(g.numero) === numero)[0];
  const now = peNow_();
  if (!existing) {
    const g = { id: peId_(), axe, numero, membres: JSON.stringify(nouveaux), statut: 'En cours', creeLe: now, majLe: now, docUrl: '', docId: '', docLe: '' };
    peAppend_('Groupes', g);
    return { ok: true, groupId: g.id, created: true };
  }
  const membres = peMembers_(peParseMembers_(existing.membres).concat(nouveaux));
  peUpdate_('Groupes', existing.id, { membres: JSON.stringify(membres) });
  return { ok: true, groupId: existing.id, created: false };
}

function peSetMembers_(p) {
  const g = peGet_('Groupes', p.groupId);
  const membres = peMembers_(p.membres);
  if (!membres.length) throw new Error('Un groupe doit garder au moins un membre.');
  peUpdate_('Groupes', g.id, { membres: JSON.stringify(membres), majLe: peNow_() });
  return { ok: true };
}

function peTouchGroup_(groupId) { peUpdate_('Groupes', groupId, { majLe: peNow_(), statut: 'En cours' }); }

/* ---------- Rubriques ---------- */

function peAddRubrique_(p) {
  const g = peGet_('Groupes', p.groupId);
  const titre = peClean_(p.titre, 200);
  if (!titre) throw new Error('Donnez un titre à la rubrique.');
  const r = { id: peId_(), groupeId: g.id, titre, auteur: peAuthor_(p.auteur), creeLe: peNow_() };
  peAppend_('Rubriques', r);
  peTouchGroup_(g.id);
  return { ok: true, rubriqueId: r.id };
}

function peEditRubrique_(p) {
  const r = peGet_('Rubriques', p.rubriqueId);
  const titre = peClean_(p.titre, 200);
  if (!titre) throw new Error('Le titre ne peut pas être vide.');
  peUpdate_('Rubriques', r.id, { titre });
  peTouchGroup_(r.groupeId);
  return { ok: true };
}

function peDeleteRubrique_(p) {
  const r = peGet_('Rubriques', p.rubriqueId);
  const admin = peIsAdmin_(p.code);
  const contribs = peRead_('Contributions').filter(c => c.rubriqueId === r.id);
  if (!admin) {
    if (!peSameAuthor_(r.auteur, p.auteur)) throw new Error('Seul l\'auteur de la rubrique (ou un administrateur) peut la supprimer.');
    if (contribs.some(c => !peSameAuthor_(c.auteur, p.auteur))) throw new Error('D\'autres personnes ont contribué à cette rubrique : seul un administrateur peut la supprimer.');
  }
  peDeleteIds_('Contributions', contribs.map(c => c.id));
  peDeleteIds_('Rubriques', [r.id]);
  peTouchGroup_(r.groupeId);
  return { ok: true };
}

/* ---------- Contributions (questionnements et réflexions) ---------- */

function peAddContribution_(p) {
  const r = peGet_('Rubriques', p.rubriqueId);
  const type = p.type === 'question' ? 'question' : 'reflexion';
  const texte = peCleanLong_(p.texte, 5000);
  if (!texte) throw new Error('Le texte est vide.');
  let parentId = '';
  if (type === 'reflexion' && p.parentId) {
    const q = peGet_('Contributions', p.parentId);
    if (q.type !== 'question' || q.rubriqueId !== r.id) throw new Error('Questionnement introuvable.');
    parentId = q.id;
  }
  const now = peNow_();
  const c = { id: peId_(), groupeId: r.groupeId, rubriqueId: r.id, type, parentId, texte, auteur: peAuthor_(p.auteur), creeLe: now, majLe: now };
  peAppend_('Contributions', c);
  peTouchGroup_(r.groupeId);
  return { ok: true, id: c.id };
}

function peEditContribution_(p) {
  const c = peGet_('Contributions', p.id);
  const texte = peCleanLong_(p.texte, 5000);
  if (!texte) throw new Error('Le texte est vide.');
  peUpdate_('Contributions', c.id, { texte, majLe: peNow_() });
  peTouchGroup_(c.groupeId);
  return { ok: true };
}

function peDeleteContribution_(p) {
  const c = peGet_('Contributions', p.id);
  const admin = peIsAdmin_(p.code);
  if (!admin && !peSameAuthor_(c.auteur, p.auteur)) throw new Error('Seul l\'auteur (ou un administrateur) peut supprimer cette contribution.');
  const children = c.type === 'question' ? peRead_('Contributions').filter(x => x.parentId === c.id) : [];
  if (!admin && children.some(x => !peSameAuthor_(x.auteur, p.auteur))) {
    throw new Error('D\'autres personnes ont répondu à ce questionnement : seul un administrateur peut le supprimer.');
  }
  peDeleteIds_('Contributions', children.map(x => x.id).concat([c.id]));
  peTouchGroup_(c.groupeId);
  return { ok: true };
}

/* ---------- Document du groupe (PDF dans Drive) ---------- */

function esc_(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

const PE_PDF_CSS = 'body{font-family:Arial,Helvetica,sans-serif;color:#242038;font-size:11pt;line-height:1.45}' +
  'h1{color:#211d47;font-size:22pt;margin:0 0 4px}h2{color:#c20a73;font-size:15pt;margin:22px 0 6px;border-bottom:2px solid #c20a73;padding-bottom:3px}' +
  'h3{font-size:11.5pt;color:#211d47;margin:14px 0 4px}h4{font-size:13pt;color:#211d47;margin:26px 0 2px}.meta{color:#5a5670;font-size:10pt;margin:2px 0}' +
  '.q{background:#f4f0f7;border-left:4px solid #211d47;padding:6px 10px;margin:10px 0 4px}' +
  '.r{border-left:4px solid #c20a73;padding:4px 10px;margin:4px 0 6px 14px;background:#fbf8fb}' +
  '.by{color:#6a6580;font-size:9pt}.foot{margin-top:28px;color:#8a8598;font-size:9pt;border-top:1px solid #ddd;padding-top:6px}';

function peRubriquesHtml_(rubriques, contribs) {
  let h = '';
  if (!rubriques.length) h += '<p><i>Aucune rubrique n\'a encore été saisie.</i></p>';
  rubriques.forEach(r => {
    h += '<h2>' + esc_(r.titre) + '</h2>';
    const rc = contribs.filter(c => c.rubriqueId === r.id);
    const questions = rc.filter(c => c.type === 'question');
    const libres = rc.filter(c => c.type === 'reflexion' && !c.parentId);
    questions.forEach(q => {
      h += '<div class="q"><b>Questionnement</b> — ' + esc_(q.texte) + ' <span class="by">(' + esc_(q.auteur) + ')</span></div>';
      const rep = rc.filter(c => c.parentId === q.id);
      if (!rep.length) h += '<div class="r"><i>Pas encore de réflexion.</i></div>';
      rep.forEach(x => { h += '<div class="r">' + esc_(x.texte) + '<div class="by">— ' + esc_(x.auteur) + '</div></div>'; });
    });
    if (libres.length) {
      h += '<h3>Réflexions complémentaires</h3>';
      libres.forEach(x => { h += '<div class="r">' + esc_(x.texte) + '<div class="by">— ' + esc_(x.auteur) + '</div></div>'; });
    }
    if (!rc.length) h += '<p><i>Rubrique vide.</i></p>';
  });
  return h;
}

function peGroupHtml_(g, axeLabel, rubriques, contribs) {
  const membres = peParseMembers_(g.membres).map(m => esc_((m.prenom + ' ' + m.nom).trim())).join(', ');
  const tz = Session.getScriptTimeZone() || 'Europe/Nicosia';
  const date = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm');
  let h = '<html><head><meta charset="utf-8"><style>' + PE_PDF_CSS + '</style></head><body>';
  h += '<div class="meta">' + esc_(PE_SCHOOL) + ' — Projet d\'établissement</div>';
  h += '<h1>' + esc_(axeLabel) + ' — Groupe ' + esc_(g.numero) + '</h1>';
  h += '<div class="meta"><b>Membres :</b> ' + (membres || '—') + '</div>';
  h += '<div class="meta">Document généré le ' + esc_(date) + '</div>';
  h += peRubriquesHtml_(rubriques, contribs);
  h += '<div class="foot">Projet d\'établissement — ' + esc_(PE_SCHOOL) + ' — ' + esc_(axeLabel) + ', Groupe ' + esc_(g.numero) + '</div>';
  return h + '</body></html>';
}

function peGenerateDoc_(p) {
  const g = peGet_('Groupes', p.groupId);
  const axeLabel = peClean_(p.axeLabel, 120) || ('Axe ' + g.axe);
  const rubriques = peRead_('Rubriques').filter(r => r.groupeId === g.id);
  const contribs = peRead_('Contributions').filter(c => c.groupeId === g.id);
  const html = peGroupHtml_(g, axeLabel, rubriques, contribs);

  const baseName = cleanFilename_('Axe' + g.axe + '_Groupe' + g.numero + '_Projet_etablissement');
  const pdf = Utilities.newBlob(html, 'text/html', baseName + '.html').getAs('application/pdf').setName(baseName + '.pdf');

  const folder = getOrCreateFolder_(DriveApp.getFolderById(PE_FOLDER_ID), 'Groupes');
  if (g.docId) { try { DriveApp.getFileById(g.docId).setTrashed(true); } catch (e) { /* déjà supprimé */ } }
  const file = folder.createFile(pdf);
  const now = peNow_();
  peUpdate_('Groupes', g.id, { statut: 'Terminé', docUrl: file.getUrl(), docId: file.getId(), docLe: now });
  return { ok: true, docUrl: file.getUrl(), docLe: now, fileName: file.getName() };
}

/* ---------- Administration ---------- */

function peAdminDeleteGroup_(p) {
  peRequireAdmin_(p.code);
  const g = peGet_('Groupes', p.groupId);
  peDeleteIds_('Contributions', peRead_('Contributions').filter(c => c.groupeId === g.id).map(c => c.id));
  peDeleteIds_('Rubriques', peRead_('Rubriques').filter(r => r.groupeId === g.id).map(r => r.id));
  peDeleteIds_('Groupes', [g.id]);
  if (g.docId) { try { DriveApp.getFileById(g.docId).setTrashed(true); } catch (e) { /* ignore */ } }
  return { ok: true };
}

function peUploadBilan_(p) {
  peRequireAdmin_(p.code);
  const axe = String(p.axe) === 'global' ? 'global' : String(Number(p.axe));
  if (axe !== 'global' && !(Number(axe) >= 1 && Number(axe) <= 4)) throw new Error('Axe invalide.');
  const titre = peClean_(p.titre, 200);
  if (!titre) throw new Error('Donnez un titre au document.');
  const fileName = cleanFilename_(p.fileName || 'bilan');
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (PE_FILE_EXT.indexOf(ext) < 0) throw new Error('Format non accepté (PDF, Word, Excel, PowerPoint, image).');
  if (!p.fileBase64) throw new Error('Fichier absent.');
  const bytes = Utilities.base64Decode(String(p.fileBase64).replace(/^data:[^,]*,/, '').replace(/\s+/g, ''));
  if (bytes.length < 10) throw new Error('Fichier vide.');
  if (bytes.length > PE_MAX_FILE_BYTES) throw new Error('Fichier trop volumineux (15 Mo maximum).');

  const folder = getOrCreateFolder_(DriveApp.getFolderById(PE_FOLDER_ID), 'Bilans');
  const tz = Session.getScriptTimeZone() || 'Europe/Nicosia';
  const stamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd_HHmm');
  const blob = Utilities.newBlob(bytes, p.mimeType || 'application/octet-stream', stamp + '_' + fileName);
  const file = folder.createFile(blob);
  let shared = true;
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { shared = false; }
  const b = { id: peId_(), axe, titre, fileName, fileUrl: file.getUrl(), fileId: file.getId(), creeLe: peNow_() };
  peAppend_('Bilans', b);
  return { ok: true, bilanId: b.id, fileUrl: b.fileUrl, shared };
}

function peDeleteBilan_(p) {
  peRequireAdmin_(p.code);
  const b = peGet_('Bilans', p.id);
  if (b.fileId) { try { DriveApp.getFileById(b.fileId).setTrashed(true); } catch (e) { /* ignore */ } }
  peDeleteIds_('Bilans', [b.id]);
  return { ok: true };
}


/** Synthèse automatique d'un axe : tous les groupes dans un seul PDF (dossier « Syntheses »), publiable dans la Restitution. */
function peAdminAxePdf_(p) {
  peRequireAdmin_(p.code);
  const axe = Number(p.axe);
  if (!(axe >= 1 && axe <= 4)) throw new Error('Axe invalide.');
  const axeLabel = peClean_(p.axeLabel, 120) || ('Axe ' + axe);
  const groupes = peRead_('Groupes').filter(g => Number(g.axe) === axe).sort((a, b) => Number(a.numero) - Number(b.numero));
  if (!groupes.length) throw new Error('Aucun groupe n\'a encore travaillé sur cet axe.');
  const rubAll = peRead_('Rubriques'), conAll = peRead_('Contributions');
  const tz = Session.getScriptTimeZone() || 'Europe/Nicosia';
  const date = Utilities.formatDate(new Date(), tz, 'dd/MM/yyyy HH:mm');

  let h = '<html><head><meta charset="utf-8"><style>' + PE_PDF_CSS + '</style></head><body>';
  h += '<div class="meta">' + esc_(PE_SCHOOL) + ' — Projet d\'établissement</div>';
  h += '<h1>Synthèse des travaux — ' + esc_(axeLabel) + '</h1>';
  h += '<div class="meta">' + groupes.length + ' groupe(s) — document généré le ' + esc_(date) + '</div>';
  groupes.forEach(g => {
    const membres = peParseMembers_(g.membres).map(m => esc_((m.prenom + ' ' + m.nom).trim())).join(', ');
    h += '<h4>Groupe ' + esc_(g.numero) + '</h4><div class="meta"><b>Membres :</b> ' + (membres || '—') + '</div>';
    h += peRubriquesHtml_(rubAll.filter(r => r.groupeId === g.id), conAll.filter(c => c.groupeId === g.id));
  });
  h += '<div class="foot">Projet d\'établissement — ' + esc_(PE_SCHOOL) + ' — Synthèse ' + esc_(axeLabel) + '</div></body></html>';

  const baseName = cleanFilename_('Synthese_auto_Axe' + axe);
  const pdf = Utilities.newBlob(h, 'text/html', baseName + '.html').getAs('application/pdf').setName(baseName + '.pdf');
  const folder = getOrCreateFolder_(DriveApp.getFolderById(PE_FOLDER_ID), 'Syntheses');
  const titre = 'Synthèse automatique — ' + axeLabel;

  // remplace la synthèse automatique précédente de cet axe (publiée ou non)
  const old = peRead_('Bilans').filter(b => b.axe === String(axe) && b.titre === titre);
  old.forEach(b => { if (b.fileId) { try { DriveApp.getFileById(b.fileId).setTrashed(true); } catch (e) { /* ignore */ } } });
  peDeleteIds_('Bilans', old.map(b => b.id));

  const file = folder.createFile(pdf);
  let published = false, shared = true;
  if (p.publish) {
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { shared = false; }
    peAppend_('Bilans', { id: peId_(), axe: String(axe), titre, fileName: file.getName(), fileUrl: file.getUrl(), fileId: file.getId(), creeLe: peNow_() });
    published = true;
  }
  return { ok: true, fileUrl: file.getUrl(), groupes: groupes.length, published, shared };
}
