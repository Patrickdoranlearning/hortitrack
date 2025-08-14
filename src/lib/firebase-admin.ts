// src/lib/firebase-admin.ts
import "server-only";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue as AdminFieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";


const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Fail fast with a helpful message if env is missing
if (!projectId || !clientEmail || !privateKey) {
  // You can log once; avoid throwing at import time in production if you prefer.
  console.error(
    "[firebase-admin] Missing credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY."
  );
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export const db = getFirestore();
export const adminAuth = getAuth();
// Re-export commonly used admin types so actions can import from here
export { AdminFieldValue as FieldValue, Timestamp };
