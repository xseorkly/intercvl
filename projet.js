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
  const GROUPS_PER_AXE = 5;   // nombre de groupes proposés par axe (change ce nombre si besoin)
  const MAX_PRESENT = 6;      // personnes max. devant un même écran
  const MAX_FILE_MB = 12;
  const POLL_MS = 30000;


  /* Idées proposées aux groupes (cliquables). Tu peux les adapter librement. */
  const SUGGESTIONS = [
    { titre: 'Réussite et parcours des élèves', questions: [
      'Quels progrès et quels résultats voulons-nous viser pour tous les élèves ?',
      'Comment repérer plus tôt et accompagner les élèves en difficulté ?',
      'Comment valoriser l\'excellence et les talents de chacun ?',
      'Comment assurer la continuité entre la maternelle, l\'élémentaire, le collège et le lycée ?' ] },
    { titre: 'Plurilinguisme et langues', questions: [
      'Quelle place voulons-nous donner au français, au grec et à l\'anglais ?',
      'Comment valoriser les langues d\'origine de nos élèves ?',
      'Quels parcours, quelles certifications et quels échanges proposer ?' ] },
    { titre: 'Identité franco-chypriote et ouverture culturelle', questions: [
      'Qu\'est-ce qui fait la singularité de notre établissement ?',
      'Quels projets développer avec la communauté chypriote et les partenaires locaux ?',
      'Comment faire vivre nos valeurs communes au quotidien ?' ] },
    { titre: 'Climat scolaire, bien-être et vie lycéenne', questions: [
      'Comment mesurer le climat scolaire et le suivre dans le temps ?',
      'Comment prévenir le harcèlement et les violences ?',
      'Quelle place donner à la parole des élèves (CVL, délégués, éco-délégués) ?' ] },
    { titre: 'École inclusive et besoins éducatifs particuliers', questions: [
      'Comment accueillir et accompagner chaque élève, quels que soient ses besoins ?',
      'Quels outils et quelle formation pour les équipes ?',
      'Comment travailler avec les familles et les partenaires spécialisés ?' ] },
    { titre: 'Orientation et poursuite d\'études', questions: [
      'Comment accompagner chaque élève dans son projet, de la 4e à la terminale ?',
      'Quels liens avec les universités, la France, Chypre et l\'international ?',
      'Comment suivre le devenir de nos anciens élèves ?' ] },
    { titre: 'Numérique et intelligence artificielle', questions: [
      'Quels usages pédagogiques du numérique et de l\'IA voulons-nous développer ?',
      'Quelles règles communes pour les élèves et pour les adultes ?',
      'Comment former les équipes et sensibiliser les familles ?' ] },
    { titre: 'Relations avec les familles et la communauté éducative', questions: [
      'Comment mieux informer et associer les parents ?',
      'Quelles instances de dialogue et quelles occasions de rencontre ?',
      'Comment tenir compte de la diversité des familles et des langues ?' ] },
    { titre: 'Formation, travail collectif et accueil des personnels', questions: [
      'Quels besoins de formation repérons-nous dans les équipes ?',
      'Comment favoriser le travail collectif entre les degrés et les disciplines ?',
      'Comment accueillir et intégrer les nouveaux personnels ?' ] },
    { titre: 'Locaux, sécurité, santé et développement durable', questions: [
      'Quels aménagements prioritaires pour les espaces d\'apprentissage et de vie ?',
      'Comment renforcer la sécurité et la santé de tous ?',
      'Quelles actions concrètes pour le développement durable ?' ] },
    { titre: 'Réseau AEFE, partenariats et rayonnement', questions: [
      'Quels échanges et quelles mobilités avec les autres établissements du réseau ?',
      'Quels partenariats construire (culturels, sportifs, associatifs, institutionnels) ?',
      'Comment faire connaître nos réussites et renforcer notre attractivité ?' ] }
  ];

  /* Questions utilisables pour n'importe quelle rubrique. */
  const GENERIC_QUESTIONS = [
    'Où en sommes-nous aujourd\'hui ? Qu\'observons-nous ?',
    'Quels sont nos points forts, à conserver et à valoriser ?',
    'Quelles difficultés ou quels manques constatons-nous ?',
    'Quels objectifs ambitieux et réalistes pour les 3 à 5 prochaines années ?',
    'Quelles actions concrètes proposons-nous, et dans quel ordre ?',
    'Qui est concerné, avec quels moyens, et comment saurons-nous que nous avons réussi ?'
  ];

  /* ------------------------------------------------------------------ *
   * ÉTAT
   * ------------------------------------------------------------------ */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  let data = store.get('pe_cache', { groupes: [], rubriques: [], contributions: [], bilans: [] });
  let currentGroupId = store.get('pe_group', null);
  let present = currentGroupId ? store.get('pe_present_' + currentGroupId, []) : [];   // noms complets des personnes devant l'écran
  let activeAuthor = null;                         // « Qui écrit ? »
  let viewId = null;                               // groupe consulté en lecture seule
  let peekOpen = false, peekId = null;             // panneau « voir les autres groupes » pendant le travail
  let slot = null;                                 // { axe, numero } en cours de choix
  let draft = [];                                  // noms en cours de saisie (écran « Qui est là ? »)
  let step = (currentGroupId && present.length) ? 'work' : 'choose';   // choose | who | work
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
  const GROUP_AUTHOR = 'Tout le groupe';
  const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const canTouch = author => !!adminCode || present.some(n => sameName(n, author)) || (author === GROUP_AUTHOR && present.length > 0);
  function currentAuthor() {
    if (activeAuthor && (activeAuthor === GROUP_AUTHOR || present.includes(activeAuthor))) return activeAuthor;
    if (present.length === 1) return present[0];
    return null;
  }
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

  function groupOf(axe, numero) {
    return data.groupes.find(g => Number(g.axe) === Number(axe) && Number(g.numero) === Number(numero));
  }

  function renderTravail() {
    const root = $('#view-travail');
    const group = data.groupes.find(g => g.id === currentGroupId);
    if (step === 'work' && group && present.length) { root.innerHTML = renderWorkspace(group); return; }
    if (step === 'who' && slot) { root.innerHTML = renderWho(); return; }
    if (step === 'view' && data.groupes.some(g => g.id === viewId)) { root.innerHTML = renderViewGroup(data.groupes.find(g => g.id === viewId)); return; }
    step = 'choose';
    root.innerHTML = renderChooser();
  }

  /* Étape 1 : choisir l'axe et le groupe */
  function renderChooser() {
    const blocks = AXES.map(a => {
      const slots = Array.from({ length: GROUPS_PER_AXE }, (_, i) => {
        const n = i + 1;
        const g = groupOf(a.n, n);
        const names = g ? (g.membres || []).map(fullName) : [];
        const nbR = g ? data.rubriques.filter(r => r.groupeId === g.id).length : 0;
        return `
          <div class="pe-slot ${g ? 'taken' : ''}">
            <b>Groupe ${n}</b>
            <small>${g ? '👥 ' + h(names.join(', ') || '—') : 'Libre'}</small>
            ${g ? `<small>${nbR} rubrique${nbR > 1 ? 's' : ''} · ${h(g.statut || 'En cours')}</small>` : ''}
            <div class="pe-slot-actions">
              <button class="btn ${g ? 'secondary' : 'primary'} small" data-action="pick-slot" data-axe="${a.n}" data-num="${n}" type="button">${g ? 'Rejoindre' : 'Ouvrir'}</button>
              ${g ? `<button class="btn ghost small" data-action="view-group" data-id="${h(g.id)}" type="button">👁 Voir le travail</button>` : ''}
            </div>
          </div>`;
      }).join('');
      return `<div class="pe-axe-block"><h3>${h(a.titre)}</h3><div class="pe-slots">${slots}</div></div>`;
    }).join('');

    return `
      <div class="pe-card">
        <span class="pe-eyebrow" style="color:var(--magenta)">Étape 1 sur 2</span>
        <h2>Choisis ton axe et ton groupe</h2>
        <p class="pe-lead">Sur quel axe veux-tu travailler, et avec qui ? Tu vois ici qui travaille déjà dans chaque groupe, et tu peux consulter leur travail (« Voir le travail »). Pour participer, clique sur « Rejoindre » ou « Ouvrir » : tu pourras ensuite indiquer les noms des personnes qui travaillent sur cet ordinateur (une à ${MAX_PRESENT}).</p>
        ${renderFlash('travail')}
        ${blocks}
      </div>`;
  }

  /* Étape 2 : qui est devant l'écran ? */
  function renderWho() {
    const g = groupOf(slot.axe, slot.numero);
    const known = g ? (g.membres || []).map(fullName) : [];
    const all = [...new Set(known.concat(draft))];
    const chips = all.length ? all.map(n => `
      <button class="pe-person ${draft.includes(n) ? 'on' : ''}" data-action="toggle-person" data-name="${h(n)}" type="button">
        ${draft.includes(n) ? '✅' : '＋'} ${h(n)}${known.includes(n) ? '' : ' <small>(nouveau)</small>'}
      </button>`).join('') : '<span class="pe-empty">Personne pour le moment : ajoute les noms ci-dessous.</span>';

    return `
      <div class="pe-card">
        <button class="pe-link" data-action="back-choose" type="button">← Changer de groupe</button>
        <span class="pe-eyebrow" style="color:var(--magenta);display:block;margin-top:8px">Étape 2 sur 2</span>
        <h2>${h(axeTitle(slot.axe))} · Groupe ${h(slot.numero)}</h2>
        <p class="pe-lead">${g ? 'Ce groupe existe déjà. ' : 'Tu ouvres ce groupe. '}Qui travaille <b>sur cet ordinateur</b> en ce moment ? Chaque idée portera le nom de la personne qui l'a écrite.</p>
        ${known.length ? '<p class="pe-hint" style="margin:0 0 6px">Déjà dans le groupe : clique pour dire qui est présent.</p>' : ''}
        <div class="pe-people">${chips}</div>
        <form id="personForm" class="pe-row" autocomplete="off" style="margin-top:14px">
          <label>Prénom<input type="text" name="prenom" maxlength="60" data-ignore-pending></label>
          <label>Nom<input type="text" name="nom" maxlength="60" data-ignore-pending></label>
          <button class="btn secondary" type="submit">➕ Ajouter</button>
        </form>
        ${renderFlash('travail')}
        <div class="pe-actions">
          <button class="btn primary" data-action="start-work" type="button" ${draft.length ? '' : 'disabled'}>Commencer à travailler (${draft.length}) →</button>
        </div>
      </div>`;
  }


  function renderReadonlyGroup(g) {
    const rubs = data.rubriques.filter(r => r.groupeId === g.id);
    const contribs = data.contributions.filter(c => c.groupeId === g.id);
    const names = (g.membres || []).map(m => `<span class="pe-chip">${h(fullName(m))}</span>`).join('');
    const body = rubs.length ? rubs.map(r => `
      <article class="pe-rub"><div class="pe-rub-head"><div><h3>${h(r.titre)}</h3><span class="pe-by">créée par ${h(r.auteur)}</span></div></div>
        <div class="pe-rub-body">${renderRubriqueBody(r, contribs.filter(c => c.rubriqueId === r.id), false)}</div></article>`).join('')
      : '<div class="pe-empty">Ce groupe n\'a pas encore créé de rubrique.</div>';
    return `
      <div class="pe-chips">${names}<span class="pe-chip ${g.statut === 'Terminé' ? 'ok' : 'warn'}">${h(g.statut || 'En cours')}</span>
        <span class="pe-chip">Dernière activité : ${h(fmtDate(g.majLe))}</span></div>
      ${body}`;
  }

  function renderViewGroup(g) {
    return `
      <div class="pe-card">
        <div class="pe-ws-head">
          <div><button class="pe-link" data-action="back-choose" type="button">← Retour aux groupes</button>
            <h2>${h(groupLabel(g))} <span class="pe-by">(lecture seule)</span></h2></div>
          <div class="pe-actions" style="margin-top:0">
            <button class="btn ghost small" data-action="refresh" type="button">↻ Actualiser</button>
            <button class="btn secondary small" data-action="pick-slot" data-axe="${h(g.axe)}" data-num="${h(g.numero)}" type="button">Rejoindre ce groupe</button>
          </div>
        </div>
        ${renderReadonlyGroup(g)}
      </div>`;
  }

  /* Panneau « voir ce que font les autres » affiché dans l'espace de travail */
  function renderPeek(own) {
    if (!peekOpen) return '';
    const others = data.groupes.filter(g => g.id !== own.id).sort((a, b) => Number(a.axe) - Number(b.axe) || Number(a.numero) - Number(b.numero));
    const list = others.length ? others.map(g => `
      <button class="pe-person ${peekId === g.id ? 'on' : ''}" data-action="peek" data-id="${h(g.id)}" type="button">${h(groupLabel(g))} <small>${h((g.membres || []).map(fullName).join(', '))}</small></button>`).join('')
      : '<span class="pe-empty">Aucun autre groupe pour le moment.</span>';
    const shown = others.find(g => g.id === peekId);
    return `
      <div class="pe-peek">
        <b>👀 Ce que font les autres groupes</b>
        <p class="pe-hint">Clique sur un groupe pour lire son travail, sans quitter le tien. Bouton « Actualiser » pour voir les derniers ajouts.</p>
        <div class="pe-people">${list}</div>
        ${shown ? `<h3 style="margin-top:14px">${h(groupLabel(shown))}</h3>${renderReadonlyGroup(shown)}` : ''}
      </div>`;
  }

  /* Barre « Qui écrit ? » */
  function renderWhoBar() {
    const ca = currentAuthor();
    const chips = present.map(n => `<button class="pe-person ${ca === n ? 'on' : ''}" data-action="set-author" data-name="${h(n)}" type="button">${h(n)}</button>`).join('');
    const all = present.length > 1 ? `<button class="pe-person ${ca === GROUP_AUTHOR ? 'on' : ''}" data-action="set-author" data-name="${h(GROUP_AUTHOR)}" type="button">👥 ${GROUP_AUTHOR}</button>` : '';
    return `
      <div class="pe-who" id="whoBar">
        <b>✍️ Qui écrit ?</b>
        <div class="pe-people">${chips}${all}</div>
        ${ca ? '' : '<span class="pe-hint" style="color:#ad1c28;font-weight:700">Clique sur ton nom avant d\'écrire.</span>'}
        <button class="pe-link" data-action="change-present" type="button">👥 Modifier les personnes présentes</button>
      </div>`;
  }

  function renderContribActions(c, kind) {
    return `<span class="pe-mini">
      <button class="pe-link" data-action="edit" data-id="${h(c.id)}" data-kind="${kind}" type="button">Modifier</button>
      ${canTouch(c.auteur) ? `<button class="pe-link danger" data-action="del-${kind}" data-id="${h(c.id)}" type="button">Supprimer</button>` : ''}
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

  /** Idées de questionnements : celles de la rubrique si son titre correspond, sinon des questions génériques. */
  function questionIdeas(r, existingTexts) {
    const sug = SUGGESTIONS.find(x => sameName(x.titre, r.titre));
    const list = (sug ? sug.questions.concat(GENERIC_QUESTIONS) : GENERIC_QUESTIONS);
    return list.filter(q => !existingTexts.some(t => sameName(t, q)));
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
            <textarea class="pe-ta" id="refl-${h(q.id)}" placeholder="Votre réflexion en réponse à ce questionnement…"></textarea>
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
      const ideas = questionIdeas(r, questions.map(q => q.texte));
      html += `
        <details class="pe-add q" ${questions.length ? '' : 'open'}><summary>💡 Idées de questionnements</summary>
          <p class="pe-hint">Clique sur une idée pour l'ajouter à la rubrique (tu pourras la modifier ensuite).</p>
          <div class="pe-ideas">${ideas.map(t => `<button class="pe-idea" data-action="idea-question" data-rid="${h(r.id)}" data-text="${h(t)}" type="button">+ ${h(t)}</button>`).join('') || '<span class="pe-empty">Toutes les idées sont déjà utilisées.</span>'}</div>
        </details>
        <details class="pe-add q"><summary>+ Écrire un questionnement</summary>
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

    const usedTitles = rubs.map(r => r.titre);
    const rubIdeas = SUGGESTIONS.filter(x => !usedTitles.some(t => sameName(t, x.titre)));

    const rubHtml = rubs.length ? rubs.map(r => {
      const rc = contribs.filter(c => c.rubriqueId === r.id);
      const titleHtml = editingId === r.id
        ? `<div style="flex:1 1 300px"><input type="text" id="editBox" value="${h(r.titre)}" maxlength="200" data-ignore-pending>
             <div class="pe-actions"><button class="btn primary small" data-action="save-edit" data-id="${h(r.id)}" data-kind="rubrique" type="button">Enregistrer</button>
             <button class="btn ghost small" data-action="cancel-edit" type="button">Annuler</button></div></div>`
        : `<div><h3>${h(r.titre)}</h3><span class="pe-by">créée par ${h(r.auteur)}</span></div>
           <span class="pe-mini">
             <button class="pe-link" data-action="edit" data-id="${h(r.id)}" data-kind="rubrique" type="button">Renommer</button>
             ${canTouch(r.auteur) ? `<button class="pe-link danger" data-action="del-rubrique" data-id="${h(r.id)}" type="button">Supprimer</button>` : ''}
           </span>`;
      return `<article class="pe-rub"><div class="pe-rub-head">${titleHtml}</div><div class="pe-rub-body">${renderRubriqueBody(r, rc, true)}</div></article>`;
    }).join('') : '<div class="pe-empty" style="margin-top:14px">Aucune rubrique pour le moment : choisis une idée ou crée la tienne ci-dessous.</div>';

    return `
      <div class="pe-card">
        <div class="pe-ws-head">
          <div>
            <button class="pe-link" data-action="leave-group" type="button">← Choisir un autre groupe</button>
            <h2>${h(groupLabel(g))}</h2>
            <div class="pe-chips">${names}</div>
          </div>
          <div class="pe-actions" style="margin-top:0">
            <button class="btn ghost small" data-action="refresh" type="button">↻ Actualiser</button>
            <button class="btn ${peekOpen ? 'secondary' : 'ghost'} small" data-action="peek-toggle" type="button">👀 ${peekOpen ? 'Masquer' : 'Voir'} les autres groupes</button>
            <button class="btn ghost small" data-action="edit-members" type="button">✏️ Corriger les noms</button>
          </div>
        </div>
        ${renderFlash('travail')}
        <div id="membersBox"></div>
        ${renderPeek(g)}
        ${renderWhoBar()}
        <p class="pe-lead" style="margin-top:12px">Une <b>rubrique</b> = une thématique de l'axe. Dans chaque rubrique, posez des <b>questionnements</b> puis notez vos <b>réflexions</b>. Tout le monde peut ajouter sa part : le nom choisi dans « Qui écrit ? » est enregistré avec chaque idée.</p>
        ${rubHtml}
        <div class="pe-card" style="box-shadow:none;background:#fbf9fc">
          <h3>➕ Nouvelle rubrique</h3>
          <form id="rubForm" class="pe-newrub" autocomplete="off">
            <input type="text" name="titre" placeholder="Titre de la rubrique (ex. : Climat scolaire)" maxlength="200" required>
            <button class="btn primary" type="submit">Ajouter la rubrique</button>
          </form>
          <details class="pe-add q" ${rubs.length ? '' : 'open'} style="margin-top:12px"><summary>💡 Idées de rubriques pour un projet d'établissement</summary>
            <p class="pe-hint">Clique sur une idée pour créer la rubrique. Les questionnements associés te seront proposés ensuite.</p>
            <div class="pe-ideas">${rubIdeas.map(x => `<button class="pe-idea" data-action="idea-rubrique" data-text="${h(x.titre)}" type="button">+ ${h(x.titre)}</button>`).join('') || '<span class="pe-empty">Toutes les idées sont déjà utilisées.</span>'}</div>
          </details>
        </div>
        <div class="pe-docbox">
          <div>
            <b>📄 Document du groupe</b>
            <p>Quand votre réflexion est prête, envoyez-la au Drive : un PDF récapitulatif (un seul par groupe, remplacé à chaque envoi).</p>
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
      <div class="pe-card">
        <h2>⚙️ Synthèse automatique d'un axe</h2>
        <p class="pe-lead">Rassemble en un seul PDF tous les groupes d'un axe (rubriques, questionnements, réflexions). Une nouvelle génération remplace la précédente.</p>
        <form id="axePdfForm" autocomplete="off">
          <div class="pe-row">
            <label>Axe<select name="axe">${AXES.map(a => `<option value="${a.n}">${h(a.titre)}</option>`).join('')}</select></label>
            <label style="flex:2 1 260px;display:flex;align-items:center;gap:8px;padding-top:22px"><input type="checkbox" name="publish" checked style="width:auto;margin:0"> Publier aussi dans la Restitution</label>
          </div>
          <div class="pe-actions"><button class="btn primary" type="submit">Générer la synthèse PDF</button></div>
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

  function parseName(full) {
    const parts = String(full || '').trim().split(/\s+/);
    return { prenom: parts.shift() || '', nom: parts.join(' ') };
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

      case 'view-group': viewId = btn.dataset.id; step = 'view'; return renderAll();
      case 'peek-toggle': peekOpen = !peekOpen; return renderAll();
      case 'peek': peekId = peekId === btn.dataset.id ? null : btn.dataset.id; return renderAll();
      case 'pick-slot': {
        slot = { axe: Number(btn.dataset.axe), numero: Number(btn.dataset.num) };
        const g = groupOf(slot.axe, slot.numero);
        draft = g ? store.get('pe_present_' + g.id, []) : [];
        flash.travail = null; step = 'who';
        return renderAll();
      }
      case 'back-choose':
        slot = null; viewId = null; step = currentGroupId && present.length && step !== 'view' ? 'work' : 'choose'; flash.travail = null; return renderAll();
      case 'toggle-person': {
        const n = btn.dataset.name;
        draft = draft.includes(n) ? draft.filter(x => x !== n) : draft.concat(n).slice(0, MAX_PRESENT);
        return renderAll();
      }
      case 'start-work': {
        if (!draft.length || !slot) return;
        btn.disabled = true;
        const out = await act({ action: 'pe_joinOrCreate', axe: slot.axe, numero: slot.numero, membres: draft.map(parseName) }, null, 'travail');
        if (!out) { btn.disabled = false; return; }
        currentGroupId = out.groupId; store.set('pe_group', currentGroupId);
        present = draft.slice(); store.set('pe_present_' + currentGroupId, present);
        activeAuthor = present.length === 1 ? present[0] : null;
        slot = null; step = 'work'; flash.travail = null;
        return renderAll();
      }
      case 'change-present': {
        const g = currentGroup(); if (!g) return;
        slot = { axe: Number(g.axe), numero: Number(g.numero) };
        draft = present.slice(); step = 'who';
        return renderAll();
      }
      case 'set-author': activeAuthor = btn.dataset.name; return renderAll();
      case 'leave-group':
        currentGroupId = null; store.del('pe_group'); present = []; activeAuthor = null; editingId = null; flash.travail = null; step = 'choose'; return renderAll();

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
        const auteur = currentAuthor();
        if (!auteur) { toast('Clique d\'abord sur ton nom dans « Qui écrit ? ».'); $('#whoBar')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        btn.disabled = true;
        const out = await act({
          action: 'pe_addContribution', rubriqueId: rid,
          type: a === 'add-question' ? 'question' : 'reflexion', parentId: qid, texte, auteur
        }, a === 'add-question' ? 'Questionnement ajouté' : 'Réflexion ajoutée', 'travail');
        if (!out) btn.disabled = false;
        return;
      }

      case 'idea-question':
      case 'idea-rubrique': {
        const auteur = currentAuthor();
        if (!auteur) { toast('Clique d\'abord sur ton nom dans « Qui écrit ? ».'); $('#whoBar')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        btn.disabled = true;
        const payload = a === 'idea-question'
          ? { action: 'pe_addContribution', rubriqueId: btn.dataset.rid, type: 'question', parentId: '', texte: btn.dataset.text, auteur }
          : { action: 'pe_addRubrique', groupId: currentGroupId, titre: btn.dataset.text, auteur };
        const out = await act(payload, a === 'idea-question' ? 'Questionnement ajouté' : 'Rubrique ajoutée', 'travail');
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
        return void await act({ action: 'pe_deleteContribution', id: btn.dataset.id, auteur: (data.contributions.find(x => x.id === btn.dataset.id) || {}).auteur || '', code: adminCode || '' }, 'Supprimé', 'travail');
      case 'del-rubrique':
        if (!confirm('Supprimer cette rubrique et tout son contenu ?')) return;
        return void await act({ action: 'pe_deleteRubrique', rubriqueId: btn.dataset.id, auteur: (data.rubriques.find(x => x.id === btn.dataset.id) || {}).auteur || '', code: adminCode || '' }, 'Rubrique supprimée', 'travail');

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

    if (form.id === 'personForm') {
      const prenom = capitalizeName(fd.get('prenom')), nom = capitalizeName(fd.get('nom'));
      if (!prenom && !nom) return;
      const full = `${prenom} ${nom}`.trim();
      if (!draft.some(n => sameName(n, full))) draft = draft.concat(full).slice(0, MAX_PRESENT);
      return renderAll();
    }

    if (submit) submit.disabled = true;
    try {
      if (form.id === 'rubForm') {
        const g = currentGroup();
        const titre = String(fd.get('titre') || '').trim();
        const auteur = currentAuthor();
        if (!auteur) { toast('Clique d\'abord sur ton nom dans « Qui écrit ? ».'); }
        else if (g && titre) await act({ action: 'pe_addRubrique', groupId: g.id, titre, auteur }, 'Rubrique ajoutée', 'travail');
      } else if (form.id === 'adminForm') {
        const code = String(fd.get('code') || '');
        try {
          await apiPost({ action: 'pe_adminCheck', code });
          adminCode = code; try { sessionStorage.setItem('pe_admin', code); } catch (e) { /* ignore */ }
          flash.admin = null;
          renderAll();
        } catch (e) { flash.admin = { type: 'error', text: e.message }; renderAll(); }
      } else if (form.id === 'axePdfForm') {
        if (submit) submit.textContent = 'Génération en cours…';
        const axe = Number(fd.get('axe'));
        const out = await act({ action: 'pe_adminAxePdf', code: adminCode, axe, axeLabel: axeTitle(axe), publish: fd.get('publish') === 'on' }, '✅ Synthèse générée', 'admin');
        if (out) {
          flash.admin = { type: 'ok', text: `Synthèse de ${axeTitle(axe)} générée (${out.groupes} groupe${out.groupes > 1 ? 's' : ''}).` + (out.published ? (out.shared ? ' Elle est visible dans la Restitution.' : ' Publiée, mais le partage par lien est bloqué par ton domaine Google : partage-la dans Drive.') : ' Elle est rangée dans le dossier « Syntheses » du Drive.') };
          renderAll();
        }
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
    if (activeTab === 'travail' && (step === 'who' || pendingText())) return;
    if (activeTab === 'admin') return;
    refresh(true);
  }, POLL_MS);
})();
