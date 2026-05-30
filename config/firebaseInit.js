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

    if (serviceAccount) {
      const requiredFields = [
        "project_id",
        "private_key",
        "client_email"
      ];
      for (const field of requiredFields) {
        if (!serviceAccount[field]) {
          throw new Error(`Missing Firebase field: ${field}`);
        }
      }
    }

    const credential = serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault();

    admin.initializeApp({ credential });
    logger.info('✅ Firebase Admin SDK initialized');
    return admin.app();
  } catch (err) {
    logger.error('❌ Firebase Admin initialization failed:', err.message);
    throw err; // Do not allow Sparkle to start with broken Firebase credentials
  }
}

module.exports = { initializeFirebaseAdmin };
