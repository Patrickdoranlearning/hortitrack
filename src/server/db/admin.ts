import "server-only";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

let app: App;
if (!getApps().length) {
  app = initializeApp({});
} else {
  app = getApps()[0]!;
}
export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app);