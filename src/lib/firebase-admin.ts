
import * as admin from 'firebase-admin';
import { App, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let app: App;

try {
  app = getApp();
} catch (e) {
  app = initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}


const adminAuth = getAuth(app);
const adminFirestore = getFirestore(app);

export function getAdminAuth() {
  return adminAuth;
}

export function getAdminFirestore() {
  return adminFirestore;
}
