// config/firebaseInit.js
// Initialize Firebase Admin SDK for server-side usage
// Requires GOOGLE_APPLICATION_CREDENTIALS env var or service account JSON object

const admin = require('firebase-admin');
const logger = require('../utils/logger');

function initializeFirebaseAdmin() {
  try {
    if (admin.apps.length) {
      logger.info('Firebase Admin already initialized');
      return admin.app();
    }
    // Attempt to initialize using service account JSON from env or file path
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
      : null;
    const credential = serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault();

    admin.initializeApp({ credential });
    logger.info('✅ Firebase Admin SDK initialized');
    return admin.app();
  } catch (err) {
    logger.error('❌ Firebase Admin initialization failed:', err.message);
    // Fail silently; downstream code should handle missing admin.
    return null;
  }
}

module.exports = { initializeFirebaseAdmin };
