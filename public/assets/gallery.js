/* ================================================
   Galerie — Mariage de Marine et Mael
   ================================================ */
const API_BASE = '/api';

/* ---- État lightbox ---- */
let photos = [];
let currentIndex = 0;
let lightboxOpen = false;

/* ================================================
   Chargement des photos
   ================================================ */
async function loadPhotos() {
  const grid    = document.getElementById('photo-grid');
  const meta    = document.getElementById('gallery-meta');
  const loading = document.getElementById('gallery-loading');

  try {
    const res = await fetch(`${API_BASE}/photos`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    photos = data.photos || [];

    loading.style.display = 'none';

    if (photos.length === 0) {
      meta.textContent = '';
      grid.innerHTML = `
        <div class="gallery-empty" role="status">
          <p>Aucune photo pour l'instant — soyez les premiers à en partager\u00a0!</p>
        </div>
      `;
      return;
    }

    /* Compteur */
    meta.innerHTML = `
      <span class="photo-count">${photos.length}</span>
      photo${photos.length > 1 ? 's' : ''} partagée${photos.length > 1 ? 's' : ''}
      &nbsp;<span class="heartbeat" aria-hidden="true">♥</span>
    `;

    /* Rendu de la grille */
    const fragment = document.createDocumentFragment();
    photos.forEach((photo, index) => {
      const item = document.createElement('div');
      item.className = 'photo-item';
      item.setAttribute('role', 'listitem');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', `Photo ${index + 1} sur ${photos.length} — cliquez pour agrandir`);

      const img = document.createElement('img');
      img.src     = photo.url;
      img.alt     = `Photo du mariage ${index + 1}`;
      img.loading = 'lazy';

      item.appendChild(img);
      item.addEventListener('click', () => openLightbox(index));
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openLightbox(index);
        }
      });

      fragment.appendChild(item);
    });
    grid.appendChild(fragment);

  } catch (err) {
    loading.textContent = 'Impossible de charger les photos. Réessayez dans quelques instants.';
    loading.style.color = '#b91c1c';
    meta.textContent = '';
    console.error('Erreur chargement galerie :', err);
  }
}

/* ================================================
   Lightbox
   ================================================ */
function openLightbox(index) {
  currentIndex = index;
  lightboxOpen = true;
  document.body.style.overflow = 'hidden';
  document.getElementById('lightbox').classList.add('active');
  updateLightboxImage();
  document.getElementById('lightbox-img').focus();
}

function closeLightbox() {
  lightboxOpen = false;
  document.body.style.overflow = '';
  document.getElementById('lightbox').classList.remove('active');
}

function updateLightboxImage() {
  const photo   = photos[currentIndex];
  const img     = document.getElementById('lightbox-img');
  const counter = document.getElementById('lightbox-counter');

  img.src = photo.url;
  img.alt = `Photo du mariage ${currentIndex + 1} sur ${photos.length}`;
  counter.textContent = `${currentIndex + 1} / ${photos.length}`;
}

function prevPhoto() {
  currentIndex = (currentIndex - 1 + photos.length) % photos.length;
  updateLightboxImage();
}

function nextPhoto() {
  currentIndex = (currentIndex + 1) % photos.length;
  updateLightboxImage();
}

/* Navigation clavier */
document.addEventListener('keydown', (e) => {
  if (!lightboxOpen) return;
  switch (e.key) {
    case 'Escape':     closeLightbox(); break;
    case 'ArrowLeft':  prevPhoto();     break;
    case 'ArrowRight': nextPhoto();     break;
  }
});

/* Swipe tactile pour mobile */
(function setupSwipe() {
  let startX = null;
  const lb = document.getElementById('lightbox');

  lb.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  lb.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? nextPhoto() : prevPhoto();
    }
    startX = null;
  }, { passive: true });
})();

/* ================================================
   Init
   ================================================ */
loadPhotos();
