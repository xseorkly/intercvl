(() => {
  // URL du déploiement Apps Script (Application Web).
  // IMPORTANT : le Code.gs fourni avec le site doit être déployé sur cette même application Web.
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

  function ensureHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-html2pdf-loader]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', () => reject(new Error('Impossible de charger le moteur PDF.')), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = HTML2PDF_CDN;
      s.async = true;
      s.dataset.html2pdfLoader = '1';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Impossible de charger le moteur PDF. Vérifiez la connexion internet.'));
      document.head.appendChild(s);
    });
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

  async function createPdfBlob(html, filename) {
    await ensureHtml2Pdf();

    const host = document.createElement('div');
    host.className = 'drive-pdf-render-host';
    host.style.position = 'fixed';
    host.style.left = '-12000px';
    host.style.top = '0';
    host.style.width = '794px';
    host.style.background = '#ffffff';
    host.style.zIndex = '-9999';
    host.style.pointerEvents = 'none';
    host.innerHTML = html;
    document.body.appendChild(host);

    try {
      await waitForImages(host);
      const options = {
        margin: [8, 8, 8, 8],
        filename,
        image: { type: 'jpeg', quality: 0.88 },
        html2canvas: {
          scale: 1.45,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 794
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
        pagebreak: { mode: ['css', 'legacy'], before: '.page-break-before', avoid: ['.print-charter-article', '.report-candidate'] }
      };
      const worker = window.html2pdf().set(options).from(host).toPdf();
      const pdf = await worker.get('pdf');
      return pdf.output('blob');
    } finally {
      host.remove();
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
      // text/plain évite le preflight CORS avec Apps Script.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  // Envoi volontaire d'une copie JSON du carnet, sans PDF.
  async function send(atelier, tableName, jsonBackup, statusEl) {
    setStatus(statusEl, '⏳ Envoi d’une copie du carnet…');
    try {
      const data = await post({
        action: 'backup',
        atelier,
        tableName: tableName || 'table',
        jsonBackup
      });
      if (data && data.ok) {
        setStatus(statusEl, '✅ Copie du carnet enregistrée dans Drive', 'ok');
      } else {
        setStatus(statusEl, '⚠️ Échec de l’envoi : ' + ((data && data.error) || 'raison inconnue'), 'err');
      }
      return data;
    } catch (err) {
      setStatus(statusEl, '⚠️ Envoi impossible. Le carnet reste sauvegardé sur cet appareil.', 'err');
      return { ok: false, error: String(err) };
    }
  }

  // Génère réellement le PDF dans le navigateur puis l'enregistre directement dans Drive.
  async function generateAndSendPdf({ atelier, tableName, jsonBackup, html, statusEl, filename }) {
    const safeName = filename || `${slugify(atelier)}_${slugify(tableName)}_${timestamp()}.pdf`;
    let blob;
    try {
      setStatus(statusEl, '⏳ Génération du PDF…');
      blob = await createPdfBlob(html, safeName);

      setStatus(statusEl, '☁️ PDF généré. Envoi vers votre Drive…');
      const pdfBase64 = await blobToBase64(blob);
      const data = await post({
        action: 'pdf',
        atelier,
        tableName: tableName || 'table',
        jsonBackup,
        pdfBase64,
        pdfFileName: safeName
      });

      if (data && data.ok && data.pdfSaved) {
        setStatus(statusEl, '✅ PDF enregistré directement dans Drive', 'ok');
        return { ...data, blob, filename: safeName };
      }

      // Si l'ancien Apps Script est encore déployé, on évite toute perte.
      downloadBlob(blob, safeName);
      const reason = data && data.ok
        ? 'Le service Drive doit être mis à jour avec le nouveau Code.gs. Une copie locale du PDF a été téléchargée.'
        : ((data && data.error) || 'raison inconnue');
      setStatus(statusEl, '⚠️ ' + reason, 'err');
      return { ok: false, error: reason, blob, filename: safeName };
    } catch (err) {
      if (blob) downloadBlob(blob, safeName);
      setStatus(statusEl, '⚠️ PDF non envoyé. ' + String(err.message || err), 'err');
      return { ok: false, error: String(err), blob, filename: safeName };
    }
  }

  window.IntercvlDriveSync = { send, generateAndSendPdf, createPdfBlob, downloadBlob, slugify };
})();
