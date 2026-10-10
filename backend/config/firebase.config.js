// config/firebase.config.js
// Web Firebase config handed to clients (res.locals.firebaseConfig).
// ALL values come from environment variables — never hardcode keys here.
// Fill them in backend/.env (see .env.example) or your Bitwarden vault.
const firebaseConfig = {
    apiKey: process.env.FIREBASE_WEB_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    databaseURL: process.env.FIREBASE_DATABASE_URL || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || ''
};

module.exports = firebaseConfig;
