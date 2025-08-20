// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
};


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const auth = getAuth(app);
const storage = getStorage(app);

export async function uploadActionPhotos(batchId: string, files: File[]) {
  const results: { url: string; path: string; mime: string; size: number }[] = [];
  for (const file of files) {
    const path = `action-photos/${batchId}/${Date.now()}-${file.name}`;
    const r = ref(storage, path);
    const task = uploadBytesResumable(r, file, { contentType: file.type });
    await new Promise((res, rej) => {
      task.on("state_changed", undefined, rej, res);
    });
    const url = await getDownloadURL(r);
    results.push({ url, path, mime: file.type, size: file.size });
  }
  return results;
}


export { app, db, auth, storage };
