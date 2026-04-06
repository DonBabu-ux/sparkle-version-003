/**
 * config/firebase-admin.js
 * Server-side Firebase Admin SDK for Realtime Database writes.
 * Falls back gracefully if credentials are not configured.
 */

let admin = null;

try {
    const firebaseAdmin = require('firebase-admin');

    // Use service account JSON if provided, else fall back to app config
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        if (!firebaseAdmin.apps.length) {
            firebaseAdmin.initializeApp({
                credential: firebaseAdmin.credential.cert(serviceAccount),
                databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://sparkleapp-10f62-default-rtdb.firebaseio.com'
            });
        }
        admin = firebaseAdmin;
    } else if (process.env.FIREBASE_DATABASE_URL) {
        // Anonymous / public database (for dev / campus apps without private auth)
        if (!firebaseAdmin.apps.length) {
            firebaseAdmin.initializeApp({
                databaseURL: process.env.FIREBASE_DATABASE_URL
            });
        }
        admin = firebaseAdmin;
    }
} catch (err) {
    // firebase-admin not installed or credentials missing – real-time pushes
    // will be silently skipped; MySQL remains the source of truth.
    console.warn('⚠️  Firebase Admin not initialised (optional):', err.message);
}

module.exports = admin;
