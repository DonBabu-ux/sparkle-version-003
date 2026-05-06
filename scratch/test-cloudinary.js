require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function testCloudinary() {
    try {
        console.log("Testing Cloudinary credentials...");
        const result = await cloudinary.uploader.upload('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', {
            folder: 'sparkle_test'
        });
        console.log("Cloudinary Upload Success:", result.secure_url);
    } catch (err) {
        console.error("Cloudinary Error:", err);
    }
}

testCloudinary();
