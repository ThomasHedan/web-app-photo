# Prompt pour Claude Code — Galerie photo collaborative "Mariage de Marine et Mael"

## Contexte du projet

Je veux créer une application web simple pour un événement (mariage) où les invités peuvent uploader leurs photos via un QR code, et où tout le monde peut consulter la galerie partagée. Le tout doit être hébergé gratuitement sur Cloudflare (R2 + Pages + Workers).

**Nom de l'événement à afficher partout : "Mariage de Marine et Mael"**

## Stack technique

- **Storage** : Cloudflare R2 (bucket nommé `marine-mael-photos`)
- **Hosting** : Cloudflare Pages (deux pages statiques)
- **Backend** : Cloudflare Worker pour générer des URLs présignées et lister les objets du bucket
- **Frontend** : HTML + CSS + Vanilla JS (pas de framework, simplicité maximale)
- **Compression image** : `browser-image-compression` via CDN avant upload

## Architecture demandée

```
/
├── public/
│   ├── upload.html       # Page d'upload (QR code pointe ici)
│   ├── gallery.html      # Page galerie (consultation)
│   └── assets/
│       ├── style.css
│       ├── upload.js
│       └── gallery.js
├── worker/
│   ├── src/index.ts      # Cloudflare Worker
│   └── wrangler.toml
└── README.md             # Instructions de déploiement complètes
```

## Spécifications fonctionnelles

### Page 1 — `upload.html`

- **Titre principal en haut** : "Mariage de Marine et Mael" avec une typo élégante (genre Playfair Display ou Cormorant Garamond)
- **Sous-titre** : "Partagez vos plus beaux moments 📸"
- **Pop-up de bienvenue à la première visite** :
  - S'affiche uniquement à la première connexion (utiliser `localStorage` avec une clé `marine-mael-visited`)
  - Titre : "Bienvenue !"
  - Texte explicatif :
    > "Merci d'être là pour célébrer notre union ! Cette page vous permet de partager toutes les photos que vous prenez pendant la soirée. Vos photos seront ajoutées à une galerie commune que tous les invités pourront consulter. C'est notre façon de revivre ensemble cette journée à travers vos regards. Bon shooting ! 💕 — Marine & Mael"
  - Bouton "C'est parti !" pour fermer
  - Design : modal centré, fond semi-transparent, animation d'apparition douce
- **Zone d'upload** :
  - Drag & drop ET sélection multiple via `<input type="file" multiple accept="image/*" capture="environment">`
  - Aperçu des photos sélectionnées avant envoi (thumbnails)
  - Compression automatique côté client avant upload (max 1920px de large, qualité 0.8)
  - Barre de progression par fichier
  - Message de confirmation après upload réussi
  - Gestion d'erreur claire
- **Lien discret en bas** : "Voir la galerie →" qui pointe vers `gallery.html`

### Page 2 — `gallery.html`

- **Même titre** : "Mariage de Marine et Mael"
- **Sous-titre** : "La galerie partagée"
- **Affichage** :
  - Grille responsive type masonry (CSS grid avec `grid-template-columns: repeat(auto-fill, minmax(250px, 1fr))`)
  - Lazy loading des images (`loading="lazy"`)
  - Lightbox au clic pour voir en grand (avec navigation gauche/droite et fermeture par échap ou clic extérieur)
  - Tri par date d'upload, plus récentes en premier
  - Compteur de photos en haut ("128 photos partagées")
- **Bouton "Ajouter une photo"** flottant en bas à droite qui renvoie vers `upload.html`
- **Pas de fonction de suppression** côté invité (pour éviter les blagues)

### Cloudflare Worker

Endpoints à créer :

1. **`POST /api/presign`**
   - Reçoit `{ filename, contentType }`
   - Génère une URL S3 présignée valide 5 minutes pour PUT vers R2
   - Préfixe le nom de fichier par un timestamp pour éviter les collisions : `${Date.now()}-${randomId}-${filename}`
   - Renvoie `{ uploadUrl, publicUrl, key }`
   - **Rate limiting basique** : max 50 uploads par IP par heure (utiliser Cloudflare KV ou Durable Objects, ou simplement un header `cf-connecting-ip` + KV)

2. **`GET /api/photos`**
   - Liste tous les objets du bucket via l'API R2
   - Renvoie un tableau `[{ url, uploadedAt, size }]` trié par date desc
   - Pagination optionnelle (param `?cursor=`)
   - Cache la réponse 30 secondes côté Worker

### Configuration R2

- Bucket : `marine-mael-photos`
- Custom domain : `photos.<domaine>.com` (à documenter dans le README pour que je le configure)
- CORS configuré pour autoriser les uploads PUT depuis le domaine de Pages
- Lifecycle rule optionnelle : supprimer les fichiers > 6 mois (à mentionner dans README sans l'activer par défaut)

## Design / UX

- **Style** : élégant, moderne, romantique mais pas kitsch
- **Palette suggérée** : tons doux (blanc cassé, beige rosé, doré subtil pour les accents) — mais reste libre de proposer mieux
- **Typographie** : une serif élégante pour les titres + une sans-serif lisible pour le corps
- **Mobile-first** absolument (90% des invités scanneront le QR avec leur téléphone)
- **Animations** subtiles (fade-in des images, transitions douces)
- **Accessibilité** : alt text, contraste suffisant, navigation clavier dans la lightbox

## Ce que je veux dans le README

1. Étapes pas-à-pas pour :
   - Créer le bucket R2 et activer un domaine public
   - Configurer les variables d'environnement et secrets du Worker (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `PUBLIC_BASE_URL`)
   - Déployer le Worker via `wrangler deploy`
   - Déployer les pages via Cloudflare Pages (depuis GitHub ou via wrangler)
   - Configurer le CORS du bucket
2. Commande pour générer le QR code (suggérer un générateur en ligne ou un script Node)
3. Comment tester en local
4. Estimation des coûts (rester sur free tier pour ~20 000 photos)

## Contraintes / qualité de code

- TypeScript pour le Worker, JS vanilla pour le front (pas de build step si possible)
- Code propre, commenté en français
- Validation côté Worker : vérifier le `contentType` (whitelist images uniquement), limiter la taille max à 10 MB par fichier
- Sécurité : ne jamais exposer les clés R2 côté client, tout passe par le Worker
- Pas de tracking, pas d'analytics, RGPD-friendly

## Bonus (si possible)

- Petit easter egg : un cœur qui pulse discrètement quelque part
- Possibilité pour Marine et Mael de télécharger l'intégralité de la galerie en zip via une URL admin secrète (paramètre `?admin=<token>`)

---

Génère-moi tout le code, la structure de fichiers, et le README. Pose-moi des questions seulement si quelque chose est vraiment ambigu, sinon prends les meilleures décisions par défaut. Go !