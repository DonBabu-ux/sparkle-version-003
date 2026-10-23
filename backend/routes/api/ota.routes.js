const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const logger = require('../../utils/logger');

// Semver strict comparator helper
function compareSemver(v1, v2) {
    const parts1 = String(v1).split('.').map(Number);
    const parts2 = String(v2).split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const val1 = parts1[i] || 0;
        const val2 = parts2[i] || 0;
        if (val1 > val2) return 1;
        if (val1 < val2) return -1;
    }
    return 0;
}

const CANONICAL_RELEASE_META = {
    latestApkVersion: '1.0.2',
    latestVersionCode: 3,
    minApkVersion: '1.0.0',
    otaAppId: 'eccc57fa-7ba0-47ee-951f-688f6516afd1',
    channel: 'base',
    apkDownloadUrl: 'https://github.com/DonBabu-ux/sparkle-version-003/releases/download/latest/sparkle.apk',
    releaseNotesUrl: 'https://github.com/DonBabu-ux/sparkle-version-003/releases/tag/latest',
    changelog: 'Sparkle Rolling Release — all future updates arrive automatically over the air (OtaKit).',
    publishedAt: '2026-10-13T17:22:09Z'
};

/**
 * @route GET /api/ota/info
 * @desc Returns current authoritative release metadata for clients & settings UI
 */
router.get('/info', async (req, res) => {
    try {
        let dbOta = null;
        try {
            const [rows] = await pool.query(
                'SELECT version, min_apk_version, bundle_url, bundle_hash, is_mandatory, changelog, created_at FROM sparkle_ota_versions ORDER BY id DESC LIMIT 1'
            );
            if (rows && rows.length > 0) dbOta = rows[0];
        } catch (dbErr) {
            logger.warn('⚠️ Could not query sparkle_ota_versions for /info, using canonical release metadata:', dbErr.message);
        }

        const latestVersion = dbOta?.version || CANONICAL_RELEASE_META.latestApkVersion;
        const minApk = dbOta?.min_apk_version || CANONICAL_RELEASE_META.minApkVersion;
        const changelog = dbOta?.changelog || CANONICAL_RELEASE_META.changelog;

        return res.json({
            success: true,
            latestPublishedVersion: latestVersion,
            latestApkVersion: CANONICAL_RELEASE_META.latestApkVersion,
            latestVersionCode: CANONICAL_RELEASE_META.latestVersionCode,
            minApkVersion: minApk,
            otaAppId: CANONICAL_RELEASE_META.otaAppId,
            channel: req.query.channel || CANONICAL_RELEASE_META.channel,
            apkDownloadUrl: CANONICAL_RELEASE_META.apkDownloadUrl,
            releaseNotesUrl: CANONICAL_RELEASE_META.releaseNotesUrl,
            changelog,
            bundleUrl: dbOta?.bundle_url || null,
            mandatory: dbOta?.is_mandatory === 1,
            publishedAt: dbOta?.created_at || CANONICAL_RELEASE_META.publishedAt
        });
    } catch (err) {
        logger.error('❌ Error in /api/ota/info handler:', err);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
});

/**
 * @route GET /api/ota/version
 * @desc Checks if a newer, compatible JS bundle is available on the server.
 *       When query parameters are absent, returns authoritative release information.
 */
router.get('/version', async (req, res) => {
    try {
        const { apkVersion, jsVersion, channel } = req.query;

        // If client does not pass apkVersion/jsVersion, serve general release info
        if (!apkVersion || !jsVersion) {
            return res.json({
                success: true,
                latestPublishedVersion: CANONICAL_RELEASE_META.latestApkVersion,
                latestApkVersion: CANONICAL_RELEASE_META.latestApkVersion,
                latestVersionCode: CANONICAL_RELEASE_META.latestVersionCode,
                minApkVersion: CANONICAL_RELEASE_META.minApkVersion,
                otaAppId: CANONICAL_RELEASE_META.otaAppId,
                channel: channel || CANONICAL_RELEASE_META.channel,
                apkDownloadUrl: CANONICAL_RELEASE_META.apkDownloadUrl,
                releaseNotesUrl: CANONICAL_RELEASE_META.releaseNotesUrl,
                changelog: CANONICAL_RELEASE_META.changelog
            });
        }

        // Query the latest deployed version matching minimum compatibility
        let rows = [];
        try {
            const [queryRows] = await pool.query(
                'SELECT version, min_apk_version, bundle_url, bundle_hash, signature, is_mandatory, changelog FROM sparkle_ota_versions ORDER BY id DESC LIMIT 1'
            );
            rows = queryRows;
        } catch (dbErr) {
            logger.warn('⚠️ Could not query sparkle_ota_versions for /version:', dbErr.message);
        }

        if (!rows || rows.length === 0) {
            return res.json({
                success: true,
                updateAvailable: false,
                latestPublishedVersion: CANONICAL_RELEASE_META.latestApkVersion,
                latestApkVersion: CANONICAL_RELEASE_META.latestApkVersion,
                apkDownloadUrl: CANONICAL_RELEASE_META.apkDownloadUrl
            });
        }

        const latestOta = rows[0];

        // Validate client APK version satisfies min_apk_version requirement
        const isApkCompatible = compareSemver(apkVersion, latestOta.min_apk_version) >= 0;
        const hasNewerJs = compareSemver(latestOta.version, jsVersion) > 0;

        if (isApkCompatible && hasNewerJs) {
            return res.json({
                success: true,
                updateAvailable: true,
                version: latestOta.version,
                bundleUrl: latestOta.bundle_url,
                hash: latestOta.bundle_hash,
                signature: latestOta.signature,
                mandatory: latestOta.is_mandatory === 1,
                changelog: latestOta.changelog,
                apkDownloadUrl: CANONICAL_RELEASE_META.apkDownloadUrl
            });
        }

        return res.json({
            success: true,
            updateAvailable: false,
            latestPublishedVersion: latestOta.version,
            apkDownloadUrl: CANONICAL_RELEASE_META.apkDownloadUrl
        });
    } catch (err) {
        logger.error('❌ Error in /api/ota/version handler:', err);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
});

/**
 * @route POST /api/ota/deploy-ota
 * @desc Registers a new React Native JS bundle release (used by deployment CLI/workflows)
 */
router.post('/deploy-ota', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        
        // Fail closed: deployment is only possible when OTA_DEPLOY_TOKEN is
        // configured. Never fall back to a hardcoded secret.
        const expectedToken = process.env.OTA_DEPLOY_TOKEN;
        if (!expectedToken) {
            logger.error('OTA deploy rejected: OTA_DEPLOY_TOKEN is not configured on this server');
            return res.status(503).json({
                success: false,
                error: 'OTA deployment is disabled: server missing OTA_DEPLOY_TOKEN'
            });
        }
        if (!token || token !== expectedToken) {
            return res.status(401).json({
                success: false,
                error: 'Unauthorized deployment request'
            });
        }

        const {
            version,
            minApkVersion,
            bundleUrl,
            hash,
            signature,
            isMandatory = false,
            changelog = ''
        } = req.body;

        if (!version || !minApkVersion || !bundleUrl || !hash || !signature) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters: version, minApkVersion, bundleUrl, hash, signature'
            });
        }

        // Insert or update version meta in DB
        await pool.query(
            `INSERT INTO sparkle_ota_versions 
            (version, min_apk_version, bundle_url, bundle_hash, signature, is_mandatory, changelog) 
            VALUES (?, ?, ?, ?, ?, ?, ?) 
            ON DUPLICATE KEY UPDATE 
            min_apk_version = VALUES(min_apk_version), 
            bundle_url = VALUES(bundle_url), 
            bundle_hash = VALUES(bundle_hash), 
            signature = VALUES(signature), 
            is_mandatory = VALUES(is_mandatory), 
            changelog = VALUES(changelog)`,
            [version, minApkVersion, bundleUrl, hash, signature, isMandatory ? 1 : 0, changelog]
        );

        logger.info(`🎉 Deployed Sparkle OTA Bundle v${version} successfully.`);
        return res.json({
            success: true,
            message: `Sparkle OTA Bundle v${version} successfully registered in database.`
        });
    } catch (err) {
        logger.error('❌ Error in /api/ota/deploy-ota handler:', err);
        return res.status(500).json({
            success: false,
            error: 'Internal Server Error'
        });
    }
});

module.exports = router;
