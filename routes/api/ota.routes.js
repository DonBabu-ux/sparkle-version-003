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

/**
 * @route GET /api/ota/version
 * @desc Checks if a newer, compatible JS bundle is available on the server
 */
router.get('/version', async (req, res) => {
    try {
        const { apkVersion, jsVersion } = req.query;

        if (!apkVersion || !jsVersion) {
            return res.status(400).json({
                success: false,
                error: 'Missing apkVersion or jsVersion query parameters'
            });
        }

        // Query the latest deployed version matching minimum compatibility
        const [rows] = await pool.query(
            'SELECT version, min_apk_version, bundle_url, bundle_hash, signature, is_mandatory, changelog FROM sparkle_ota_versions ORDER BY id DESC LIMIT 1'
        );

        if (rows.length === 0) {
            return res.json({
                success: true,
                updateAvailable: false
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
                changelog: latestOta.changelog
            });
        }

        return res.json({
            success: true,
            updateAvailable: false
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
        
        // Simple token safety
        const expectedToken = process.env.OTA_DEPLOY_TOKEN || 'sparkle_ota_super_secret_deployment_2026';
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
