// workers/mediaWorker.js
const { Worker } = require('bullmq');
const redisClient = require('../config/redis');
const cloudinary = require('cloudinary').v2;
const pool = require('../config/database');

// Offloaded Media Processing Worker
// Handles async image compression, thumbnail generation, and DB updates to keep API routes fast
const mediaWorker = new Worker('media-queue', async job => {
    const { fileBuffer, type, userId, metadata } = job.data;
    console.log(`[MediaWorker] Processing job ${job.id} of type ${type}`);

    if (type === 'avatar_compression') {
        // Example: Handle background avatar upload
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: 'sparkle_avatars', transformation: [{ width: 500, height: 500, crop: 'limit' }] },
                async (error, result) => {
                    if (error) return reject(error);
                    
                    // Update DB async
                    try {
                        await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [result.secure_url, userId]);
                        resolve({ url: result.secure_url });
                    } catch (dbErr) {
                        reject(dbErr);
                    }
                }
            );
            stream.end(Buffer.from(fileBuffer));
        });
    }

    if (type === 'moment_video') {
         // Video processing logic
    }
}, { connection: redisClient });

mediaWorker.on('completed', job => {
    console.log(`[MediaWorker] Job ${job.id} completed successfully`);
});

mediaWorker.on('failed', (job, err) => {
    console.error(`[MediaWorker] Job ${job.id} failed:`, err);
});

module.exports = mediaWorker;
