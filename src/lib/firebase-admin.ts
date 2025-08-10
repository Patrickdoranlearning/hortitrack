
import * as admin from 'firebase-admin';
import { App, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getFirebaseAdmin(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  return initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdmin());
}

export function getAdminFirestore() {
  return getFirestore(getFirebaseAdmin());
}

export const auth = getAdminAuth();
export const firestore = getAdminFirestore();
