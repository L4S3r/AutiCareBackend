const { initializeApp, getApps, cert } = require('firebase-admin/app');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');
}

let firebaseApp = null;

if (projectId && clientEmail && privateKey) {
  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('🔥 Firebase Admin SDK initialized successfully.');
    } else {
      firebaseApp = getApps()[0];
    }
  } catch (err) {
    console.error('⚠️ Failed to initialize Firebase Admin SDK:', err.message);
  }
} else {
  console.warn('⚠️ Missing Firebase Admin environment variables. Firebase auth verification will fail if used.');
}

module.exports = firebaseApp;

