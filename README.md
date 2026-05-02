# Mariage de Marine et Mael — Galerie photo collaborative

Application web permettant aux invités de partager leurs photos via un QR code.

**Stack :** Cloudflare R2 (stockage) · Vercel (hébergement + API serverless) · HTML/CSS/JS vanilla

---

## Architecture

```
public/
  upload.html          ← Page d'upload (QR code pointe ici)
  gallery.html         ← Galerie partagée
  assets/
    style.css / upload.js / gallery.js
api/
  presign.ts           ← POST /api/presign  (URL présignée pour upload vers R2)
  photos.ts            ← GET  /api/photos   (liste des photos)
  admin/
    download.ts        ← GET  /api/admin/download?token=... (manifeste admin)
vercel.json            ← Routing des fichiers statiques
package.json
```

**Flux d'upload :**
1. L'invité sélectionne ses photos → compression navigateur (max 1920 px)
2. Appel `POST /api/presign` → reçoit une URL présignée S3 valide 5 min
3. Upload direct vers R2 via l'URL présignée (aucune donnée ne transite par Vercel)

---

## Prérequis

- Compte [Cloudflare](https://cloudflare.com) (gratuit) pour le stockage R2
- Compte [Vercel](https://vercel.com) (gratuit) pour l'hébergement
- Repo GitHub relié à Vercel

---

## Étape 1 — Créer le bucket R2

1. Tableau de bord Cloudflare → **R2** → **Create bucket**
2. Nom : `marine-mael-photos` | Région : Automatic

### Activer l'accès public

- Bucket → **Settings** → **Public Access** → activer
- Notez l'URL publique générée (ex : `https://pub-<hash>.r2.dev`)
- Optionnel : ajoutez un **Custom Domain** `photos.votredomaine.com` (recommandé)

### Créer une clé API R2

1. Tableau de bord Cloudflare → **R2** → **Manage R2 API Tokens**
2. **Create API Token** → permissions **Object Read & Write** sur `marine-mael-photos`
3. Notez **Access Key ID** et **Secret Access Key**
4. Notez aussi votre **Account ID** (visible en haut à droite du tableau de bord)

### Configurer le CORS du bucket

Bucket → **Settings** → **CORS Policy** :

```json
[
  {
    "AllowedOrigins": [
      "https://VOTRE_PROJET.vercel.app",
      "https://votredomainepersonnel.com"
    ],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

> Pour tester en local, ajoutez aussi `"http://localhost:3000"`.

---

## Étape 2 — Déployer sur Vercel via GitHub

### 1. Pousser le repo sur GitHub

```bash
git init
git add .
git commit -m "init galerie mariage"
git remote add origin https://github.com/VOTRE_USER/VOTRE_REPO.git
git push -u origin main
```

### 2. Connecter à Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → importer votre repo GitHub
2. Paramètres de build :
   - **Framework Preset** : Other
   - **Build Command** : *(laisser vide)*
   - **Output Directory** : *(laisser vide)*
   - **Install Command** : `npm install`
3. Cliquez **Deploy**

### 3. Ajouter les variables d'environnement

Dans Vercel → votre projet → **Settings** → **Environment Variables** :

| Variable              | Valeur                                        |
|-----------------------|-----------------------------------------------|
| `R2_ACCOUNT_ID`       | Votre Account ID Cloudflare                   |
| `R2_ACCESS_KEY_ID`    | Access Key ID de la clé API R2                |
| `R2_SECRET_ACCESS_KEY`| Secret Access Key de la clé API R2            |
| `PUBLIC_BASE_URL`     | `https://pub-<hash>.r2.dev` ou votre custom domain |
| `ADMIN_TOKEN`         | Un token secret long (ex : `openssl rand -hex 32`) |

Après avoir ajouté les variables, cliquez **Redeploy**.

---

## Étape 3 — Tester en local

```bash
npm install
npx vercel dev
# → http://localhost:3000
```

Créez un fichier `.env.local` à la racine avec vos variables :

```env
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
PUBLIC_BASE_URL=https://pub-<hash>.r2.dev
ADMIN_TOKEN=votre_token_secret
```

---

## Étape 4 — Générer le QR code

```bash
# Installer l'outil
npm install -g qrcode

# Générer un PNG
qrcode "https://VOTRE_PROJET.vercel.app/upload.html" -o qrcode-mariage.png -w 400
```

Ou en ligne : [qrcode-monkey.com](https://www.qrcode-monkey.com) — entrez l'URL `upload.html`.

---

## Endpoint admin — récupérer toutes les photos

```
https://VOTRE_PROJET.vercel.app/api/admin/download?token=VOTRE_ADMIN_TOKEN
```

Retourne un JSON avec toutes les URLs. Pour télécharger en masse :

```bash
# Télécharger toutes les photos (Linux/Mac)
cat photos.json | jq -r '.[].url' | xargs -n1 wget -P ./photos-mariage/
```

Ou via [rclone](https://rclone.org/) directement depuis R2 :

```bash
rclone copy r2:marine-mael-photos ./photos-mariage/ --progress
```

---

## Estimation des coûts (Free Tier)

| Service         | Gratuit inclus              | Estimation (~20 000 photos) |
|-----------------|-----------------------------|-----------------------------|
| R2 Stockage     | 10 Go                       | ~20 Go ≈ 0,15 $/mois        |
| R2 Opérations   | 1M GET + 1M PUT             | Gratuit                     |
| Vercel Hobby    | 100 Go bandwidth, fonctions illimitées | Gratuit          |

> **Coût total estimé : ~0,15 €/mois** (uniquement le stockage R2 au-delà de 10 Go).

---

## Déploiements suivants

Chaque `git push` sur `main` déclenche automatiquement un redéploiement Vercel.

---

## Sécurité

- Les clés R2 restent côté serveur (variables Vercel, jamais exposées au navigateur)
- Rate limiting : 50 uploads par IP par heure
- Validation du type MIME + taille max 10 Mo côté API
- Aucun tracking, RGPD friendly
