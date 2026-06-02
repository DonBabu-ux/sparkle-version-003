const admin = require('firebase-admin');

if (!process.env.FIREBASE_SA_BASE64) {
  console.error('FIREBASE_SA_BASE64 environment variable not set.');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SA_BASE64, 'base64').toString('utf8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
