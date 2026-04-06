const fs = require('fs');
const path = require('path');
const imagesDir = path.join(__dirname, '..', 'public', 'images');

if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}

function createFallbackPlaceholder(filename) {
    fs.writeFileSync(path.join(imagesDir, filename), '');
    console.log(`Created empty fallback ${filename}`);
}

try {
    const { createCanvas } = require('canvas');

    function createPlaceholder(filename, text, bgColor, textColor) {
        const canvas = createCanvas(800, 600);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 800, 600);

        // Text
        ctx.fillStyle = textColor;
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 400, 300);

        const buffer = canvas.toBuffer('image/jpeg');
        fs.writeFileSync(path.join(imagesDir, filename), buffer);
        console.log(`Created ${filename}`);
    }

    createPlaceholder('video-placeholder.jpg', 'Video Preview', '#1a1a1a', '#FF3D6D');
    createPlaceholder('default-avatar.jpg', 'Sparkle User', '#FF3D6D', '#ffffff');
} catch (err) {
    console.warn('Canvas not available, creating empty files as fallback.');
    createFallbackPlaceholder('video-placeholder.jpg');
    createFallbackPlaceholder('default-avatar.jpg');
}
