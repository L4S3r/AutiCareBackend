require('dotenv').config();
const firebaseApp = require('./src/config/firebase');
const { getAuth } = require('firebase-admin/auth');

async function checkUsers() {
  if (!firebaseApp) {
    console.error('Firebase app was not initialized.');
    return;
  }
  try {
    const listUsersResult = await getAuth().listUsers(10);
    console.log(`Successfully fetched ${listUsersResult.users.length} users from Firebase Auth:`);
    listUsersResult.users.forEach((userRecord) => {
      console.log(`- UID: ${userRecord.uid}, Email: ${userRecord.email}, Verified: ${userRecord.emailVerified}, Created: ${userRecord.metadata.creationTime}`);
    });
  } catch (error) {
    console.error('Error listing users from Firebase Auth:', error);
  }
}

checkUsers();
