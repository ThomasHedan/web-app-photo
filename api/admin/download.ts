import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, ListObjectsV2Command, type _Object } from '@aws-sdk/client-s3';

const BUCKET_NAME = 'marine-mael-photos';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const token = req.query.token;
  if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Accès non autorisé' });
  }

  /* Parcourir toutes les pages du bucket */
  const s3     = getS3();
  const all: _Object[] = [];
  let cursor: string | undefined;

  do {
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME, MaxKeys: 1000, ContinuationToken: cursor,
    }));
    all.push(...(result.Contents ?? []));
    cursor = result.NextContinuationToken;
  } while (cursor);

  const photos = all
    .filter((obj) => obj.Key && obj.LastModified)
    .sort((a, b) => b.LastModified!.getTime() - a.LastModified!.getTime())
    .map((obj) => ({
      key:        obj.Key,
      url:        `${process.env.PUBLIC_BASE_URL}/${obj.Key}`,
      uploadedAt: obj.LastModified!.toISOString(),
      sizeBytes:  obj.Size ?? 0,
    }));

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="marine-mael-photos-${date}.json"`);
  return res.status(200).json(photos);
}
