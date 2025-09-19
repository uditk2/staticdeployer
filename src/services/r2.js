import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { config } from '../config/env.js';
import { contentTypeFor } from '../utils/mime.js';

function makeClient() {
  const endpoint = `https://${config.r2.accountId}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: config.r2.region,
    endpoint,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  });
}

export async function uploadFile({ tenant, version, rootDir, absPath, keyPrefix = 'sites' }) {
  const client = makeClient();
  const rel = path.relative(rootDir, absPath).split(path.sep).join('/');
  const objectKey = `${keyPrefix}/${tenant}/${version}/${rel}`;
  const ContentType = contentTypeFor(rel);
  const isHtml = ContentType.startsWith('text/html');
  const CacheControl = isHtml ? 'public, max-age=60, s-maxage=60' : 'public, max-age=31536000, immutable';

  const stream = createReadStream(absPath);
  const res = await client.send(new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: objectKey,
    Body: stream,
    ContentType,
    CacheControl,
  }));
  return { key: objectKey, etag: res.ETag };
}

export async function objectExists(key) {
  const client = makeClient();
  try {
    await client.send(new HeadObjectCommand({ Bucket: config.r2.bucket, Key: key }));
    return true;
  } catch (err) {
    if (err?.$metadata?.httpStatusCode === 404) return false;
    // Some SDKs throw NoSuchKey without 404 code; treat as false
    if (err?.name === 'NotFound' || err?.Code === 'NoSuchKey') return false;
    throw err;
  }
}
