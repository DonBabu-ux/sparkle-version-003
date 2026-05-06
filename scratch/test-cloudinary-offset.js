require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const https = require('https');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

https.get('https://api.cloudinary.com', async (res) => {
    let timeOffsetSeconds = 0;
    if (res.headers.date) {
        const apiDate = new Date(res.headers.date);
        timeOffsetSeconds = Math.round((apiDate - new Date()) / 1000);
        console.log(`[Cloudinary] Time offset adjusted by ${timeOffsetSeconds} seconds`);
    }

    try {
        console.log("Testing Cloudinary credentials with offset...");
        const result = await cloudinary.uploader.upload('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', {
            folder: 'sparkle_test',
            timestamp: Math.round(Date.now() / 1000) + timeOffsetSeconds
        });
        console.log("Cloudinary Upload Success:", result.secure_url);
    } catch (err) {
        console.error("Cloudinary Error:", err);
    }
});
