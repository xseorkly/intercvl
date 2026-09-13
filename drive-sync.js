(() => {
  // URL du déploiement Apps Script (Application Web).
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxeMAI2vOb_bn_R6JyXIfIcmzrtzrHe8kVJBK1nJjnaJ9GXPaMEvFv7vufA_Ww4pfVk4w/exec';
  const HTML2PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

  function setStatus(el, text, cls) {
    if (!el) return;
    el.textContent = text;
    el.className = 'drive-sync-status' + (cls ? ' ' + cls : '');
  }

  function slugify(value) {
    return String(value || 'table')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'table';
  }

  function timestamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }

  function loadScript(src, marker) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[${marker}]`);
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error('Impossible de charger le moteur PDF.')), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.setAttribute(marker, '1');
      s.onload = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => reject(new Error('Impossible de charger le moteur PDF. Vérifiez la connexion internet.'));
      document.head.appendChild(s);
    });
  }

  async function ensureHtml2Pdf() {
    if (window.html2pdf) return;
    await loadScript(HTML2PDF_CDN, 'data-html2pdf-loader');
  }

  function waitForImages(root) {
    const images = [...root.querySelectorAll('img')];
    return Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }));
  }

  function nextPaint() {
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  function createRenderLayer(html) {
    // Le contenu à capturer DOIT rester dans les coordonnées visibles du document.
    // L'ancienne version le plaçait à left:-12000px, ce qui pouvait produire une page blanche.
    const cover = document.createElement('div');
    cover.className = 'drive-pdf-generation-cover';
    Object.assign(cover.style, {
      position: 'fixed', inset: '0', zIndex: '2147483647',
      display: 'grid', placeItems: 'center', background: '#ffffff', color: '#242038',
      fontFamily: 'Arial, sans-serif', fontWeight: '700', fontSize: '18px'
    });
    cover.innerHTML = '<div style="text-align:center"><div style="font-size:34px;margin-bottom:12px">📄</div>Génération du PDF…<div style="font-size:13px;font-weight:400;color:#666;margin-top:8px">Ne fermez pas cette page.</div></div>';

    const host = document.createElement('div');
    host.className = 'drive-pdf-render-host';
    Object.assign(host.style, {
      position: 'absolute',
      left: '0',
      top: `${Math.max(0, window.scrollY)}px`,
      width: '794px',
      boxSizing: 'border-box',
      padding: '30px',
      margin: '0',
      background: '#ffffff',
      color: '#222222',
      zIndex: '2147483646',
      pointerEvents: 'none',
      fontFamily: 'Arial, sans-serif'
    });
    host.innerHTML = html;
    document.body.appendChild(host);
    document.body.appendChild(cover);
    return { host, cover };
  }

  function canvasLooksBlank(canvas) {
    if (!canvas || !canvas.width || !canvas.height) return true;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    const maxSamples = 9000;
    const sx = Math.max(1, Math.floor(canvas.width / Math.sqrt(maxSamples)));
    const sy = Math.max(1, Math.floor(canvas.height / Math.sqrt(maxSamples)));
    let checked = 0;
    let nonWhite = 0;
    for (let y = 0; y < canvas.height; y += sy) {
      for (let x = 0; x < canvas.width; x += sx) {
        const p = ctx.getImageData(x, y, 1, 1).data;
        checked++;
        if (p[3] > 20 && (p[0] < 245 || p[1] < 245 || p[2] < 245)) nonWhite++;
        if (nonWhite > 25) return false;
        if (checked > maxSamples) break;
      }
      if (checked > maxSamples) break;
    }
    return nonWhite <= 25;
  }

  function renderScaleFor(host) {
    const width = Math.max(794, host.scrollWidth || 794);
    const height = Math.max(1000, host.scrollHeight || 1000);
    // Limites prudentes pour éviter les canvas géants (autre cause classique de PDF blanc).
    const dimensionLimit = 24500 / height;
    const areaLimit = Math.sqrt(55000000 / (width * height));
    return Math.max(0.42, Math.min(1.35, dimensionLimit, areaLimit));
  }

  async function createPrettyPdfBlob(html, filename) {
    await ensureHtml2Pdf();
    const { host, cover } = createRenderLayer(html);
    try {
      if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
      await waitForImages(host);
      await nextPaint();

      const scale = renderScaleFor(host);
      const options = {
        margin: [8, 8, 8, 8],
        filename,
        image: { type: 'jpeg', quality: 0.90 },
        html2canvas: {
          scale,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: Math.max(900, host.scrollWidth + 40),
          windowHeight: Math.max(window.innerHeight, host.scrollHeight + 40)
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        pagebreak: {
          mode: ['css', 'legacy'],
          before: '.page-break-before',
          avoid: ['.print-charter-article', '.report-candidate', '.report-rule']
        }
      };

      // On force d'abord la création du canvas pour pouvoir vérifier qu'il n'est pas blanc.
      const worker = window.html2pdf().set(options).from(host).toCanvas();
      const canvas = await worker.get('canvas');
      if (canvasLooksBlank(canvas)) throw new Error('Le moteur graphique a produit un rendu vide.');

      const pdfWorker = worker.toPdf();
      const pdf = await pdfWorker.get('pdf');
      const blob = pdf.output('blob');
      if (!blob || blob.size < 1800) throw new Error('Le fichier PDF généré est anormalement petit.');
      return { blob, mode: 'graphique' };
    } finally {
      host.remove();
      cover.remove();
    }
  }

  function cleanPdfText(text) {
    return String(text || '')
      // Les polices intégrées de jsPDF ne couvrent pas les emoji ; on les retire dans le mode de secours.
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function htmlToStructuredText(html) {
    const root = document.createElement('div');
    root.innerHTML = html;
    root.querySelectorAll('script,style,button').forEach(n => n.remove());
    const blocks = new Set(['DIV','P','SECTION','ARTICLE','H1','H2','H3','H4','H5','H6','LI','UL','OL','TABLE','TR','BLOCKQUOTE','HEADER','FOOTER']);
    let out = '';
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) { out += node.nodeValue || ''; return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.tagName;
      if (tag === 'BR') { out += '\n'; return; }
      const isBlock = blocks.has(tag);
      if (isBlock && out && !out.endsWith('\n')) out += '\n';
      if (tag === 'LI') out += '- ';
      [...node.childNodes].forEach(walk);
      if (isBlock && !out.endsWith('\n')) out += '\n';
    }
    walk(root);
    const text = cleanPdfText(out);
    root.remove();
    return text;
  }

  function cp1252Bytes(str) {
    const map = {
      0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,
      0x02C6:0x88,0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,
      0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,
      0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F
    };
    const out = [];
    for (const ch of String(str)) {
      const cp = ch.codePointAt(0);
      if (cp <= 0x7F || (cp >= 0xA0 && cp <= 0xFF)) out.push(cp);
      else if (map[cp] !== undefined) out.push(map[cp]);
      else out.push(0x3F); // ? pour les caractères absents de WinAnsi
    }
    return out;
  }

  function asciiBytes(str) { return [...String(str)].map(ch => ch.charCodeAt(0) & 0x7F); }
  function concatBytes(parts) {
    const total = parts.reduce((n,p)=>n+p.length,0), out = new Uint8Array(total);
    let off=0; for (const p of parts) { out.set(p,off); off+=p.length; } return out;
  }
  function pdfEscapeText(text) {
    return String(text).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
  }
  function wrapPdfText(text, maxChars) {
    const result=[];
    for (const paragraph of String(text).split(/\n/)) {
      const trimmed=paragraph.trim();
      if (!trimmed) { result.push(''); continue; }
      const words=trimmed.split(/\s+/); let line='';
      for (const word0 of words) {
        let word=word0;
        while (word.length > maxChars) {
          if (line) { result.push(line); line=''; }
          result.push(word.slice(0,maxChars)); word=word.slice(maxChars);
        }
        const trial=line?`${line} ${word}`:word;
        if (trial.length > maxChars && line) { result.push(line); line=word; }
        else line=trial;
      }
      if (line) result.push(line);
    }
    return result;
  }

  function createNativeTextPdfBlob(html, filename) {
    const text = htmlToStructuredText(html);
    if (!text || text.length < 2) throw new Error('Aucun contenu à placer dans le PDF de secours.');
    const lines = wrapPdfText(text, 92);
    const linesPerPage = 52;
    const pages=[];
    for (let i=0;i<lines.length;i+=linesPerPage) pages.push(lines.slice(i,i+linesPerPage));
    if (!pages.length) pages.push(['Aucune trace enregistrée.']);

    const pageCount=pages.length;
    const fontNormal=3, fontBold=4;
    const firstPageObj=5;
    const maxObj=4+pageCount*2;
    const objects=new Array(maxObj+1);
    objects[1]=asciiBytes('<< /Type /Catalog /Pages 2 0 R >>');
    const kids=[];
    for(let i=0;i<pageCount;i++) kids.push(`${firstPageObj+i*2} 0 R`);
    objects[2]=asciiBytes(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageCount} >>`);
    objects[3]=asciiBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objects[4]=asciiBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    for(let i=0;i<pageCount;i++) {
      const pageObj=firstPageObj+i*2, contentObj=pageObj+1;
      objects[pageObj]=asciiBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${fontNormal} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentObj} 0 R >>`);
      const contentParts=[];
      const addAscii=t=>contentParts.push(asciiBytes(t));
      const addText=t=>contentParts.push(new Uint8Array(cp1252Bytes(pdfEscapeText(t))));
      addAscii('BT\n/F2 13 Tf\n52 806 Td\n('); addText('INTER-CVL ZESE - Carnet de traces'); addAscii(') Tj\n');
      addAscii('/F1 9 Tf\n0 -17 Td\n('); addText(`Page ${i+1} / ${pageCount}`); addAscii(') Tj\n');
      addAscii('/F1 9.5 Tf\n12.5 TL\n0 -22 Td\n');
      for(const line of pages[i]) { addAscii('('); addText(line || ' '); addAscii(') Tj\nT*\n'); }
      addAscii('ET\n');
      const stream=concatBytes(contentParts);
      objects[contentObj]=concatBytes([asciiBytes(`<< /Length ${stream.length} >>\nstream\n`),stream,asciiBytes('\nendstream')]);
    }

    const chunks=[asciiBytes('%PDF-1.4\n%PDFGEN\n')];
    const offsets=new Array(maxObj+1).fill(0); let pos=chunks[0].length;
    for(let i=1;i<=maxObj;i++) {
      offsets[i]=pos;
      const head=asciiBytes(`${i} 0 obj\n`), tail=asciiBytes('\nendobj\n');
      chunks.push(head,objects[i],tail); pos+=head.length+objects[i].length+tail.length;
    }
    const xrefPos=pos;
    const xref=[`xref\n0 ${maxObj+1}\n`,`0000000000 65535 f \n`];
    for(let i=1;i<=maxObj;i++) xref.push(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
    const trailer=`trailer\n<< /Size ${maxObj+1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
    chunks.push(asciiBytes(xref.join('')),asciiBytes(trailer));
    const bytes=concatBytes(chunks);
    const blob=new Blob([bytes],{type:'application/pdf'});
    if(blob.size<1200) throw new Error('Le PDF de secours n’a pas pu être créé correctement.');
    return {blob,mode:'texte-secours'};
  }

  async function createTextFallbackPdfBlob(html, filename) {
    return createNativeTextPdfBlob(html, filename);
  }

  async function createPdfBlob(html, filename) {
    try {
      return await createPrettyPdfBlob(html, filename);
    } catch (primaryError) {
      console.warn('[PDF] rendu graphique impossible, passage au mode texte :', primaryError);
      return await createTextFallbackPdfBlob(html, filename);
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result || '');
        resolve(value.includes(',') ? value.split(',')[1] : value);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function post(payload) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async function send(atelier, tableName, jsonBackup, statusEl) {
    setStatus(statusEl, '⏳ Envoi d’une copie du carnet…');
    try {
      const data = await post({ action: 'backup', atelier, tableName: tableName || 'table', jsonBackup });
      if (data && data.ok) setStatus(statusEl, '✅ Copie du carnet enregistrée dans Drive', 'ok');
      else setStatus(statusEl, '⚠️ Échec de l’envoi : ' + ((data && data.error) || 'raison inconnue'), 'err');
      return data;
    } catch (err) {
      setStatus(statusEl, '⚠️ Envoi impossible. Le carnet reste sauvegardé sur cet appareil.', 'err');
      return { ok: false, error: String(err) };
    }
  }

  async function generateAndSendPdf({ atelier, tableName, jsonBackup, html, statusEl, filename }) {
    const safeName = filename || `${slugify(atelier)}_${slugify(tableName)}_${timestamp()}.pdf`;
    let blob;
    let mode = '';
    try {
      setStatus(statusEl, '⏳ Génération et vérification du PDF…');
      const built = await createPdfBlob(html, safeName);
      blob = built.blob;
      mode = built.mode;

      setStatus(statusEl, `☁️ PDF vérifié (${mode === 'graphique' ? 'mise en page complète' : 'mode texte de secours'}). Envoi vers Drive…`);
      const pdfBase64 = await blobToBase64(blob);
      const data = await post({
        action: 'pdf', atelier, tableName: tableName || 'table', jsonBackup,
        pdfBase64, pdfFileName: safeName, pdfRenderMode: mode
      });

      if (data && data.ok && data.pdfSaved) {
        setStatus(statusEl, `✅ PDF enregistré dans Drive${mode === 'texte-secours' ? ' (mode de secours, toutes les traces textuelles sont présentes)' : ''}`, 'ok');
        return { ...data, blob, filename: safeName, renderMode: mode };
      }

      downloadBlob(blob, safeName);
      const reason = data && data.ok
        ? 'Le service Drive doit être mis à jour avec le nouveau Code.gs. Une copie locale du PDF a été téléchargée.'
        : ((data && data.error) || 'raison inconnue');
      setStatus(statusEl, '⚠️ ' + reason, 'err');
      return { ok: false, error: reason, blob, filename: safeName, renderMode: mode };
    } catch (err) {
      if (blob) downloadBlob(blob, safeName);
      setStatus(statusEl, '⚠️ PDF non envoyé : ' + String(err.message || err), 'err');
      return { ok: false, error: String(err), blob, filename: safeName, renderMode: mode };
    }
  }

  window.IntercvlDriveSync = { send, generateAndSendPdf, createPdfBlob, downloadBlob, slugify };
})();
