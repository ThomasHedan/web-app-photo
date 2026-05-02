import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const BUCKET_NAME = 'marine-mael-photos';
const RATE_LIMIT_MAX = 50;

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/heic', 'image/heif', 'image/avif',
]);

/* Rate limiting en mémoire — simple et suffisant pour un mariage (~200 invités) */
const ipCounts = new Map<string, { n: number; hour: number }>();

function getS3(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function sanitize(filename: string): string {
  const dot  = filename.lastIndexOf('.');
  const ext  = dot > 0 ? filename.slice(dot).toLowerCase() : '';
  const base = filename.slice(0, dot > 0 ? dot : undefined);
  return base.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/-{2,}/g, '-').slice(0, 80) + ext;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Méthode non autorisée' });

  /* Rate limiting par IP */
  const ip   = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? 'unknown';
  const hour = Math.floor(Date.now() / 3_600_000);
  const entry = ipCounts.get(ip) ?? { n: 0, hour };
  if (entry.hour !== hour) { entry.n = 0; entry.hour = hour; }
  entry.n++;
  ipCounts.set(ip, entry);
  if (entry.n > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Trop de requêtes — réessayez dans une heure.' });
  }

  const { filename, contentType } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof filename !== 'string' || !filename.trim()) {
    return res.status(400).json({ error: 'filename manquant ou invalide' });
  }
  if (typeof contentType !== 'string' || !ALLOWED_TYPES.has(contentType)) {
    return res.status(400).json({ error: 'Type de fichier non autorisé. Seules les images sont acceptées.' });
  }

  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitize(filename)}`;

  const uploadUrl = await getSignedUrl(
    getS3(),
    new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  );

  return res.status(200).json({
    uploadUrl,
    publicUrl: `${process.env.PUBLIC_BASE_URL}/${key}`,
    key,
  });
}
