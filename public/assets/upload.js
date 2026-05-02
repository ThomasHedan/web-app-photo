/* ================================================
   Upload — Mariage de Marine et Mael
   ================================================ */
const API_BASE = '/api';

/* ---- État global ---- */
let selectedFiles = [];

/* ================================================
   Modal de bienvenue
   ================================================ */
function showWelcomeModal() {
  if (!localStorage.getItem('marine-mael-visited')) {
    document.getElementById('welcome-modal').style.display = 'flex';
  }
}

function closeWelcomeModal() {
  localStorage.setItem('marine-mael-visited', '1');
  document.getElementById('welcome-modal').style.display = 'none';
}

/* Fermer avec Échap */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('welcome-modal');
    if (modal.style.display !== 'none') closeWelcomeModal();
  }
});

/* ================================================
   Drag & Drop
   ================================================ */
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('drag-over');
  }
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles(Array.from(e.dataTransfer.files));
});

/* Clic sur la zone (l'input est positionné par-dessus, donc ce listener est un fallback) */
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

fileInput.addEventListener('change', () => {
  handleFiles(Array.from(fileInput.files));
  fileInput.value = ''; /* Permet de re-sélectionner les mêmes fichiers */
});

/* ================================================
   Gestion des fichiers sélectionnés
   ================================================ */
function handleFiles(files) {
  const images = files.filter((f) => f.type.startsWith('image/'));

  if (files.length > 0 && images.length === 0) {
    showToast('Seuls les fichiers image sont acceptés.', 'error');
    return;
  }

  let added = 0;
  for (const file of images) {
    const isDuplicate = selectedFiles.some(
      (f) => f.name === file.name && f.size === file.size
    );
    if (!isDuplicate) {
      selectedFiles.push(file);
      addPreview(file);
      added++;
    }
  }

  if (added === 0 && images.length > 0) {
    showToast('Ces photos sont déjà sélectionnées.', 'info');
  }

  document.getElementById('upload-btn').style.display =
    selectedFiles.length > 0 ? 'inline-flex' : 'none';
}

/* ================================================
   Prévisualisation
   ================================================ */
function addPreview(file) {
  const safeId = makeSafeId(file.name + file.size);
  const reader = new FileReader();

  reader.onload = (e) => {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.dataset.name = file.name;
    item.dataset.size = file.size;

    item.innerHTML = `
      <img src="${e.target.result}" alt="${escapeHtml(file.name)}" loading="lazy">
      <div class="preview-meta">
        <span class="preview-name">${escapeHtml(file.name)}</span>
        <span class="preview-size">${formatSize(file.size)}</span>
      </div>
      <div class="preview-progress">
        <div class="progress-bar" id="bar-${safeId}"></div>
      </div>
      <div class="preview-status" id="status-${safeId}"></div>
      <button
        class="preview-remove"
        aria-label="Retirer cette photo"
        onclick="removeFile('${escapeHtml(file.name)}', ${file.size})"
      >✕</button>
    `;
    document.getElementById('previews').appendChild(item);
  };

  reader.readAsDataURL(file);
}

function removeFile(name, size) {
  selectedFiles = selectedFiles.filter(
    (f) => !(f.name === name && f.size === size)
  );
  const item = document.querySelector(
    `.preview-item[data-name="${CSS.escape(name)}"][data-size="${size}"]`
  );
  if (item) item.remove();

  document.getElementById('upload-btn').style.display =
    selectedFiles.length > 0 ? 'inline-flex' : 'none';
}

/* ================================================
   Upload principal
   ================================================ */
async function uploadAll() {
  if (!selectedFiles.length) return;

  const btn = document.getElementById('upload-btn');
  btn.disabled = true;
  btn.textContent = 'Envoi en cours…';

  let successes = 0;
  let errors = 0;

  /* Upload en séquentiel pour éviter de saturer la connexion mobile */
  for (const file of [...selectedFiles]) {
    try {
      await uploadFile(file);
      successes++;
      /* Retirer le fichier de la liste une fois envoyé */
      selectedFiles = selectedFiles.filter(
        (f) => !(f.name === file.name && f.size === file.size)
      );
    } catch (err) {
      console.error(`Échec upload "${file.name}":`, err);
      errors++;
      const safeId = makeSafeId(file.name + file.size);
      const statusEl = document.getElementById(`status-${safeId}`);
      if (statusEl) {
        statusEl.textContent = '✗ Erreur';
        statusEl.style.color = '#b91c1c';
      }
    }
  }

  if (successes > 0) {
    showToast(
      `${successes} photo${successes > 1 ? 's' : ''} partagée${successes > 1 ? 's' : ''} avec succès\u00a0! 🎉`,
      'success'
    );
  }
  if (errors > 0) {
    showToast(
      `${errors} photo${errors > 1 ? 's' : ''} n'ont pas pu être envoyée${errors > 1 ? 's' : ''}.`,
      'error'
    );
  }

  btn.disabled = false;
  btn.innerHTML = '<span aria-hidden="true">📤</span> Partager les photos';
  btn.style.display = selectedFiles.length > 0 ? 'inline-flex' : 'none';
}

async function uploadFile(file) {
  const safeId = makeSafeId(file.name + file.size);
  const barEl    = document.getElementById(`bar-${safeId}`);
  const statusEl = document.getElementById(`status-${safeId}`);

  const setStatus = (text) => { if (statusEl) statusEl.textContent = text; };
  const setBar    = (pct)  => { if (barEl) barEl.style.width = `${pct}%`; };

  /* Étape 1 — Compression */
  setStatus('Compression…');
  setBar(5);

  let uploadCandidate = file;
  const isCompressible = file.type.startsWith('image/') && file.type !== 'image/gif';

  if (isCompressible && typeof imageCompression === 'function') {
    try {
      uploadCandidate = await imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        initialQuality: 0.82,
        onProgress: (p) => setBar(5 + p * 0.25),
      });
    } catch (compressErr) {
      console.warn('Compression échouée, envoi original :', compressErr);
      uploadCandidate = file;
    }
  }

  if (uploadCandidate.size > 10 * 1024 * 1024) {
    throw new Error('Fichier trop volumineux après compression (max 10 Mo)');
  }

  /* Étape 2 — Obtenir l'URL présignée */
  setStatus('Préparation…');
  setBar(32);

  const contentType = uploadCandidate.type || 'image/jpeg';

  const presignRes = await fetch(`${API_BASE}/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType }),
  });

  if (!presignRes.ok) {
    let errMsg = 'Erreur serveur';
    try {
      const errData = await presignRes.json();
      errMsg = errData.error || errMsg;
    } catch (_) { /* ignore */ }
    throw new Error(errMsg);
  }

  const { uploadUrl } = await presignRes.json();

  /* Étape 3 — Upload vers R2 */
  setStatus('Envoi…');

  await xhrUpload(uploadUrl, uploadCandidate, contentType, (p) => {
    setBar(32 + p * 68);
  });

  setBar(100);
  if (barEl) barEl.style.background = '#1e6647';
  setStatus('✓ Partagée\u00a0!');
  if (statusEl) statusEl.style.color = '#1e6647';
}

/* XHR pour suivre la progression d'upload */
function xhrUpload(url, file, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload échoué (HTTP ${xhr.status})`));
    });

    xhr.addEventListener('error', () => reject(new Error('Erreur réseau')));
    xhr.addEventListener('abort', () => reject(new Error('Upload annulé')));

    xhr.send(file);
  });
}

/* ================================================
   Toasts
   ================================================ */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 350);
  }, 4000);
}

/* ================================================
   Utilitaires
   ================================================ */
function makeSafeId(str) {
  return str.replace(/[^a-zA-Z0-9]/g, '_');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}\u00a0Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}\u00a0Mo`;
}

/* ================================================
   Init
   ================================================ */
showWelcomeModal();
