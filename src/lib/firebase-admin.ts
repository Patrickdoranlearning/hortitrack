// Only import on the server
import 'server-only';

import { getApps, initializeApp, cert, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function initAdmin() {
  // This function is not meant to be used in production.
  // In production, the service account key should be set as an environment variable.
  // The Firebase Admin SDK will automatically pick it up.
  // This is for local development only.

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey);
      return initializeApp({
          credential: cert(serviceAccount),
      });
    } catch (error) {
        console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_KEY. Make sure it is a valid JSON string.', error);
        // Fallback to default initialization if parsing fails
    }
  }
  
  console.warn('FIREBASE_SERVICE_ACCOUNT_KEY is not set. Attempting to initialize with default credentials.');
  // Initialize without credentials for environments where they might be implicitly available
  // (like some GCP environments) or when using emulators.
  return initializeApp();
}


const app = getApps().length ? getApp() : initAdmin();
export const db = getFirestore(app);
export const adminAuth = getAuth(app);
