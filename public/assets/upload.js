/* ================================================
   Upload — Mariage de Marine et Mael
   ================================================ */
const API_BASE = '/api';

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

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('welcome-modal');
    if (modal.style.display !== 'none') closeWelcomeModal();
  }
});

/* ================================================
   Inputs fichiers (camera + galerie)
   ================================================ */
const cameraInput  = document.getElementById('camera-input');
const galleryInput = document.getElementById('gallery-input');

cameraInput.addEventListener('change', () => {
  handleFiles(Array.from(cameraInput.files));
  cameraInput.value = '';
});

galleryInput.addEventListener('change', () => {
  handleFiles(Array.from(galleryInput.files));
  galleryInput.value = '';
});

/* ================================================
   Sticky bar
   ================================================ */
function updateStickyBar() {
  const bar   = document.getElementById('sticky-bar');
  const count = document.getElementById('sticky-count');
  const n     = selectedFiles.length;

  if (n > 0) {
    bar.classList.add('visible');
    count.textContent = `${n} photo${n > 1 ? 's' : ''}`;
  } else {
    bar.classList.remove('visible');
  }
}

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

  updateStickyBar();
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
  updateStickyBar();
}

/* ================================================
   Upload principal
   ================================================ */
async function uploadAll() {
  if (!selectedFiles.length) return;

  const btn = document.getElementById('upload-btn');
  btn.disabled = true;
  btn.textContent = 'Envoi…';

  let successes = 0;
  let errors = 0;

  for (const file of [...selectedFiles]) {
    try {
      await uploadFile(file);
      successes++;
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
      `${successes} photo${successes > 1 ? 's' : ''} partagée${successes > 1 ? 's' : ''} ! 🎉`,
      'success'
    );
  }
  if (errors > 0) {
    showToast(
      `${errors} photo${errors > 1 ? 's' : ''} n'ont pas pu être envoyées.`,
      'error'
    );
  }

  btn.disabled = false;
  btn.textContent = 'Partager ↑';
  updateStickyBar();
}

async function uploadFile(file) {
  const safeId   = makeSafeId(file.name + file.size);
  const barEl    = document.getElementById(`bar-${safeId}`);
  const statusEl = document.getElementById(`status-${safeId}`);

  const setStatus = (text) => { if (statusEl) statusEl.textContent = text; };
  const setBar    = (pct)  => { if (barEl) barEl.style.width = `${pct}%`; };

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

  setStatus('Envoi…');

  await xhrUpload(uploadUrl, uploadCandidate, contentType, (p) => {
    setBar(32 + p * 68);
  });

  setBar(100);
  if (barEl) barEl.style.background = '#1e6647';
  setStatus('✓ Partagée !');
  if (statusEl) statusEl.style.color = '#1e6647';
}

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
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/* ================================================
   Init
   ================================================ */
showWelcomeModal();
