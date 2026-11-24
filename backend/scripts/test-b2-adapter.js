'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { S3Client, ListBucketsCommand, HeadBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

const KEY_ID = process.env.B2_APPLICATION_KEY_ID;
const APP_KEY = process.env.B2_APPLICATION_KEY;
const BUCKET = process.env.B2_BUCKET_NAME;
const ENDPOINT = process.env.B2_ENDPOINT;

console.log('=== Backblaze B2 Health Check ===');
console.log('Key ID :', KEY_ID);
console.log('App Key:', APP_KEY ? `${APP_KEY.slice(0, 6)}... (len ${APP_KEY.length})` : 'MISSING');
console.log('Bucket :', BUCKET);
console.log('Endpoint:', ENDPOINT);
console.log('');

const client = new S3Client({
  region: 'us-west-004',
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: KEY_ID,
    secretAccessKey: APP_KEY,
  },
  forcePathStyle: true,
});

(async () => {
  // 1. List buckets
  try {
    const r = await client.send(new ListBucketsCommand({}));
    console.log('[PASS] ListBuckets — found:', r.Buckets.map(b => b.Name).join(', ') || '(none)');
  } catch (e) {
    const meta = e.$metadata || {};
    console.error('[FAIL] ListBuckets —', e.name, 'HTTP', meta.httpStatusCode, ':', e.message);
  }

  // 2. Head bucket
  try {
    await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    console.log('[PASS] HeadBucket —', BUCKET, 'exists');
  } catch (e) {
    const meta = e.$metadata || {};
    console.error('[FAIL] HeadBucket —', e.name, 'HTTP', meta.httpStatusCode, ':', e.message);
  }

  // 3. Upload a test object
  const testKey = `health-check/test-${Date.now()}.txt`;
  const testBody = `Sparkle B2 health check at ${new Date().toISOString()}`;
  try {
    await client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: testKey,
      Body: testBody,
      ContentType: 'text/plain',
    }));
    console.log('[PASS] PutObject —', testKey);
  } catch (e) {
    const meta = e.$metadata || {};
    console.error('[FAIL] PutObject —', e.name, 'HTTP', meta.httpStatusCode, ':', e.message);
    return;
  }

  // 4. Get object back
  try {
    const r = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: testKey }));
    const chunks = [];
    for await (const chunk of r.Body) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    if (body === testBody) {
      console.log('[PASS] GetObject — content verified');
    } else {
      console.error('[FAIL] GetObject — content mismatch');
    }
  } catch (e) {
    const meta = e.$metadata || {};
    console.error('[FAIL] GetObject —', e.name, 'HTTP', meta.httpStatusCode, ':', e.message);
  }

  // 5. Delete test object
  try {
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: testKey }));
    console.log('[PASS] DeleteObject — test file cleaned up');
  } catch (e) {
    console.error('[WARN] DeleteObject —', e.message);
  }

  console.log('\n=== B2 health check complete ===');
})();
