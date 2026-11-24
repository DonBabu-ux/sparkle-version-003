const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const crypto = require('crypto');
const CloudflareR2Adapter = require('../services/storage/CloudflareR2Adapter');

async function testR2() {
    console.log('====================================================');
    console.log('CLOUDFLARE R2 ADAPTER INTEGRATION TEST');
    console.log('====================================================');

    const r2 = new CloudflareR2Adapter();
    console.log(`[Config] Bucket: ${r2.bucket}`);
    console.log(`[Config] Account ID: ${r2.accountId}`);
    console.log(`[Config] Public Domain: ${r2.publicDomain || '(not set, using direct endpoint)'}`);

    // Step 1: Health check
    console.log('\n[Step 1] Running healthCheck()...');
    const health = await r2.healthCheck();
    console.log('Health check result:', health);
    if (!health.ok) {
        throw new Error(`Health check failed: ${health.error}`);
    }

    // Step 2: Upload test buffer
    const testKey = `test/integration-test-${Date.now()}.txt`;
    const testContent = Buffer.from(`Sparkle Cloudflare R2 Verification ${new Date().toISOString()}`, 'utf8');
    const expectedSha256 = crypto.createHash('sha256').update(testContent).digest('hex');

    console.log(`\n[Step 2] Uploading test object to key: ${testKey}`);
    const uploadRes = await r2.uploadObject({
        key: testKey,
        body: testContent,
        contentType: 'text/plain',
        metadata: {
            'test-runner': 'sparkle-agent',
            'created-at': new Date().toISOString()
        }
    });
    console.log('Upload response:', uploadRes);
    if (uploadRes.sha256 !== expectedSha256) {
        throw new Error(`Upload SHA-256 mismatch! Expected ${expectedSha256}, got ${uploadRes.sha256}`);
    }

    // Step 3: Head object
    console.log('\n[Step 3] Verifying object exists with headObject()...');
    const head = await r2.headObject({ key: testKey });
    console.log('Head response:', head);
    if (!head.exists || head.contentLength !== testContent.length) {
        throw new Error('headObject verification failed!');
    }

    // Step 4: Download and verify content
    console.log('\n[Step 4] Downloading object with downloadObject()...');
    const download = await r2.downloadObject({ key: testKey });
    const chunks = [];
    for await (const chunk of download.stream) {
        chunks.push(chunk);
    }
    const downloadedBuffer = Buffer.concat(chunks);
    const downloadedSha256 = crypto.createHash('sha256').update(downloadedBuffer).digest('hex');
    console.log(`Downloaded ${downloadedBuffer.length} bytes, SHA-256: ${downloadedSha256}`);
    if (downloadedSha256 !== expectedSha256) {
        throw new Error('Downloaded content SHA-256 mismatch!');
    }

    // Step 5: Presigned URLs
    console.log('\n[Step 5] Generating presigned URLs...');
    const signedDownload = await r2.getSignedDownloadUrl({ key: testKey, expiresInSeconds: 600 });
    console.log('Signed download URL:', signedDownload.slice(0, 100) + '...');

    const signedUpload = await r2.getSignedUploadUrl({ 
        key: `test/presigned-${Date.now()}.txt`, 
        contentType: 'text/plain', 
        expiresInSeconds: 600 
    });
    console.log('Signed upload URL:', signedUpload.uploadUrl.slice(0, 100) + '...');

    // Step 6: Delete object
    console.log('\n[Step 6] Deleting test object with deleteObject()...');
    const deleteRes = await r2.deleteObject({ key: testKey });
    console.log('Delete response:', deleteRes);

    // Step 7: Verify deletion
    console.log('\n[Step 7] Confirming deletion with headObject()...');
    const headAfterDelete = await r2.headObject({ key: testKey });
    console.log('Head after delete (exists should be false):', headAfterDelete.exists);
    if (headAfterDelete.exists) {
        throw new Error('Object still exists after deletion!');
    }

    console.log('\n====================================================');
    console.log('ALL CLOUDFLARE R2 ADAPTER TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================\n');
}

testR2()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\nTEST FAILED:', err);
        process.exit(1);
    });
