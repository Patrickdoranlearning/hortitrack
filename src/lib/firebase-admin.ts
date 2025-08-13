// src/lib/firebase-admin.ts
import 'server-only';

import { getApps, initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function initAdminApp() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

  // Prefer explicit service-account env vars
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return initializeApp({
      credential: cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      projectId: FIREBASE_PROJECT_ID,
    });
  }

  // Fallback to ADC (Cloud Workstations / gcloud login / GOOGLE_APPLICATION_CREDENTIALS)
  return initializeApp({
    credential: applicationDefault(),
    // If FIREBASE_PROJECT_ID is set, this helps some dev setups
    projectId: FIREBASE_PROJECT_ID,
  });
}

const app = getApps()[0] ?? initAdminApp();
export const db = getFirestore(app);
export const adminAuth = getAuth(app);
export { FieldValue };

    