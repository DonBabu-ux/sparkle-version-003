/**
 * config/firebase-admin.js
 * Server-side Firebase Admin SDK for FCM push + Realtime Database writes.
 * Uses firebase-admin v14 modular API (cert, getApps, applicationDefault).
 * Falls back gracefully if credentials are not configured.
 */

let admin = null;

try {
    const firebaseAdmin = require('firebase-admin');

    const fs = require('fs');
    const path = require('path');
    let serviceAccount = null;

    // 1. Try to load from backend/serviceAccountKey.json
    const localKeyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    if (fs.existsSync(localKeyPath)) {
        serviceAccount = require(localKeyPath);
    }
    // 2. Fallback to .env stringified JSON
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        } catch (e) {
            console.warn('⚠️  Could not parse FIREBASE_SERVICE_ACCOUNT_JSON from .env. Ensure it is valid JSON.');
        }
    }

    // v14 API: use getApps() instead of apps, cert() instead of credential.cert()
    const alreadyInitialized = firebaseAdmin.getApps().length > 0;

    if (serviceAccount && !alreadyInitialized) {
        firebaseAdmin.initializeApp({
            credential: firebaseAdmin.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://sparkleapp-10f62-default-rtdb.firebaseio.com'
        });
        admin = firebaseAdmin;
    } else if (alreadyInitialized) {
        admin = firebaseAdmin;
    } else if (process.env.FIREBASE_DATABASE_URL) {
        // Anonymous / public database (for dev / campus apps without private auth)
        firebaseAdmin.initializeApp({
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });
        admin = firebaseAdmin;
    }

    if (admin) {
        console.log('✅ Firebase Admin initialized (project: ' + (serviceAccount ? serviceAccount.project_id : 'database-only') + ')');
    }
} catch (err) {
    // firebase-admin not installed or credentials invalid – real-time pushes
    // will be silently skipped; MySQL remains the source of truth.
    console.warn('⚠️  Firebase Admin not initialised (optional):', err.message);
}

// firebase-admin v14 removed admin.messaging() / admin.database() namespace methods.
// Export a compat wrapper so existing consumers (fcm.js, Marketplace.js,
// marketplace.controller.js) keep working via admin.messaging() / admin.database().
if (admin) {
    const { getMessaging } = require('firebase-admin/messaging');
    const { getDatabase } = require('firebase-admin/database');

    module.exports = {
        messaging: () => getMessaging(),
        database: () => getDatabase(),
        getApps: () => admin.getApps(),
        initializeApp: (opts) => admin.initializeApp(opts),
        cert: (sa) => admin.cert(sa),
        applicationDefault: () => admin.applicationDefault()
    };
} else {
    module.exports = admin;
}
