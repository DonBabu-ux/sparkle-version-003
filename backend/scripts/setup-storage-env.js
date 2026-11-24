const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
if (!fs.existsSync(envPath)) {
    console.error('.env not found at', envPath);
    process.exit(1);
}

let content = fs.readFileSync(envPath, 'utf8');

const r2Configs = [
    'R2_ACCOUNT_ID=11f74c46bf0c959946c8076647db4ae1',
    'R2_ACCESS_KEY_ID=b0a606e9f14f953cc71887b99feb5476',
    'R2_SECRET_ACCESS_KEY=07d080d4ecc882ab5b2d776bcd53d594ba6b8609454671f8f5f5bb221df5571a',
    'R2_BUCKET_NAME=sparkle-media',
    'R2_ENDPOINT=https://11f74c46bf0c959946c8076647db4ae1.r2.cloudflarestorage.com',
    'R2_PUBLIC_DOMAIN=',
    'MEDIA_STORAGE_PRIMARY=r2',
    'B2_APPLICATION_KEY_ID=0a453f38c9a7',
    'B2_APPLICATION_KEY=',
    'B2_BUCKET_NAME=sparkle-media-archive',
    'B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com',
    'B2_PUBLIC_DOMAIN='
];

let added = 0;
for (const line of r2Configs) {
    const key = line.split('=')[0];
    if (!content.includes(key + '=')) {
        content += '\n' + line;
        added++;
    }
}

if (added > 0) {
    fs.writeFileSync(envPath, content);
    console.log(`Added ${added} storage configuration variables to backend/.env`);
} else {
    console.log('Storage configuration variables already present');
}
