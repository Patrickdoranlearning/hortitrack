
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    // Attempt to initialize with application default credentials,
    // which works in many cloud environments (like Cloud Run, Cloud Functions).
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  } catch (e) {
    // If the above fails, it might be because the environment variables
    // for a service account are not set. This is a fallback for local dev
    // or environments where you explicitly set the service account JSON.
    // Ensure you have a service account key file and the GOOGLE_APPLICATION_CREDENTIALS
    // environment variable is set to its path.
    console.error('Firebase admin initialization error with default credentials. Ensure GOOGLE_APPLICATION_CREDENTIALS is set for local development.', e);
    // You might need a more specific fallback here depending on your setup
    // For example, directly using a service account object if not using the env var.
  }
}

export const auth = admin.auth();
export const firestore = admin.firestore();
