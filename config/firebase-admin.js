/**
 * config/firebase-admin.js
 * Server-side Firebase Admin SDK for Realtime Database writes.
 * Falls back gracefully if credentials are not configured.
 */

let admin = null;

try {
    const firebaseAdmin = require('firebase-admin');

    const fs = require('fs');
    const path = require('path');
    let serviceAccount = null;

    // 1. Try to load from serviceAccountKey.json
    const localKeyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
    if (fs.existsSync(localKeyPath)) {
        serviceAccount = require(localKeyPath);
    } 
    // 2. Fallback to .env stringified JSON (if properly formatted)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        } catch (e) {
            console.warn('⚠️  Could not parse FIREBASE_SERVICE_ACCOUNT_JSON from .env. Ensure it is valid JSON and not just "{...}".');
        }
    }

    if (serviceAccount) {
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
