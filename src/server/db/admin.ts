// src/server/db/admin.ts
import "server-only";

import { getApps, initializeApp, type App, applicationDefault } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

let app: App;
if (!getApps().length) {
  // Use Application Default Credentials or platform identity.
  // Do not read .env.local here (secrets managed externally).
  app = initializeApp({});
} else {
  app = getApps()[0]!;
}

export const adminApp: App = app;
export const adminAuth: Auth = getAuth(app);
export const adminDb: Firestore = getFirestore(app);
export const adminStorage: Storage = getStorage(app);
