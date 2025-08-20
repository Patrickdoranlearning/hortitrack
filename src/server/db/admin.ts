import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let app: App | undefined;

function required(name: string, v?: string | null) {
  if (!v || String(v).trim() === "") {
    throw new Error(`[firebase-admin] Missing environment variable: ${name}`);
  }
  return String(v);
}

export function getAdminApp(): App {
  if (app) return app;

  // Reuse if already initialized (hot reload/dev)
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  // Read directly from process.env (no "@/env" dependency)
  const projectId = required("FIREBASE_PROJECT_ID", process.env.FIREBASE_PROJECT_ID);
  const clientEmail = required("FIREBASE_CLIENT_EMAIL", process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = required("FIREBASE_PRIVATE_KEY", process.env.FIREBASE_PRIVATE_KEY).replace(/\n/g, "\n");
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || undefined;

  app = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket,
  });
  return app;
}

export const adminDb = getFirestore(getAdminApp());
export const adminStorage = getStorage(getAdminApp());

// New: helper used by photos route
export function getGcsBucket() {
  // Will use the bucket configured in initializeApp({ storageBucket })
  // or fall back to the default for the project if available.
  return adminStorage.bucket();
}