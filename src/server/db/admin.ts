import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";

let app: App;
if (!getApps().length) {
  // Use cert from environment variables, not applicationDefault
  const credential = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };

  // Check if all credential parts are present before initializing
  if (credential.projectId && credential.clientEmail && credential.privateKey) {
    app = initializeApp({
      credential: cert(credential as any),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
  } else {
    // Attempt to use applicationDefault as a fallback if env vars are missing
    // This is useful in some GCP environments
    try {
        app = initializeApp({
          credential: applicationDefault(),
        });
    } catch (e) {
        console.error("Firebase Admin initialization failed. Credentials missing or incomplete.", e);
        // We might not want to throw an error at import time but let dependent functions fail
        // to avoid crashing the entire server startup.
    }
  }
} else {
  app = getApps()[0]!;
}

// We check if app was initialized before exporting db/storage/auth
// This prevents crashes if credentials aren't set up.
export const adminApp = app;
export const adminDb = app ? getFirestore(app) : null!;
export const adminStorage = app ? getStorage(app) : null!;
export const adminAuth = app ? getAuth(app) : null!;
