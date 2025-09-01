// src/server/db/admin.ts
"use client";
import "server-only";
import {
  getApps,
  initializeApp,
  applicationDefault,
  cert,
  type AppOptions,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue as AdminFieldValue, Timestamp } from "firebase-admin/firestore";

function resolveCredential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (json) return cert(JSON.parse(json));
  if (b64) {
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    return cert(JSON.parse(decoded));
  }
  // Fallback for deployed environments (e.g., Google Cloud Functions)
  return applicationDefault();
}

function buildOptions(): AppOptions {
  const opts: AppOptions = { credential: resolveCredential() };
  if (process.env.FIREBASE_PROJECT_ID) opts.projectId = process.env.FIREBASE_PROJECT_ID;
  if (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) opts.storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  return opts;
}

// Initialize the app if it doesn't already exist
const app = getApps()[0] ?? initializeApp(buildOptions());

// Export the initialized services
const adminAuth = getAuth(app);
const adminDb = getFirestore(app);

export { app as adminApp, adminAuth, adminDb, AdminFieldValue, Timestamp };