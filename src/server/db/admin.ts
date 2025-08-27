// src/server/db/admin.ts
import "server-only";
import {
  getApps,
  initializeApp,
  applicationDefault,
  cert,
  type AppOptions,
} from "firebase-admin/app";
// import { getAuth } from "firebase-admin/auth"; // Commented out
// import { getFirestore } from "firebase-admin/firestore"; // Commented out
// import { getStorage } from "firebase-admin/storage"; // Commented out

function resolveCredential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (json) return cert(JSON.parse(json));
  if (b64) {
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    return cert(JSON.parse(decoded));
  }
  return applicationDefault();
}

function buildOptions(): AppOptions {
  const opts: AppOptions = { credential: resolveCredential() };
  if (process.env.FIREBASE_PROJECT_ID) opts.projectId = process.env.FIREBASE_PROJECT_ID;
  return opts;
}

const app = getApps()[0] ?? initializeApp(buildOptions());

// Removed exports as part of Firebase migration. 
// If needed for specific Firebase Admin tasks, uncomment and ensure proper usage.
// export const adminAuth = getAuth(app);
// export const const adminDb = getFirestore(app);
// export const adminStorage = getStorage(app);
