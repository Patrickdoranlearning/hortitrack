// src/server/db/admin.ts
import "server-only";
import {
  initializeApp,
  getApps,
  applicationDefault,
  cert,
  type App,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";

function buildCredential() {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    return cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\n/g, "\n"),
    });
  }
  // Falls back to ADC on servers (GCP, Workstations, etc.)
  return applicationDefault();
}

let app: App;
if (!getApps().length) {
  app = initializeApp({ credential: buildCredential() });
} else {
  app = getApps()[0]!;
}

export const adminApp = app;
export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app);
export const adminAuth = getAuth(app);