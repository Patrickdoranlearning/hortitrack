import { initializeApp, getApps, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    // Uses Application Default Credentials in hosting/CI. No secrets in code.
    credential: applicationDefault(),
  });
}

export const firebaseAdminAuth = getAuth();
