import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Initialize app once
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.GCS_BUCKET,
  });
}

const app = getApps()[0]!;
export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);

/**
 * Get a Storage bucket by name. Never assumes a default bucket.
 * Reads (in order): app.options.storageBucket, FIREBASE_STORAGE_BUCKET, GCS_BUCKET.
 */
export function getGcsBucket() {
  const byOptions = (app?.options?.storageBucket as string | undefined)?.trim();
  const byEnv = (process.env.FIREBASE_STORAGE_BUCKET || process.env.GCS_BUCKET || "").trim();
  const name = byOptions || byEnv;
  if (!name) {
    const msg =
      "Storage bucket is not configured. Set app.options.storageBucket or FIREBASE_STORAGE_BUCKET/GCS_BUCKET via your secrets manager.";
    const err = new Error(msg);
    // Tag for easier detection upstream
    (err as any).code = "STORAGE_BUCKET_MISSING";
    throw err;
  }
  return getStorage(app).bucket(name);
}
