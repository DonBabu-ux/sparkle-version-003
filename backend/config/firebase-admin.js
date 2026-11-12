/**
 * config/firebase-admin.js
 * Server-side Firebase Admin SDK for FCM push + Realtime Database writes.
 * Uses firebase-admin v14 modular API (cert, getApps, applicationDefault).
 * Falls back gracefully if credentials are not configured.
 */

let admin = null;

try {
    const firebaseAdmin = require('firebase-admin');
    const logger = require('../utils/logger');

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
    // The RTDB URL used to fall back to a hardcoded
    // 'https://sparkleapp-10f62-default-rtdb.firebaseio.com' when the env var was
    // unset. That made a misconfigured deploy fail quietly instead of loudly:
    // FCM push would work against whatever project the credentials belong to,
    // while RTDB wrote to a different project it had no permission on, so order
    // status sync silently broke with nothing in the config to point at.
    //
    // When the env var is absent the URL is now derived from the service
    // account's own project_id, so the database always belongs to the project
    // the credentials authenticate against. No project id is hardcoded here.
    const derivedDatabaseUrl = serviceAccount.project_id
        ? `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
        : null;
    const databaseURL = process.env.FIREBASE_DATABASE_URL || derivedDatabaseUrl;

    if (!databaseURL) {
        logger.warn('[firebase-admin] FIREBASE_DATABASE_URL is unset and the service account has no project_id; RTDB is disabled.');
    }

    firebaseAdmin.initializeApp({
        credential: firebaseAdmin.cert(serviceAccount),
        ...(databaseURL ? { databaseURL } : {})
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
