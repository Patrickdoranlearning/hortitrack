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
  const {
    FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY,
  } = process.env;

  // Prefer explicit service account from env; normalize escaped newlines.
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    const normalizedKey = FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
    return cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: normalizedKey,
    });
  }

  // Fallback to ADC in GCP/Workstations/local gcloud.
  return applicationDefault();
}

const app: App =
  getApps()[0] ?? initializeApp({ credential: buildCredential() });

export const adminApp = app;
export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app);
export const adminAuth = getAuth(app);