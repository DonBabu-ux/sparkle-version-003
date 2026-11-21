/**
 * Telegram Bot Administration and Media Ingestion Service
 * Handles admin alerts, migration monitoring commands, and optional media ingestion.
 * NOTE: Telegram is used strictly for management and transfer — never as permanent CDN storage.
 */
const https = require('https');
const pool = require('../config/database');
const storageManager = require('./storage/StorageManager');
const logger = require('../utils/logger');

class TelegramBotService {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN || '';
        this.adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || '';
    }

    /**
     * Send a markdown alert or notification to the admin chat
     */
    async sendAdminAlert(message) {
        if (!this.token || !this.adminChatId) {
            logger.info(`[TelegramBot] No token/chatId configured. Alert skipped: ${message}`);
            return false;
        }

        return this.sendMessage(this.adminChatId, message, { parse_mode: 'Markdown' });
    }

    /**
     * Send message via Telegram Bot API
     */
    async sendMessage(chatId, text, options = {}) {
        if (!this.token) return false;

        const payload = JSON.stringify({
            chat_id: chatId,
            text,
            ...options
        });

        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.telegram.org',
                path: `/bot${this.token}/sendMessage`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        resolve(json.ok ? json.result : false);
                    } catch (e) {
                        resolve(false);
                    }
                });
            });

            req.on('error', (err) => {
                logger.error('[TelegramBot] sendMessage error:', err.message);
                resolve(false);
            });

            req.write(payload);
            req.end();
        });
    }

    /**
     * Get aggregate media status for /media_status command
     */
    async getMediaStatus() {
        const health = await storageManager.healthCheckAll();
        const [counts] = await pool.query(
            'SELECT storage_provider, count(*) as count FROM media_registry GROUP BY storage_provider'
        );

        let msg = `*Sparkle Media Infrastructure Status*\n\n`;
        msg += `*Storage Providers:*\n`;
        msg += `• Cloudflare R2: ${health.r2?.ok ? '✅ Online' : '❌ Offline'}\n`;
        msg += `• Backblaze B2: ${health.b2?.ok ? '✅ Online' : '⚠️ ' + (health.b2?.error || 'Unconfigured')}\n`;
        msg += `• Cloudinary: ${health.cloudinary?.ok ? '✅ Online' : '⚠️ Offline'}\n\n`;

        msg += `*Media Registry Distribution:*\n`;
        for (const c of counts) {
            msg += `• ${c.storage_provider}: ${c.count} assets\n`;
        }

        return msg;
    }

    /**
     * Get migration status for /migration_status command
     */
    async getMigrationStatus() {
        const [stats] = await pool.query(`
            SELECT 
                migration_status, 
                count(*) as count,
                COALESCE(SUM(file_size_bytes), 0) as total_bytes
            FROM media_registry 
            GROUP BY migration_status
        `);

        let msg = `*Sparkle Media Migration Status*\n\n`;
        let total = 0;
        let totalBytes = 0;

        for (const s of stats) {
            total += s.count;
            totalBytes += Number(s.total_bytes);
            const mb = (Number(s.total_bytes) / (1024 * 1024)).toFixed(2);
            msg += `• *${s.migration_status}*: ${s.count} items (${mb} MB)\n`;
        }

        const totalMb = (totalBytes / (1024 * 1024)).toFixed(2);
        msg += `\n*Total Assets*: ${total} (${totalMb} MB)`;
        return msg;
    }

    /**
     * Get failed migrations list for /failed_migrations command
     */
    async getFailedMigrations(limit = 10) {
        const [rows] = await pool.query(
            `SELECT media_id, cloudinary_public_id, migration_error, updated_at 
             FROM media_registry 
             WHERE migration_status = 'failed' 
             ORDER BY updated_at DESC LIMIT ?`,
            [limit]
        );

        if (rows.length === 0) {
            return `*No failed media migrations found.* All records clean.`;
        }

        let msg = `*Failed Media Migrations (Last ${rows.length}):*\n\n`;
        for (const r of rows) {
            msg += `• ID: \`${r.media_id}\`\n  PublicId: \`${r.cloudinary_public_id}\`\n  Error: ${r.migration_error || 'Unknown'}\n\n`;
        }
        return msg;
    }

    /**
     * Process incoming Telegram webhook/update command
     */
    async handleCommand(text, chatId) {
        const cmd = text.trim().split(' ')[0].toLowerCase();
        let reply = '';

        switch (cmd) {
            case '/media_status':
                reply = await this.getMediaStatus();
                break;
            case '/migration_status':
            case '/migration_report':
                reply = await this.getMigrationStatus();
                break;
            case '/failed_migrations':
                reply = await this.getFailedMigrations();
                break;
            case '/storage_usage':
                reply = await this.getMediaStatus();
                break;
            default:
                reply = `*Sparkle Media Bot Commands:*\n/media_status - Storage health & counts\n/migration_status - Migration progress\n/failed_migrations - View failed assets\n/storage_usage - Current usage summary`;
        }

        await this.sendMessage(chatId, reply, { parse_mode: 'Markdown' });
    }

    /**
     * Ingest media from Telegram into Cloudflare R2
     * Downloads file from Telegram and uploads it directly to R2.
     */
    async ingestMediaFromTelegram(fileId, { category = 'general', ownerId, mediaService }) {
        if (!this.token) {
            throw new Error('Telegram bot token not configured');
        }

        // 1. Get file path from Telegram
        const fileInfo = await new Promise((resolve, reject) => {
            https.get(`https://api.telegram.org/bot${this.token}/getFile?file_id=${fileId}`, (res) => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    const json = JSON.parse(data);
                    if (json.ok) resolve(json.result);
                    else reject(new Error(json.description || 'Failed to get file info'));
                });
            }).on('error', reject);
        });

        const downloadUrl = `https://api.telegram.org/file/bot${this.token}/${fileInfo.file_path}`;
        const ext = (fileInfo.file_path.split('.').pop() || 'bin').toLowerCase();

        // 2. Stream into Buffer
        const buffer = await new Promise((resolve, reject) => {
            https.get(downloadUrl, (res) => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Failed to download telegram file: ${res.statusCode}`));
                }
                const chunks = [];
                res.on('data', c => chunks.push(c));
                res.on('end', () => resolve(Buffer.concat(chunks)));
            }).on('error', reject);
        });

        // 3. Upload to Cloudflare R2
        const uploadResult = await storageManager.uploadActiveMedia({
            body: buffer,
            category,
            ext,
            ownerId
        });

        // 4. Register in media_registry if mediaService provided
        if (mediaService) {
            const mediaId = await mediaService.registerMedia({
                ownerId,
                category,
                storageProvider: 'r2',
                objectKey: uploadResult.key,
                bucketName: uploadResult.bucket,
                secureUrl: uploadResult.publicUrl,
                fileSizeBytes: buffer.length,
                hashChecksum: uploadResult.sha256
            });
            return { mediaId, ...uploadResult };
        }

        return uploadResult;
    }
}

module.exports = new TelegramBotService();
