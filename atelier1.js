(() => {
  const STORAGE_KEY = 'intercvl-zese-atelier1-v1';
  const emptyState = () => ({
    tableName:'', currentStep:0,
    participants:{1:[],2:[],3:[],4:[]},
    initializedRotations:{1:true,2:false,3:false,4:false},
    fields:{}, selected:{}, canvas:null
  });
  let state = loadState();
  state.participants ||= {1:[],2:[],3:[],4:[]};
  state.initializedRotations ||= {1:true,2:false,3:false,4:false};
  [1,2,3,4].forEach(r=>{ state.participants[r] ||= []; if(r===1 || state.participants[r].length) state.initializedRotations[r]=true; });
  let activeStep = Number(state.currentStep || 0);
  let timerSeconds = 600, timerId = null, timerRunning = false;
  let currentParticipantRotation = 1;

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  function loadState(){ try { return {...emptyState(), ...(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'))}; } catch { return emptyState(); }}
  function saveState(show=true){
    state.currentStep = activeStep;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if(show){ const el=$('#saveStatus'); if(el){el.textContent='✓ Sauvegardé sur cet appareil'; setTimeout(()=>el.textContent='💾 Sauvegarde locale active',1200);} }
  }

  // Navigation
  function ensureRotationParticipants(rotation){
    const r=Number(rotation);
    if(r<2 || r>4) return;
    if(!state.initializedRotations[r]){
      state.participants[r]=(state.participants[r-1]||[]).map(p=>({...p}));
      state.initializedRotations[r]=true;
      saveState(false);
    }
  }
  function go(step){
    activeStep = Number(step);
    if(activeStep>=2 && activeStep<=4) ensureRotationParticipants(activeStep);
    $$('.panel').forEach(p => p.classList.toggle('visible', Number(p.dataset.panel)===activeStep));
    $$('.step').forEach(b => b.classList.toggle('active', Number(b.dataset.step)===activeStep));
    state.currentStep = activeStep; saveState(false); resetTimer(); updateRelayPreviews();
    if(activeStep>=1 && activeStep<=4) renderContributors(activeStep);
    renderAllContributors();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  $$('[data-go]').forEach(b => b.addEventListener('click',()=>go(b.dataset.go)));
  $$('.step').forEach(b => b.addEventListener('click',()=>go(b.dataset.step)));

  // Meta + fields
  $('#tableName').value = state.tableName || '';
  $('#tableName').addEventListener('input',e=>{state.tableName=e.target.value;saveState();});
  $$('[data-field]').forEach(el=>{
    const key=el.dataset.field; el.value=state.fields[key] ?? '';
    const evt = el.tagName==='SELECT' ? 'change' : 'input';
    el.addEventListener(evt,()=>{state.fields[key]=el.value;saveState();updateRelayPreviews();});
  });
  $$('[data-segment]').forEach(group=>{
    const key=group.dataset.segment;
    $$('button',group).forEach(btn=>{
      btn.classList.toggle('active',state.selected[key]===btn.dataset.value);
      btn.addEventListener('click',()=>{state.selected[key]=btn.dataset.value;$$('button',group).forEach(b=>b.classList.toggle('active',b===btn));saveState();});
    });
  });

  // Participants
  const dialog=$('#participantDialog'), form=$('#participantForm');
  function renderContributors(rotation){
    const box=$(`.contributors[data-rotation="${rotation}"]`); if(!box)return;
    const list=state.participants[rotation]||[];
    const carryNote=rotation>1?`<div class="carry-note">↪️ Les noms de la rotation ${rotation-1} ont été conservés lors du premier passage sur cette étape. Retirez la personne partie vers une autre table et ajoutez l’ambassadeur qui vient d’arriver.</div>`:'';
    box.innerHTML=`<div class="contributors-head"><div><h3>👥 Qui est autour de la table ?</h3><p class="contributors-sub">Ces prénoms restent enregistrés pour cette rotation.</p></div><button class="btn secondary small add-person" data-r="${rotation}">+ Ajouter un prénom</button></div>${carryNote}<div class="people-list">${list.length?list.map((p,i)=>`<span class="person-chip"><strong>${esc(p.name)}</strong><small>${esc(p.school)}</small><button title="Supprimer ce nom de la rotation ${rotation}" aria-label="Supprimer ${esc(p.name)}" data-remove="${i}" data-r="${rotation}">×</button></span>`).join(''):'<span class="empty-note">Aucun prénom ajouté pour cette rotation.</span>'}</div>`;
    $('.add-person',box).addEventListener('click',()=>openParticipant(rotation));
    $$('[data-remove]',box).forEach(btn=>btn.addEventListener('click',()=>{
      const r=Number(btn.dataset.r), i=Number(btn.dataset.remove);
      state.participants[r].splice(i,1); saveState(); renderContributors(r); renderAllContributors();
    }));
  }
  function openParticipant(rotation){
    currentParticipantRotation=Number(rotation);
    $('#participantRotation').value=rotation;
    $('#participantName').value='';$('#participantSchool').value='';
    const hint=$('#existingPeopleHint');
    const current=state.participants[currentParticipantRotation]||[];
    if(hint){
      hint.innerHTML=current.length?`<strong>Déjà enregistrés pour cette rotation :</strong><div class="existing-chips">${current.map(p=>`<span>${esc(p.name)} <small>(${esc(p.school)})</small></span>`).join('')}</div>`:'<span class="empty-note">Aucun nom enregistré pour cette rotation.</span>';
    }
    dialog.showModal();setTimeout(()=>$('#participantName').focus(),60)
  }
  form.addEventListener('submit',e=>{
    e.preventDefault(); const name=$('#participantName').value.trim(), school=$('#participantSchool').value.trim(); if(!name||!school)return;
    state.participants[currentParticipantRotation] ||= [];
    const duplicate=state.participants[currentParticipantRotation].some(p=>p.name.toLowerCase()===name.toLowerCase() && p.school.toLowerCase()===school.toLowerCase());
    if(!duplicate) state.participants[currentParticipantRotation].push({name,school});
    state.initializedRotations[currentParticipantRotation]=true;
    saveState(); renderContributors(currentParticipantRotation); renderAllContributors(); dialog.close();
  });
  [1,2,3,4].forEach(renderContributors);
  function allPeople(){
    const m=new Map(); Object.values(state.participants).flat().forEach(p=>m.set(`${p.name.toLowerCase()}|${p.school.toLowerCase()}`,p)); return [...m.values()];
  }
  function renderAllContributors(){
    const el=$('#allContributors'); if(!el)return; const people=allPeople();
    if(!people.length){el.innerHTML='<span class="empty-note">Aucun prénom ajouté pour le moment.</span>';return;}
    const groups={}; people.forEach(p=>(groups[p.school]||=[]).push(p.name));
    el.innerHTML=Object.entries(groups).sort((a,b)=>a[0].localeCompare(b[0])).map(([s,n])=>`<div class="school-group"><strong>${esc(s)}</strong> — ${[...new Set(n)].map(esc).join(', ')}</div>`).join('');
  }

  // Timer
  function timerText(s){return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}
  function updateTimer(){ $('#timerDisplay').textContent=timerText(timerSeconds); $('#timerLabel').textContent = activeStep>=1&&activeStep<=4 ? `Rotation ${activeStep}` : 'Prêt'; }
  function startTimer(){ if(timerRunning || !(activeStep>=1&&activeStep<=4))return; timerRunning=true; timerId=setInterval(()=>{timerSeconds--;updateTimer();if(timerSeconds===120)toast('⏳','Plus que 2 minutes','Préparez ce que vous voulez transmettre.');if(timerSeconds===30)toast('🗣️','30 secondes','Formulez votre message pour la rotation suivante.');if(timerSeconds<=0){clearInterval(timerId);timerRunning=false;timerSeconds=0;updateTimer();toast('🔄','Rotation !','Accueillez celles et ceux qui arrivent, puis ajoutez leurs prénoms.',true);openParticipant(activeStep);}},1000)}
  function pauseTimer(){if(timerId)clearInterval(timerId);timerRunning=false}
  function resetTimer(){pauseTimer();timerSeconds=600;updateTimer()}
  $('#timerStart').addEventListener('click',startTimer); $('#timerPause').addEventListener('click',pauseTimer); $('#timerReset').addEventListener('click',resetTimer);
  function toast(icon,title,text,long=false){const t=$('#rotationToast');t.querySelector('.toast-icon').textContent=icon;t.querySelector('strong').textContent=title;t.querySelector('span').textContent=text;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),long?6000:3500)}

  function updateRelayPreviews(){
    [['relay1Preview','r1_relay'],['relay2Preview','r2_relay'],['relay3Preview','r3_relay']].forEach(([id,key])=>{const el=$('#'+id);if(el)el.textContent=state.fields[key]?.trim()||'Aucune note pour le moment.';});
  }

  // Canvas
  const canvas=$('#networkCanvas'), ctx=canvas.getContext('2d'); let drawing=false, erase=false;
  ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='#1010a0';
  function restoreCanvas(){if(!state.canvas)return;const img=new Image();img.onload=()=>ctx.drawImage(img,0,0,canvas.width,canvas.height);img.src=state.canvas}
  function pos(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*(canvas.width/r.width),y:(e.clientY-r.top)*(canvas.height/r.height)}}
  canvas.addEventListener('pointerdown',e=>{drawing=true;canvas.setPointerCapture(e.pointerId);const p=pos(e);ctx.beginPath();ctx.moveTo(p.x,p.y)});
  canvas.addEventListener('pointermove',e=>{if(!drawing)return;const p=pos(e);ctx.globalCompositeOperation=erase?'destination-out':'source-over';ctx.lineWidth=erase?24:4;ctx.strokeStyle='#1010a0';ctx.lineTo(p.x,p.y);ctx.stroke()});
  function stopDraw(){if(!drawing)return;drawing=false;ctx.globalCompositeOperation='source-over';state.canvas=canvas.toDataURL('image/png');saveState(false)}
  canvas.addEventListener('pointerup',stopDraw);canvas.addEventListener('pointercancel',stopDraw);
  $('#penBtn').addEventListener('click',()=>{erase=false;$('#penBtn').classList.add('active');$('#eraserBtn').classList.remove('active')});
  $('#eraserBtn').addEventListener('click',()=>{erase=true;$('#eraserBtn').classList.add('active');$('#penBtn').classList.remove('active')});
  $('#clearCanvas').addEventListener('click',()=>{if(confirm('Effacer tout le schéma ?')){ctx.clearRect(0,0,canvas.width,canvas.height);state.canvas=null;saveState()}});
  restoreCanvas();

  // Summary / preview
  const labelMap={
    r1_known:'Établissements connus',r1_unknown:'Établissements inconnus',r1_links:'État des liens actuels',r1_reflection:'NOTRE RÉFLEXION',r1_relay:'Message transmis',
    r2_ambassador:"Ce que l’ambassadeur apporte avec lui",r2_time:'Temps',r2_visibility:'Visibilité',r2_entry:"Absence de porte d’entrée",r2_complexity:'Complexité perçue',r2_priority:'Frein prioritaire',r2_priority_reason:'Pourquoi ?',r2_reflection:'NOTRE RÉFLEXION',r2_relay:'Message transmis',
    r3_ambassador:"Ce que l’ambassadeur apporte avec lui",r3_idea:'Idée du dispositif',r3_who:'Qui fait quoi ?',r3_why:'Pourquoi cette répartition ?',r3_join:'Comment rejoindre ?',r3_tool:'Outil ou format',r3_first:'Premier geste',r3_reflection:'NOTRE RÉFLEXION',r3_relay:'Message transmis',
    r4_ambassador:"Ce que l’ambassadeur apporte avec lui",r4_frequency:'Fréquence réaliste',r4_sustain:"Éviter l’effet one shot",r4_handover:'Passer le relais',r4_reflection:'NOTRE RÉFLEXION',r4_resilience_reason:'Renforcer la transmissibilité',r4_relay:'Message final',
    final_device:'Dispositif de mise en relation',final_operation:'Fonctionnement du lien',final_next:'Action dès la semaine prochaine'
  };
  function participantsHtml(r){const list=state.participants[r]||[];return list.length?list.map(p=>`${esc(p.name)} <em>(${esc(p.school)})</em>`).join(' • '):'<em>Aucun nom renseigné</em>'}
  function answers(keys){return keys.map(k=>`<div class="pdf-answer-block"><h3>${esc(labelMap[k]||k)}</h3><div class="answer">${esc(state.fields[k]||'—')}</div></div>`).join('')}
  function summaryHtml(){
    const resil=state.selected.r4_resilience||'—'; const canvasImg=state.canvas?`<img src="${state.canvas}" style="width:100%;border:1px solid #ddd;border-radius:8px">`:'<div class="answer">Aucun schéma réalisé.</div>';
    const grouped={};allPeople().forEach(p=>(grouped[p.school]||=[]).push(p.name));
    const all=Object.entries(grouped).map(([s,n])=>`<div><strong>${esc(s)}</strong> — ${n.map(esc).join(', ')}</div>`).join('')||'—';
    return `<div class="preview-doc">
      <div class="preview-logos"><img src="assets/logo-zese.png"><img src="assets/logo-aefe.png"></div>
      <div class="workshop-cover"><span class="pdf-eyebrow">INTER-CVL ZESE • NICOSIE • CARNET DE TRACES</span><h1>Atelier 1</h1><h2>Faire réseau entre établissements</h2><p class="pdf-table-name">${esc(state.tableName||'Table non renseignée')}</p></div>
      <section><h2>Rotation 1 — Identifier le réseau réel</h2><p><strong>Prénoms du groupe :</strong> ${participantsHtml(1)}</p>${answers(['r1_known','r1_unknown','r1_links','r1_reflection','r1_relay'])}</section>
      <section><h2>Rotation 2 — Identifier les freins</h2><p><strong>Prénoms du groupe :</strong> ${participantsHtml(2)}</p>${answers(['r2_ambassador','r2_time','r2_visibility','r2_entry','r2_complexity','r2_priority','r2_priority_reason','r2_reflection','r2_relay'])}</section>
      <section><h2>Rotation 3 — Imaginer une action</h2><p><strong>Prénoms du groupe :</strong> ${participantsHtml(3)}</p>${answers(['r3_ambassador','r3_idea','r3_who','r3_why','r3_join','r3_tool','r3_first','r3_reflection','r3_relay'])}</section>
      <section><h2>Rotation 4 — Structurer le lien pour qu'il dure</h2><p><strong>Prénoms du groupe :</strong> ${participantsHtml(4)}</p>${answers(['r4_ambassador','r4_frequency','r4_sustain','r4_handover','r4_reflection'])}<h3>Le dispositif survivrait au départ de la personne motrice ?</h3><div class="answer">${esc(resil)}</div>${answers(['r4_resilience_reason','r4_relay'])}</section>
      <section><h2>Production finale</h2>${answers(['final_device','final_operation','final_next'])}<h3>Schéma du fonctionnement du lien</h3>${canvasImg}</section>
      <section><h2>Personnes ayant contribué pendant les 40 minutes</h2>${all}</section>
    </div>`;
  }
  $('#previewBtn').addEventListener('click',()=>{$('#previewContent').innerHTML=summaryHtml();$('#previewDialog').showModal()});
  $('#closePreview').addEventListener('click',()=>$('#previewDialog').close());

  // Ancienne fonction d’impression conservée comme solution de secours ; le bouton principal génère désormais un vrai PDF et l’envoie dans Drive.
  function printSummary(){
    const old=document.getElementById('printSummary'); if(old) old.remove();
    const print=document.createElement('div'); print.id='printSummary'; print.className='print-summary'; print.innerHTML=summaryHtml();
    document.body.appendChild(print); document.body.classList.add('printing-summary');
    const cleanup=()=>{document.body.classList.remove('printing-summary');print.remove();window.removeEventListener('afterprint',cleanup)};
    window.addEventListener('afterprint',cleanup);
    setTimeout(()=>window.print(),80);
  }
  $('#pdfBtn').addEventListener('click',async()=>{
    const filename=`Atelier1_FaireReseau_${(state.tableName||'table').replace(/[^a-z0-9_-]+/gi,'_')}.pdf`;
    const result=await window.IntercvlDriveSync?.generateAndSendPdf({atelier:'atelier1',tableName:state.tableName,jsonBackup:state,html:summaryHtml(),statusEl:$('#driveSyncStatus'),filename});
    if(result?.ok) toast('✅','PDF enregistré','Le PDF a été généré et enregistré directement dans le Drive de l’équipe organisatrice.',true);
  });

  // Backup/restore
  $('#backupBtn').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Atelier1_${(state.tableName||'table').replace(/[^a-z0-9_-]+/gi,'_')}_sauvegarde.json`;a.click();URL.revokeObjectURL(a.href)});
  $('#restoreInput').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const fr=new FileReader();fr.onload=()=>{try{const data=JSON.parse(fr.result);state={...emptyState(),...data};localStorage.setItem(STORAGE_KEY,JSON.stringify(state));location.reload()}catch{alert('Ce fichier de sauvegarde n’est pas valide.')}};fr.readAsText(file)});
  $('#driveSyncBtn')?.addEventListener('click',()=>{window.IntercvlDriveSync?.send('atelier1',state.tableName,state,$('#driveSyncStatus'))});
  $('#resetAll').addEventListener('click',()=>{if(confirm('Effacer toutes les notes, tous les prénoms et le schéma de cette table ?')){localStorage.removeItem(STORAGE_KEY);location.reload()}});

  updateRelayPreviews();renderAllContributors();updateTimer();go(activeStep);
})();
