(() => {
  // URL du déploiement Apps Script (Application Web).
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxeMAI2vOb_bn_R6JyXIfIcmzrtzrHe8kVJBK1nJjnaJ9GXPaMEvFv7vufA_Ww4pfVk4w/exec';
  const HTML2PDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';

  const PDF_CSS = `
    .drive-pdf-render-host, .drive-pdf-render-host * { box-sizing: border-box; }
    .drive-pdf-render-host .preview-doc {
      font-family: Arial, Helvetica, sans-serif !important;
      color: #242038 !important;
      font-size: 13.2px !important;
      line-height: 1.52 !important;
      max-width: none !important;
      width: 100% !important;
      background: #fff !important;
    }
    .drive-pdf-render-host .preview-logos {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 20px !important;
      padding: 0 0 12px !important;
      margin: 0 0 16px !important;
      border-bottom: 3px solid #c20a73 !important;
    }
    .drive-pdf-render-host .preview-logos img {
      max-height: 54px !important;
      max-width: 37% !important;
      object-fit: contain !important;
    }
    .drive-pdf-render-host .workshop-cover,
    .drive-pdf-render-host .charter-cover {
      text-align: left !important;
      padding: 20px 22px 21px !important;
      margin: 0 0 20px !important;
      border-radius: 16px !important;
      background: linear-gradient(135deg,#211d47 0%,#30285f 58%,#8e0050 100%) !important;
      color: #fff !important;
      box-shadow: none !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .drive-pdf-render-host .workshop-cover .pdf-eyebrow,
    .drive-pdf-render-host .charter-cover > span {
      display: block !important;
      margin: 0 0 8px !important;
      color: #f4b9db !important;
      font-size: 9px !important;
      font-weight: 800 !important;
      letter-spacing: .13em !important;
      text-transform: uppercase !important;
    }
    .drive-pdf-render-host .workshop-cover h1,
    .drive-pdf-render-host .charter-cover h1 {
      margin: 0 !important;
      color: #fff !important;
      font-size: 28px !important;
      line-height: 1.1 !important;
      letter-spacing: -.02em !important;
    }
    .drive-pdf-render-host .workshop-cover h2 {
      margin: 5px 0 0 !important;
      color: #fff !important;
      font-size: 17px !important;
      line-height: 1.25 !important;
      font-weight: 650 !important;
    }
    .drive-pdf-render-host .workshop-cover .pdf-table-name,
    .drive-pdf-render-host .charter-cover p {
      display: inline-block !important;
      margin: 13px 0 0 !important;
      padding: 6px 10px !important;
      border: 1px solid rgba(255,255,255,.28) !important;
      border-radius: 999px !important;
      background: rgba(255,255,255,.10) !important;
      color: #fff !important;
      font-size: 11px !important;
      font-weight: 700 !important;
    }
    .drive-pdf-render-host .preview-doc > h1 {
      margin: 0 0 3px !important;
      color: #211d47 !important;
      font-size: 25px !important;
    }
    .drive-pdf-render-host .preview-doc > h2 {
      margin: 0 0 10px !important;
      color: #c20a73 !important;
      font-size: 17px !important;
    }
    .drive-pdf-render-host section {
      margin: 18px 0 0 !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
    }
    .drive-pdf-render-host section > h2 {
      margin: 0 0 12px !important;
      padding: 9px 12px 9px 14px !important;
      border-left: 5px solid #c20a73 !important;
      border-radius: 8px !important;
      background: #f4f0f7 !important;
      color: #211d47 !important;
      font-size: 17px !important;
      line-height: 1.25 !important;
      break-after: avoid !important;
      page-break-after: avoid !important;
    }
    .drive-pdf-render-host h3 {
      margin: 12px 0 5px !important;
      color: #3c3651 !important;
      font-size: 12.8px !important;
      line-height: 1.3 !important;
      break-after: avoid !important;
      page-break-after: avoid !important;
    }
    .drive-pdf-render-host h4 {
      margin: 10px 0 5px !important;
      color: #4c4660 !important;
      font-size: 12px !important;
      break-after: avoid !important;
      page-break-after: avoid !important;
    }
    .drive-pdf-render-host p { margin: 6px 0 !important; }
    .drive-pdf-render-host .answer {
      white-space: pre-wrap !important;
      margin: 0 0 9px !important;
      padding: 9px 11px !important;
      border: 1px solid #e5dce6 !important;
      border-left: 4px solid #c20a73 !important;
      border-radius: 8px !important;
      background: #fbf8fb !important;
      color: #292535 !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .drive-pdf-render-host .pdf-answer-block {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .drive-pdf-render-host ul,
    .drive-pdf-render-host ol { padding-left: 22px !important; margin: 7px 0 !important; }
    .drive-pdf-render-host li { margin: 3px 0 !important; }
    .drive-pdf-render-host .concept-summary,
    .drive-pdf-render-host .print-story,
    .drive-pdf-render-host .report-candidate,
    .drive-pdf-render-host .report-rule,
    .drive-pdf-render-host .report-dilemma,
    .drive-pdf-render-host .report-lab {
      border-radius: 9px !important;
      box-shadow: none !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .drive-pdf-render-host .concept-summary,
    .drive-pdf-render-host .print-story {
      margin: 8px 0 !important;
      padding: 10px 12px !important;
      border: 1px solid #e4e0ea !important;
      background: #faf9fc !important;
    }
    .drive-pdf-render-host .manifesto-quote {
      margin: 10px 0 14px !important;
      padding: 16px 18px !important;
      border-radius: 12px !important;
      border: 1px solid #e8cadd !important;
      background: #fff3f9 !important;
      color: #7f064d !important;
      font-size: 17px !important;
      font-weight: 750 !important;
      line-height: 1.4 !important;
      text-align: center !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .drive-pdf-render-host .print-plan {
      width: 100% !important;
      border-collapse: collapse !important;
      margin: 9px 0 14px !important;
      font-size: 11px !important;
    }
    .drive-pdf-render-host .print-plan th {
      padding: 8px !important;
      background: #211d47 !important;
      color: #fff !important;
      text-align: left !important;
      border: 1px solid #211d47 !important;
    }
    .drive-pdf-render-host .print-plan td {
      padding: 8px !important;
      border: 1px solid #ddd8e2 !important;
      vertical-align: top !important;
    }
    .drive-pdf-render-host .print-plan tr:nth-child(even) td { background: #faf9fc !important; }
    .drive-pdf-render-host img { max-width: 100% !important; }
    .drive-pdf-render-host section img:not(.preview-logos img) {
      border-radius: 10px !important;
      border: 1px solid #ded8e2 !important;
    }
    .drive-pdf-render-host .report-pole {
      margin-top: 22px !important;
      break-before: page !important;
      page-break-before: always !important;
    }
    .drive-pdf-render-host .report-pole-head {
      padding: 13px 14px !important;
      border: 1px solid #ddd8e8 !important;
      border-left: 5px solid #c20a73 !important;
      border-radius: 10px !important;
      background: #f7f4fa !important;
    }
    .drive-pdf-render-host .report-pole-head h2 {
      margin: 1px 0 3px !important;
      color: #211d47 !important;
      font-size: 17px !important;
    }
    .drive-pdf-render-host .report-rotations { gap: 12px !important; }
    .drive-pdf-render-host .report-rotation {
      padding: 12px !important;
      border: 1px solid #ded9e4 !important;
      border-radius: 10px !important;
      background: #fff !important;
    }
    .drive-pdf-render-host .report-rotation-title {
      padding-bottom: 7px !important;
      margin-bottom: 7px !important;
      border-bottom: 1px solid #ece8ef !important;
    }
    .drive-pdf-render-host .report-rotation-title h3 { margin: 0 !important; color: #c20a73 !important; }
    .drive-pdf-render-host .report-mini-grid { gap: 7px !important; margin: 9px 0 !important; }
    .drive-pdf-render-host .report-mini-grid > div {
      padding: 8px !important;
      border: 1px solid #e7e3eb !important;
      border-radius: 8px !important;
      background: #faf9fc !important;
    }
    .drive-pdf-render-host .report-dilemma {
      padding: 10px 12px !important;
      border: 1px solid #ead39a !important;
      background: #fff9e9 !important;
    }
    .drive-pdf-render-host .report-rule {
      padding: 9px 11px !important;
      border: 1px solid #ddd8ef !important;
      border-left: 4px solid #655ba5 !important;
      background: #f8f7fd !important;
    }
    .drive-pdf-render-host .report-candidate {
      padding: 10px 11px !important;
      border: 1px solid #e2dde6 !important;
      background: #fff !important;
    }
    .drive-pdf-render-host .print-charter-article {
      display: grid !important;
      grid-template-columns: 38px 1fr !important;
      gap: 12px !important;
      margin: 0 0 8px !important;
      padding: 11px 12px !important;
      border: 1px solid #e2dce5 !important;
      border-radius: 10px !important;
      background: #fff !important;
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .drive-pdf-render-host .print-charter-article > span {
      width: 34px !important;
      height: 34px !important;
      display: grid !important;
      place-items: center !important;
      border-radius: 9px !important;
      background: #c20a73 !important;
      color: #fff !important;
      font-size: 14px !important;
      font-weight: 900 !important;
    }
    .drive-pdf-render-host .print-charter-article small {
      color: #8e0050 !important;
      font-size: 9px !important;
      font-weight: 800 !important;
      letter-spacing: .06em !important;
      text-transform: uppercase !important;
    }
    .drive-pdf-render-host .print-charter-article h3 { margin: 2px 0 4px !important; font-size: 14px !important; }
    .drive-pdf-render-host .print-charter-article p { margin: 0 !important; }
    .drive-pdf-render-host .page-break-before {
      break-before: page !important;
      page-break-before: always !important;
    }
  `;

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
    host.innerHTML = `<style>${PDF_CSS}</style>${html}`;
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
        margin: [11, 10, 16, 10],
        filename,
        image: { type: 'jpeg', quality: 0.96 },
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
          avoid: ['.print-charter-article', '.report-candidate', '.report-rule', '.answer', '.concept-summary', '.print-story', '.report-dilemma']
        }
      };

      // On force d'abord la création du canvas pour pouvoir vérifier qu'il n'est pas blanc.
      const worker = window.html2pdf().set(options).from(host).toCanvas();
      const canvas = await worker.get('canvas');
      if (canvasLooksBlank(canvas)) throw new Error('Le moteur graphique a produit un rendu vide.');

      const pdfWorker = worker.toPdf();
      const pdf = await pdfWorker.get('pdf');

      // Finition éditoriale : pied de page discret et pagination sur toutes les pages.
      try {
        const totalPages = pdf.internal.getNumberOfPages();
        for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
          pdf.setPage(pageNo);
          pdf.setDrawColor(224, 219, 229);
          pdf.setLineWidth(0.2);
          pdf.line(12, 287.5, 198, 287.5);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7.5);
          pdf.setTextColor(105, 100, 118);
          pdf.text('INTER-CVL ZESE - Nicosie', 12, 292.2);
          pdf.text(`Page ${pageNo} / ${totalPages}`, 198, 292.2, { align: 'right' });
        }
      } catch (footerError) {
        console.warn('[PDF] pagination non ajoutée :', footerError);
      }

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
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
    } catch (err) {
      const e = new Error(
        'Connexion à Apps Script impossible. Vérifiez que le déploiement est une Application Web accessible sans connexion et que vous utilisez bien l’URL /exec.'
      );
      e.cause = err;
      e.code = 'NETWORK_OR_CORS';
      throw e;
    }

    const text = await res.text();
    const trimmed = String(text || '').trim();

    if (!res.ok) {
      const e = new Error(`Apps Script a répondu HTTP ${res.status}. ${trimmed.slice(0, 180)}`);
      e.code = 'HTTP_ERROR';
      e.status = res.status;
      throw e;
    }

    if (!trimmed) {
      const e = new Error('Apps Script a renvoyé une réponse vide. Vérifiez le déploiement et ses autorisations.');
      e.code = 'EMPTY_RESPONSE';
      throw e;
    }

    try {
      return JSON.parse(trimmed);
    } catch (err) {
      const looksHtml = /<!doctype|<html|<head|<body/i.test(trimmed);
      const e = new Error(looksHtml
        ? 'Apps Script a renvoyé une page Google au lieu de JSON. Le déploiement n’est probablement pas accessible anonymement, n’est pas la bonne version, ou l’autorisation Drive n’a pas été accordée.'
        : `Réponse Apps Script non reconnue : ${trimmed.slice(0, 180)}`
      );
      e.code = looksHtml ? 'HTML_INSTEAD_OF_JSON' : 'INVALID_JSON';
      e.rawResponse = trimmed.slice(0, 500);
      throw e;
    }
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
      console.error('[Drive] Envoi PDF impossible :', err, err && err.rawResponse ? err.rawResponse : '');
      const detail = String(err && err.message ? err.message : err);
      setStatus(statusEl, '⚠️ Envoi Drive impossible : ' + detail + ' Le PDF a été téléchargé sur cet appareil pour ne rien perdre.', 'err');
      return { ok: false, error: detail, code: err && err.code, blob, filename: safeName, renderMode: mode };
    }
  }

  window.IntercvlDriveSync = { send, generateAndSendPdf, createPdfBlob, downloadBlob, slugify };
})();
