import "server-only";
import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { env } from "@/env";

let app: App | undefined;

function ensureApp() {
  if (getApps().length) {
    app = getApps()[0]!;
    return app;
  }
  try {
    app = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      storageBucket: env.FIREBASE_STORAGE_BUCKET || env.GCS_BUCKET,
    });
    return app;
  } catch (e: any) {
    // Fail loudly in dev; in prod you may want to rethrow
    console.error("Failed to initialize Firebase Admin SDK:", e?.message || e);
    throw e;
  }
}

export const adminApp = ensureApp();
export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);

export function getGcsBucket() {
  const byOptions = (adminApp?.options?.storageBucket as string | undefined)?.trim();
  const byEnv = (env.FIREBASE_STORAGE_BUCKET || env.GCS_BUCKET || "").trim();
  const name = byOptions || byEnv;
  if (!name) {
    const err: any = new Error(
      "Storage bucket is not configured. Set app.options.storageBucket or FIREBASE_STORAGE_BUCKET/GCS_BUCKET."
    );
    err.code = "STORAGE_BUCKET_MISSING";
    throw err;
  }
  return getStorage(adminApp).bucket(name);
}
