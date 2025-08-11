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

const app = getApps().length ? getApps()[0] : initAdmin();
export const db = getFirestore(app);
export const adminAuth = getAuth(app);
