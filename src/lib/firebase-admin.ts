
// Only import on the server
import 'server-only';

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { config } from 'dotenv';

config();

function initAdmin() {
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    const serviceAccount = JSON.parse(serviceAccountKey);
    return initializeApp({
        credential: cert(serviceAccount),
    });
  } else {
    console.warn('FIREBASE_SERVICE_ACCOUNT_KEY is not set. Firebase dependant features may not work as expected.');
    // Initialize without credentials for environments where they might be implicitly available
    // (like some GCP environments) or when using emulators.
    return initializeApp();
  }
}

const app = getApps()[0] ?? initAdmin();
export const db = getFirestore(app);
export const adminAuth = getAuth(app);
