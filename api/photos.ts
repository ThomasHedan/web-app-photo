import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

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
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') return res.status(405).end();

  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

  const result = await getS3().send(new ListObjectsV2Command({
    Bucket:            BUCKET_NAME,
    MaxKeys:           500,
    ContinuationToken: cursor,
  }));

  const photos = (result.Contents ?? [])
    .filter((obj) => obj.Key && obj.LastModified)
    .map((obj) => ({
      url:        `${process.env.PUBLIC_BASE_URL}/${obj.Key}`,
      key:        obj.Key!,
      uploadedAt: obj.LastModified!.toISOString(),
      size:       obj.Size ?? 0,
    }))
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  return res.status(200).json({
    photos,
    total:      photos.length,
    nextCursor: result.NextContinuationToken ?? null,
  });
}
