const admin = require('firebase-admin');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

if (projectId && clientEmail && privateKey) {
  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('🔥 Firebase Admin SDK initialized successfully.');
    }
  } catch (err) {
    console.error('⚠️ Failed to initialize Firebase Admin SDK:', err.message);
  }
} else {
  console.warn('⚠️ Missing Firebase Admin environment variables. Firebase auth verification will fail if used.');
}

module.exports = admin;
