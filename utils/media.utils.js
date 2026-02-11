const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

/**
 * Downloads an external image and saves it to local storage.
 * @param {string} url - The external image URL.
 * @param {string} folder - The subfolder in public/uploads (e.g., 'avatars').
 * @returns {Promise<string>} - The local path to the file (starting with /uploads/).
 */
async function downloadExternalImage(url, folder = 'avatars') {
    if (!url || !url.startsWith('http')) return url;

    // Skip if already local
    if (url.startsWith('/uploads/') || url.includes(process.env.APP_URL || '')) {
        return url;
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            throw new Error('URL did not return an image');
        }

        const extension = contentType.split('/')[1] || 'jpg';
        const filename = `${uuidv4()}.${extension}`;
        const relativePath = `uploads/${folder}/${filename}`;
        const absolutePath = path.join(__dirname, '..', 'public', relativePath);

        // Ensure directory exists
        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const buffer = await response.buffer();
        fs.writeFileSync(absolutePath, buffer);

        logger.info(`Successfully downloaded external image to ${relativePath}`);
        return `/${relativePath}`;
    } catch (error) {
        logger.error(`Error downloading external image (${url}):`, error.message);
        // Return original URL or a default if it failed, so the UI still has something to try
        return url;
    }
}

module.exports = {
    downloadExternalImage
};
