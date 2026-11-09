(() => {
  'use strict';

  /* ------------------------------------------------------------------ *
   * CONFIGURATION
   * ------------------------------------------------------------------ */
  // Même déploiement Apps Script que les ateliers (Code.gs v5).
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxeMAI2vOb_bn_R6JyXIfIcmzrtzrHe8kVJBK1nJjnaJ9GXPaMEvFv7vufA_Ww4pfVk4w/exec';

  // Intitulés des 4 axes : à modifier ici quand ils seront connus.
  const AXES = [
    { n: 1, titre: 'Axe 1' },
    { n: 2, titre: 'Axe 2' },
    { n: 3, titre: 'Axe 3' },
    { n: 4, titre: 'Axe 4' }
  ];
  const MAX_GROUP_NUMBER = 10;
  const MAX_FILE_MB = 12;
  const POLL_MS = 60000;

  /* ------------------------------------------------------------------ *
   * ÉTAT
   * ------------------------------------------------------------------ */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  let data = store.get('pe_cache', { groupes: [], rubriques: [], contributions: [], bilans: [] });
  let me = store.get('pe_me', null);              // { prenom, nom }
  let currentGroupId = store.get('pe_group', null);
  let adminCode = null;                            // gardé en mémoire uniquement
  try { adminCode = sessionStorage.getItem('pe_admin') || null; } catch (e) { adminCode = null; }
  let activeTab = 'travail';
  let restoAxe = 'all';
  let editingId = null;                            // contribution ou rubrique en cours de modification
  let lastSync = null;
  let loading = false;
  const flash = { travail: null, admin: null };    // messages d'erreur / succès

  /* ------------------------------------------------------------------ *
   * OUTILS
   * ------------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  function h(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const axeTitle = n => (AXES.find(a => a.n === Number(n)) || { titre: 'Axe ' + n }).titre;
  const fullName = m => `${m.prenom || ''} ${m.nom || ''}`.trim();
  const myName = () => (me ? fullName(me) : '');
  const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const isMine = author => me && sameName(author, myName());
  const groupLabel = g => `${axeTitle(g.axe)} · Groupe ${g.numero}`;

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function toast(msg) {
    const el = $('#peToast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function setSync(text, err) {
    const el = $('#peSync');
    el.textContent = text || '';
    el.className = 'pe-sync' + (err ? ' err' : '');
  }

  function capitalizeName(s) {
    return String(s || '').trim().replace(/\s+/g, ' ');
  }

  /* ------------------------------------------------------------------ *
   * API (Apps Script)
   * ------------------------------------------------------------------ */
  async function parseResponse(res) {
    const text = (await res.text()).trim();
    if (!res.ok) throw new Error(`Le serveur a répondu HTTP ${res.status}.`);
    if (!text) throw new Error('Réponse vide du serveur.');
    try { return JSON.parse(text); } catch (e) {
      if (/<!doctype|<html/i.test(text)) {
        throw new Error('Le service Google a renvoyé une page au lieu de données : le script Apps Script n\'est probablement pas redéployé en version 5 ou pas autorisé.');
      }
      throw new Error('Réponse du serveur illisible.');
    }
  }

  async function apiGet(action) {
    let res;
    try { res = await fetch(`${ENDPOINT}?action=${encodeURIComponent(action)}&t=${Date.now()}`, { redirect: 'follow' }); }
    catch (e) { throw new Error('Connexion impossible. Vérifie ta connexion internet.'); }
    return parseResponse(res);
  }

  async function apiPost(payload) {
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
    } catch (e) { throw new Error('Connexion impossible. Vérifie ta connexion internet.'); }
    const out = await parseResponse(res);
    if (!out.ok) throw new Error(out.error || 'Erreur inconnue.');
    return out;
  }

  async function refresh(silent) {
    if (loading) return;
    loading = true;
    if (!silent) setSync('Actualisation…');
    try {
      const out = await apiGet('pe_data');
      if (!out.ok) throw new Error(out.error || 'Erreur de lecture.');
      data = {
        groupes: out.groupes || [],
        rubriques: out.rubriques || [],
        contributions: out.contributions || [],
        bilans: out.bilans || []
      };
      store.set('pe_cache', data);
      lastSync = new Date();
      setSync('Synchronisé à ' + lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      setSync('⚠️ ' + e.message + (data.groupes.length ? ' (affichage des dernières données connues)' : ''), true);
    } finally {
      loading = false;
      renderAll();
    }
  }

  /** Exécute une action serveur, affiche les erreurs, puis actualise. */
  async function act(payload, okMessage, flashKey) {
    try {
      const out = await apiPost(payload);
      if (flashKey) flash[flashKey] = null;
      if (okMessage) toast(okMessage);
      await refresh(true);
      return out;
    } catch (e) {
      if (flashKey) flash[flashKey] = { type: 'error', text: e.message };
      toast('⚠️ ' + e.message);
      renderAll();
      return null;
    }
  }

  function pendingText() {
    return $$('#view-travail textarea, #view-travail input[type="text"]').some(el => el.value.trim() !== '' && !el.hasAttribute('data-ignore-pending'))
      || document.activeElement && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName) && document.activeElement.value.trim() !== '';
  }

  /* ------------------------------------------------------------------ *
   * ONGLETS
   * ------------------------------------------------------------------ */
  function showTab(name) {
    activeTab = name;
    $$('.pe-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.pe-view').forEach(v => v.classList.toggle('visible', v.dataset.view === name));
    if (name !== 'travail') editingId = null;
    renderAll();
    if (name === 'restitution') refresh(true);
    try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ *
   * VUE TRAVAIL
   * ------------------------------------------------------------------ */
  function renderFlash(key) {
    const f = flash[key];
    if (!f) return '';
    return `<div class="${f.type === 'error' ? 'pe-error' : 'pe-ok'}">${h(f.text)}</div>`;
  }

  function renderTravail() {
    const root = $('#view-travail');
    if (!me) {
      root.innerHTML = `
        <div class="pe-card">
          <span class="pe-eyebrow" style="color:var(--magenta)">Étape 1</span>
          <h2>Qui es-tu ?</h2>
          <p class="pe-lead">Ton nom accompagnera chacune de tes contributions. Il est mémorisé sur cet appareil, tu ne le saisis qu'une fois.</p>
          <form id="meForm" class="pe-row" autocomplete="off">
            <label>Prénom<input type="text" name="prenom" required maxlength="60" data-ignore-pending></label>
            <label>Nom<input type="text" name="nom" required maxlength="60" data-ignore-pending></label>
            <button class="btn primary" type="submit">Continuer →</button>
          </form>
        </div>`;
      return;
    }

    const meBar = `
      <div class="pe-me">
        <span>👤 Connecté·e en tant que <b>${h(myName())}</b></span>
        <button class="btn ghost small" data-action="change-me" type="button">Ce n'est pas moi</button>
      </div>`;

    const group = data.groupes.find(g => g.id === currentGroupId);
    root.innerHTML = meBar + (group ? renderWorkspace(group) : renderChooser());
  }

  function renderChooser() {
    const blocks = AXES.map(a => {
      const gs = data.groupes.filter(g => Number(g.axe) === a.n).sort((x, y) => Number(x.numero) - Number(y.numero));
      const items = gs.length ? gs.map(g => {
        const nb = data.rubriques.filter(r => r.groupeId === g.id).length;
        const names = (g.membres || []).map(fullName).join(', ') || '—';
        const mine = (g.membres || []).some(m => sameName(fullName(m), myName()));
        return `
          <div class="pe-group-card">
            <div><b>Groupe ${h(g.numero)}</b> ${mine ? '<span class="pe-chip ok">Tu en fais partie</span>' : ''}
              <small>${h(names)}</small>
              <small>${nb} rubrique${nb > 1 ? 's' : ''} · ${h(g.statut || 'En cours')}</small></div>
            <button class="btn ${mine ? 'primary' : 'secondary'} small" data-action="open-group" data-id="${h(g.id)}" type="button">${mine ? 'Ouvrir' : 'Rejoindre'} →</button>
          </div>`;
      }).join('') : '<div class="pe-empty">Aucun groupe pour le moment.</div>';
      return `<div class="pe-axe-block"><h3>${h(a.titre)}</h3>${items}</div>`;
    }).join('');

    const axeOpts = AXES.map(a => `<option value="${a.n}">${h(a.titre)}</option>`).join('');
    const numOpts = Array.from({ length: MAX_GROUP_NUMBER }, (_, i) => `<option value="${i + 1}">Groupe ${i + 1}</option>`).join('');

    return `
      <div class="pe-card">
        <span class="pe-eyebrow" style="color:var(--magenta)">Étape 2</span>
        <h2>Rejoins ton groupe</h2>
        <p class="pe-lead">Choisis ton groupe dans la liste. Si ton groupe n'existe pas encore, crée-le juste en dessous.</p>
        ${renderFlash('travail')}
        ${blocks}
      </div>
      <div class="pe-card">
        <h2>➕ Créer un groupe</h2>
        <form id="groupForm" autocomplete="off">
          <div class="pe-row">
            <label>Axe<select name="axe">${axeOpts}</select></label>
            <label>Numéro du groupe<select name="numero">${numOpts}</select></label>
          </div>
          <label style="display:block;margin-top:14px;font-weight:700;font-size:.85rem;color:var(--muted)">Autres membres du groupe (un par ligne : Prénom Nom)
            <textarea class="pe-ta" name="membres" data-ignore-pending placeholder="Marie Dupont&#10;Jean Martin"></textarea>
          </label>
          <p class="pe-hint">Tu es ajouté·e automatiquement. Les collègues pourront aussi rejoindre le groupe eux-mêmes.</p>
          <div class="pe-actions"><button class="btn primary" type="submit">Créer le groupe</button></div>
        </form>
      </div>`;
  }

  function renderContribActions(c, kind) {
    const mine = isMine(c.auteur) || adminCode;
    return `<span class="pe-mini">
      <button class="pe-link" data-action="edit" data-id="${h(c.id)}" data-kind="${kind}" type="button">Modifier</button>
      ${mine ? `<button class="pe-link danger" data-action="del-${kind}" data-id="${h(c.id)}" type="button">Supprimer</button>` : ''}
    </span>`;
  }

  function renderContribBody(c, label, kind) {
    if (editingId === c.id) {
      return `
        <div><span class="${kind === 'question' ? 'pe-q-label' : 'pe-r-label'}">${label}</span></div>
        <textarea class="pe-ta" id="editBox" data-ignore-pending>${h(c.texte)}</textarea>
        <div class="pe-actions">
          <button class="btn primary small" data-action="save-edit" data-id="${h(c.id)}" data-kind="contrib" type="button">Enregistrer</button>
          <button class="btn ghost small" data-action="cancel-edit" type="button">Annuler</button>
        </div>`;
    }
    return `
      <div><span class="${kind === 'question' ? 'pe-q-label' : 'pe-r-label'}">${label}</span>${renderContribActions(c, kind)}</div>
      <div class="pe-txt">${h(c.texte)}</div>
      <div class="pe-by">${h(c.auteur)} · ${h(fmtDate(c.creeLe))}${c.majLe && c.majLe !== c.creeLe ? ' · modifié' : ''}</div>`;
  }

  function renderRubriqueBody(r, contribs, editable) {
    const questions = contribs.filter(c => c.type === 'question');
    const libres = contribs.filter(c => c.type === 'reflexion' && !c.parentId);
    let html = '';

    questions.forEach(q => {
      const reps = contribs.filter(c => c.parentId === q.id);
      html += `<div class="pe-q">${editable ? renderContribBody(q, 'Questionnement', 'question') : `<span class="pe-q-label">Questionnement</span><div class="pe-txt">${h(q.texte)}</div><div class="pe-by">${h(q.auteur)}</div>`}`;
      if (!reps.length) html += `<div class="pe-r"><span class="pe-by"><i>Pas encore de réflexion.</i></span></div>`;
      reps.forEach(x => {
        html += `<div class="pe-r">${editable ? renderContribBody(x, 'Réflexion', 'reflexion') : `<span class="pe-r-label">Réflexion</span><div class="pe-txt">${h(x.texte)}</div><div class="pe-by">${h(x.auteur)}</div>`}</div>`;
      });
      if (editable) {
        html += `
          <details class="pe-add"><summary>+ Ajouter une réflexion</summary>
            <textarea class="pe-ta" id="refl-${h(q.id)}" placeholder="Ta réflexion en réponse à ce questionnement…"></textarea>
            <div class="pe-actions"><button class="btn primary small" data-action="add-reflexion" data-rid="${h(r.id)}" data-qid="${h(q.id)}" type="button">Ajouter la réflexion</button></div>
          </details>`;
      }
      html += '</div>';
    });

    if (libres.length) {
      html += `<h4 style="margin:16px 0 4px;color:#211d47">Réflexions complémentaires</h4>`;
      libres.forEach(x => {
        html += `<div class="pe-r" style="margin-left:0">${editable ? renderContribBody(x, 'Réflexion', 'reflexion') : `<span class="pe-r-label">Réflexion</span><div class="pe-txt">${h(x.texte)}</div><div class="pe-by">${h(x.auteur)}</div>`}</div>`;
      });
    }

    if (!questions.length && !libres.length) html += `<div class="pe-empty">Rubrique vide pour l'instant.</div>`;

    if (editable) {
      html += `
        <details class="pe-add q"><summary>+ Ajouter un questionnement</summary>
          <textarea class="pe-ta" id="quest-${h(r.id)}" placeholder="Quelle question cette rubrique doit-elle explorer ?"></textarea>
          <div class="pe-actions"><button class="btn secondary small" data-action="add-question" data-rid="${h(r.id)}" type="button">Ajouter le questionnement</button></div>
        </details>
        <details class="pe-add q"><summary>+ Ajouter une réflexion libre (sans questionnement)</summary>
          <textarea class="pe-ta" id="free-${h(r.id)}" placeholder="Une idée, un constat, une proposition…"></textarea>
          <div class="pe-actions"><button class="btn primary small" data-action="add-reflexion" data-rid="${h(r.id)}" data-qid="" type="button">Ajouter</button></div>
        </details>`;
    }
    return html;
  }

  function renderWorkspace(g) {
    const rubs = data.rubriques.filter(r => r.groupeId === g.id);
    const contribs = data.contributions.filter(c => c.groupeId === g.id);
    const names = (g.membres || []).map(m => `<span class="pe-chip">${h(fullName(m))}</span>`).join('');
    const outdated = g.docLe && g.majLe && g.majLe > g.docLe;
    const docState = !g.docLe
      ? '<span class="pe-chip warn">Document pas encore généré</span>'
      : outdated
        ? `<span class="pe-chip warn">Le document date du ${h(fmtDate(g.docLe))} — des ajouts ont eu lieu depuis</span>`
        : `<span class="pe-chip ok">✅ Document à jour (${h(fmtDate(g.docLe))})</span>`;

    const rubHtml = rubs.length ? rubs.map(r => {
      const rc = contribs.filter(c => c.rubriqueId === r.id);
      const titleHtml = editingId === r.id
        ? `<div style="flex:1 1 300px"><input type="text" id="editBox" value="${h(r.titre)}" maxlength="200" data-ignore-pending>
             <div class="pe-actions"><button class="btn primary small" data-action="save-edit" data-id="${h(r.id)}" data-kind="rubrique" type="button">Enregistrer</button>
             <button class="btn ghost small" data-action="cancel-edit" type="button">Annuler</button></div></div>`
        : `<div><h3>${h(r.titre)}</h3><span class="pe-by">créée par ${h(r.auteur)}</span></div>
           <span class="pe-mini">
             <button class="pe-link" data-action="edit" data-id="${h(r.id)}" data-kind="rubrique" type="button">Renommer</button>
             ${(isMine(r.auteur) || adminCode) ? `<button class="pe-link danger" data-action="del-rubrique" data-id="${h(r.id)}" type="button">Supprimer</button>` : ''}
           </span>`;
      return `<article class="pe-rub"><div class="pe-rub-head">${titleHtml}</div><div class="pe-rub-body">${renderRubriqueBody(r, rc, true)}</div></article>`;
    }).join('') : '<div class="pe-empty" style="margin-top:14px">Aucune rubrique pour le moment : ajoutes-en une ci-dessous pour lancer la réflexion.</div>';

    return `
      <div class="pe-card">
        <div class="pe-ws-head">
          <div>
            <button class="pe-link" data-action="leave-group" type="button">← Changer de groupe</button>
            <h2>${h(groupLabel(g))}</h2>
            <div class="pe-chips">${names}</div>
          </div>
          <div class="pe-actions" style="margin-top:0">
            <button class="btn ghost small" data-action="refresh" type="button">↻ Actualiser</button>
            <button class="btn ghost small" data-action="edit-members" type="button">👥 Membres</button>
          </div>
        </div>
        ${renderFlash('travail')}
        <div id="membersBox"></div>
        <p class="pe-lead" style="margin-top:12px">Une <b>rubrique</b> = une thématique. Dans chaque rubrique, pose des <b>questionnements</b> puis note vos <b>réflexions</b>. Chaque collègue du groupe peut ajouter sa part.</p>
        ${rubHtml}
        <div class="pe-card" style="box-shadow:none;background:#fbf9fc">
          <h3>➕ Nouvelle rubrique</h3>
          <form id="rubForm" class="pe-newrub" autocomplete="off">
            <input type="text" name="titre" placeholder="Titre de la rubrique (ex. : Accueil des familles)" maxlength="200" required>
            <button class="btn primary" type="submit">Ajouter la rubrique</button>
          </form>
        </div>
        <div class="pe-docbox">
          <div>
            <b>📄 Document du groupe</b>
            <p>Quand votre réflexion est prête, envoie-la au Drive : un PDF récapitulatif (un seul par groupe, remplacé à chaque envoi).</p>
            <div class="pe-chips">${docState}</div>
          </div>
          <div class="pe-actions" style="margin-top:0">
            <button class="btn primary" data-action="generate" type="button">Envoyer le document au Drive</button>
            <button class="btn ghost" data-action="print" type="button">🖨 Imprimer</button>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ *
   * VUE RESTITUTION
   * ------------------------------------------------------------------ */
  function bilanLine(b) {
    return `<div class="pe-bilan">📑 <a href="${h(b.fileUrl)}" target="_blank" rel="noopener">${h(b.titre)}</a><span class="pe-by">${h(fmtDate(b.creeLe))}</span></div>`;
  }

  function renderRestitution() {
    const root = $('#view-restitution');
    const axes = restoAxe === 'all' ? AXES : AXES.filter(a => String(a.n) === String(restoAxe));
    const totalContribs = data.contributions.length;

    const filter = `
      <div class="pe-filter">
        <button data-action="resto-axe" data-axe="all" class="${restoAxe === 'all' ? 'active' : ''}" type="button">Tous les axes</button>
        ${AXES.map(a => `<button data-action="resto-axe" data-axe="${a.n}" class="${String(restoAxe) === String(a.n) ? 'active' : ''}" type="button">${h(a.titre)}</button>`).join('')}
      </div>`;

    const globalBilans = data.bilans.filter(b => b.axe === 'global');
    const globalBlock = (restoAxe === 'all' && globalBilans.length)
      ? `<div class="pe-card"><h2>🏛 Bilan général</h2>${globalBilans.map(bilanLine).join('')}</div>` : '';

    const blocks = axes.map(a => {
      const gs = data.groupes.filter(g => Number(g.axe) === a.n).sort((x, y) => Number(x.numero) - Number(y.numero));
      const bilans = data.bilans.filter(b => b.axe === String(a.n));
      const groupHtml = gs.length ? gs.map(g => {
        const rubs = data.rubriques.filter(r => r.groupeId === g.id);
        const contribs = data.contributions.filter(c => c.groupeId === g.id);
        const body = rubs.length ? rubs.map(r => `
          <article class="pe-rub"><div class="pe-rub-head"><h3>${h(r.titre)}</h3></div>
            <div class="pe-rub-body">${renderRubriqueBody(r, contribs.filter(c => c.rubriqueId === r.id), false)}</div></article>`).join('')
          : '<div class="pe-empty">Aucune rubrique saisie.</div>';
        return `
          <details class="pe-resto-group" open>
            <summary>Groupe ${h(g.numero)} <span class="pe-by">— ${h((g.membres || []).map(fullName).join(', '))}</span>
              <span class="pe-chip ${g.statut === 'Terminé' ? 'ok' : 'warn'}" style="margin-left:8px">${h(g.statut || 'En cours')}</span></summary>
            <div class="pe-resto-body">${body}</div>
          </details>`;
      }).join('') : '<div class="pe-empty">Aucun groupe n\'a encore travaillé sur cet axe.</div>';
      return `
        <div class="pe-card">
          <h2>${h(a.titre)}</h2>
          ${bilans.length ? `<div>${bilans.map(bilanLine).join('')}</div>` : ''}
          ${groupHtml}
        </div>`;
    }).join('');

    root.innerHTML = `
      <div class="pe-card">
        <div class="pe-ws-head">
          <div><h2>Restitution</h2>
            <p class="pe-lead" style="margin-bottom:0">Tous les travaux des groupes, rangés par axe. ${data.groupes.length} groupe${data.groupes.length > 1 ? 's' : ''}, ${data.rubriques.length} rubrique${data.rubriques.length > 1 ? 's' : ''}, ${totalContribs} contribution${totalContribs > 1 ? 's' : ''}.</p></div>
          <div class="pe-actions" style="margin-top:0">
            <button class="btn ghost small" data-action="refresh" type="button">↻ Actualiser</button>
            <button class="btn ghost small" data-action="print" type="button">🖨 Imprimer</button>
          </div>
        </div>
        ${filter}
      </div>
      ${globalBlock}
      ${blocks}`;
  }

  /* ------------------------------------------------------------------ *
   * VUE ADMINISTRATION
   * ------------------------------------------------------------------ */
  function renderAdmin() {
    const root = $('#view-admin');
    if (!adminCode) {
      root.innerHTML = `
        <div class="pe-card">
          <h2>🔐 Espace administrateur</h2>
          <p class="pe-lead">Réservé aux pilotes du projet d'établissement : dépôt des synthèses et du bilan, gestion des groupes.</p>
          <form id="adminForm" class="pe-row" autocomplete="off">
            <label>Code administrateur<input type="password" name="code" required autocomplete="off" data-ignore-pending></label>
            <button class="btn primary" type="submit">Entrer</button>
          </form>
          ${renderFlash('admin')}
        </div>`;
      return;
    }

    const axeOpts = '<option value="global">Bilan général (tous axes)</option>' + AXES.map(a => `<option value="${a.n}">Synthèse — ${h(a.titre)}</option>`).join('');
    const bilans = data.bilans.slice().sort((a, b) => String(b.creeLe).localeCompare(String(a.creeLe)));
    const bilanRows = bilans.length ? `
      <table class="pe-table"><thead><tr><th>Portée</th><th>Titre</th><th>Déposé</th><th></th></tr></thead><tbody>
        ${bilans.map(b => `<tr><td>${b.axe === 'global' ? 'Général' : h(axeTitle(b.axe))}</td>
          <td><a href="${h(b.fileUrl)}" target="_blank" rel="noopener">${h(b.titre)}</a></td><td>${h(fmtDate(b.creeLe))}</td>
          <td><button class="pe-link danger" data-action="admin-del-bilan" data-id="${h(b.id)}" type="button">Supprimer</button></td></tr>`).join('')}
      </tbody></table>` : '<div class="pe-empty">Aucun document déposé.</div>';

    const gs = data.groupes.slice().sort((a, b) => Number(a.axe) - Number(b.axe) || Number(a.numero) - Number(b.numero));
    const groupRows = gs.length ? `
      <table class="pe-table"><thead><tr><th>Groupe</th><th>Membres</th><th>Contenu</th><th>Document Drive</th><th></th></tr></thead><tbody>
        ${gs.map(g => {
          const nbR = data.rubriques.filter(r => r.groupeId === g.id).length;
          const nbC = data.contributions.filter(c => c.groupeId === g.id).length;
          return `<tr><td><b>${h(groupLabel(g))}</b></td><td>${h((g.membres || []).map(fullName).join(', '))}</td>
            <td>${nbR} rubr. · ${nbC} contrib.</td>
            <td>${g.docUrl ? `<a href="${h(g.docUrl)}" target="_blank" rel="noopener">Ouvrir le PDF</a><br><span class="pe-by">${h(fmtDate(g.docLe))}</span>` : '<span class="pe-by">pas encore généré</span>'}</td>
            <td><button class="pe-link danger" data-action="admin-del-group" data-id="${h(g.id)}" type="button">Supprimer</button></td></tr>`;
        }).join('')}
      </tbody></table>` : '<div class="pe-empty">Aucun groupe.</div>';

    root.innerHTML = `
      <div class="pe-card">
        <div class="pe-ws-head"><h2>🔐 Administration</h2>
          <button class="btn ghost small" data-action="admin-logout" type="button">Se déconnecter</button></div>
        ${renderFlash('admin')}
        <p class="pe-lead">Dépose ici les synthèses par axe et le bilan général. Ils s'afficheront automatiquement dans la <b>Restitution</b>, visibles par tous.</p>
        <form id="bilanForm" autocomplete="off">
          <div class="pe-row">
            <label>Portée<select name="axe">${axeOpts}</select></label>
            <label style="flex:2 1 260px">Titre affiché<input type="text" name="titre" required maxlength="200" placeholder="Ex. : Synthèse de l'axe 2" data-ignore-pending></label>
            <label style="flex:2 1 260px">Fichier (PDF, Word, Excel, PowerPoint, image — ${MAX_FILE_MB} Mo max)<input type="file" name="fichier" required accept=".pdf,.doc,.docx,.odt,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg"></label>
          </div>
          <div class="pe-actions"><button class="btn primary" type="submit">Déposer le document</button></div>
          <p class="pe-hint">Le fichier est rangé dans le dossier « Bilans » du Drive et accessible à toute personne disposant du lien affiché dans la Restitution.</p>
        </form>
      </div>
      <div class="pe-card"><h2>Documents déposés</h2>${bilanRows}</div>
      <div class="pe-card"><h2>Gestion des groupes</h2>${groupRows}</div>`;
  }

  /* ------------------------------------------------------------------ *
   * RENDU GLOBAL
   * ------------------------------------------------------------------ */
  function renderAll() {
    if (activeTab === 'travail') renderTravail();
    else if (activeTab === 'restitution') renderRestitution();
    else if (activeTab === 'admin') renderAdmin();
    if (editingId) {
      const box = $('#editBox');
      if (box) { box.focus(); const n = box.value.length; try { box.setSelectionRange(n, n); } catch (e) { /* input type */ } }
    }
  }

  /* ------------------------------------------------------------------ *
   * ACTIONS
   * ------------------------------------------------------------------ */
  function parseMembers(text) {
    return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 14).map(l => {
      const parts = l.split(/\s+/);
      return { prenom: parts.shift() || '', nom: parts.join(' ') };
    });
  }

  function currentGroup() { return data.groupes.find(g => g.id === currentGroupId); }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1] || '');
      r.onerror = () => reject(new Error('Lecture du fichier impossible.'));
      r.readAsDataURL(file);
    });
  }

  async function onClick(ev) {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;

    switch (a) {
      case 'refresh': return refresh(false);
      case 'print': return window.print();
      case 'resto-axe': restoAxe = btn.dataset.axe; return renderAll();

      case 'change-me':
        me = null; store.del('pe_me'); currentGroupId = null; store.del('pe_group'); return renderAll();

      case 'open-group': {
        const g = data.groupes.find(x => x.id === btn.dataset.id);
        if (!g) return;
        flash.travail = null;
        const already = (g.membres || []).some(m => sameName(fullName(m), myName()));
        if (!already) {
          btn.disabled = true;
          const out = await act({ action: 'pe_joinGroup', groupId: g.id, prenom: me.prenom, nom: me.nom }, null, 'travail');
          if (!out) return;
        }
        currentGroupId = g.id; store.set('pe_group', g.id);
        return renderAll();
      }
      case 'leave-group':
        currentGroupId = null; store.del('pe_group'); editingId = null; flash.travail = null; return renderAll();

      case 'edit-members': {
        const g = currentGroup(); if (!g) return;
        const box = $('#membersBox');
        if (box.innerHTML) { box.innerHTML = ''; return; }
        box.innerHTML = `
          <div class="pe-card" style="box-shadow:none;background:#fbf9fc">
            <b>Membres du groupe</b> <span class="pe-hint">(un par ligne : Prénom Nom — corrige ou ajoute des collègues)</span>
            <textarea class="pe-ta" id="membersTa" data-ignore-pending>${h((g.membres || []).map(fullName).join('\n'))}</textarea>
            <div class="pe-actions"><button class="btn primary small" data-action="save-members" type="button">Enregistrer</button></div>
          </div>`;
        return;
      }
      case 'save-members': {
        const g = currentGroup(); if (!g) return;
        const membres = parseMembers($('#membersTa').value);
        return void await act({ action: 'pe_setMembers', groupId: g.id, membres }, 'Membres mis à jour', 'travail');
      }

      case 'add-question':
      case 'add-reflexion': {
        const rid = btn.dataset.rid;
        const qid = btn.dataset.qid || '';
        const ta = a === 'add-question' ? $('#quest-' + CSS.escape(rid)) : $('#' + (qid ? 'refl-' + CSS.escape(qid) : 'free-' + CSS.escape(rid)));
        const texte = ta ? ta.value.trim() : '';
        if (!texte) { toast('Écris d\'abord ton texte.'); return; }
        btn.disabled = true;
        const out = await act({
          action: 'pe_addContribution', rubriqueId: rid,
          type: a === 'add-question' ? 'question' : 'reflexion', parentId: qid, texte, auteur: myName()
        }, a === 'add-question' ? 'Questionnement ajouté' : 'Réflexion ajoutée', 'travail');
        if (!out) btn.disabled = false;
        return;
      }

      case 'edit': editingId = btn.dataset.id; return renderAll();
      case 'cancel-edit': editingId = null; return renderAll();
      case 'save-edit': {
        const val = ($('#editBox') || {}).value || '';
        const id = btn.dataset.id;
        const payload = btn.dataset.kind === 'rubrique'
          ? { action: 'pe_editRubrique', rubriqueId: id, titre: val }
          : { action: 'pe_editContribution', id, texte: val };
        const out = await act(payload, 'Modification enregistrée', 'travail');
        if (out) { editingId = null; renderAll(); }
        return;
      }

      case 'del-question':
      case 'del-reflexion':
        if (!confirm('Supprimer cette contribution ?')) return;
        return void await act({ action: 'pe_deleteContribution', id: btn.dataset.id, auteur: myName(), code: adminCode || '' }, 'Supprimé', 'travail');
      case 'del-rubrique':
        if (!confirm('Supprimer cette rubrique et tout son contenu ?')) return;
        return void await act({ action: 'pe_deleteRubrique', rubriqueId: btn.dataset.id, auteur: myName(), code: adminCode || '' }, 'Rubrique supprimée', 'travail');

      case 'generate': {
        const g = currentGroup(); if (!g) return;
        btn.disabled = true; btn.textContent = 'Envoi en cours…';
        const out = await act({ action: 'pe_generateDoc', groupId: g.id, axeLabel: axeTitle(g.axe) }, '✅ Document envoyé au Drive', 'travail');
        if (!out) { btn.disabled = false; btn.textContent = 'Envoyer le document au Drive'; }
        return;
      }

      case 'admin-logout':
        adminCode = null; try { sessionStorage.removeItem('pe_admin'); } catch (e) { /* ignore */ } flash.admin = null; return renderAll();
      case 'admin-del-bilan':
        if (!confirm('Supprimer ce document ?')) return;
        return void await act({ action: 'pe_deleteBilan', code: adminCode, id: btn.dataset.id }, 'Document supprimé', 'admin');
      case 'admin-del-group':
        if (!confirm('Supprimer définitivement ce groupe, ses rubriques et son PDF ?')) return;
        return void await act({ action: 'pe_adminDeleteGroup', code: adminCode, groupId: btn.dataset.id }, 'Groupe supprimé', 'admin');
      default:
    }
  }

  async function onSubmit(ev) {
    const form = ev.target;
    if (!form.id) return;
    ev.preventDefault();
    const fd = new FormData(form);
    const submit = form.querySelector('[type="submit"]');

    if (form.id === 'meForm') {
      const prenom = capitalizeName(fd.get('prenom')), nom = capitalizeName(fd.get('nom'));
      if (!prenom || !nom) return;
      me = { prenom, nom }; store.set('pe_me', me);
      return renderAll();
    }

    if (submit) submit.disabled = true;
    try {
      if (form.id === 'groupForm') {
        const membres = [{ prenom: me.prenom, nom: me.nom }].concat(parseMembers(fd.get('membres')));
        const out = await act({ action: 'pe_createGroup', axe: Number(fd.get('axe')), numero: Number(fd.get('numero')), membres }, 'Groupe créé', 'travail');
        if (out) { currentGroupId = out.groupId; store.set('pe_group', currentGroupId); renderAll(); }
      } else if (form.id === 'rubForm') {
        const g = currentGroup();
        const titre = String(fd.get('titre') || '').trim();
        if (g && titre) await act({ action: 'pe_addRubrique', groupId: g.id, titre, auteur: myName() }, 'Rubrique ajoutée', 'travail');
      } else if (form.id === 'adminForm') {
        const code = String(fd.get('code') || '');
        try {
          await apiPost({ action: 'pe_adminCheck', code });
          adminCode = code; try { sessionStorage.setItem('pe_admin', code); } catch (e) { /* ignore */ }
          flash.admin = null;
          renderAll();
        } catch (e) { flash.admin = { type: 'error', text: e.message }; renderAll(); }
      } else if (form.id === 'bilanForm') {
        const file = fd.get('fichier');
        if (!file || !file.size) { flash.admin = { type: 'error', text: 'Choisis un fichier.' }; return renderAll(); }
        if (file.size > MAX_FILE_MB * 1024 * 1024) { flash.admin = { type: 'error', text: `Fichier trop volumineux (${MAX_FILE_MB} Mo maximum).` }; return renderAll(); }
        if (submit) submit.textContent = 'Envoi en cours…';
        const fileBase64 = await fileToBase64(file);
        const out = await act({
          action: 'pe_uploadBilan', code: adminCode, axe: String(fd.get('axe')), titre: String(fd.get('titre') || ''),
          fileName: file.name, mimeType: file.type, fileBase64
        }, '✅ Document déposé', 'admin');
        if (out && out.shared === false) flash.admin = { type: 'ok', text: 'Document déposé, mais le partage par lien est bloqué par votre domaine Google : les visiteurs ne pourront pas l\'ouvrir tant que vous ne l\'avez pas partagé dans Drive.' };
        renderAll();
      }
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  /* ------------------------------------------------------------------ *
   * DÉMARRAGE
   * ------------------------------------------------------------------ */
  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  $$('.pe-tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  const hash = (location.hash || '').replace('#', '');
  if (['travail', 'restitution', 'admin'].includes(hash)) activeTab = hash;
  $$('.pe-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
  $$('.pe-view').forEach(v => v.classList.toggle('visible', v.dataset.view === activeTab));

  renderAll();
  refresh(false);

  setInterval(() => {
    if (document.hidden || editingId) return;
    if (activeTab === 'travail' && pendingText()) return;
    if (activeTab === 'admin') return;
    refresh(true);
  }, POLL_MS);
})();
