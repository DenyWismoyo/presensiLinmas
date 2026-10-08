import * as admin from 'firebase-admin';
// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = require('../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    admin.initializeApp();
  }
}

// Export all functions
export * from './auth/nikLogin';
export * from './presensi/submitPresensi';
