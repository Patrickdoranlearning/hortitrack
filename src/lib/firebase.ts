// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  projectId: "hortitrack",
  appId: "1:841216037830:web:58337596518973b00998c7",
  storageBucket: "hortitrack.firebasestorage.app",
  apiKey: "AIzaSyAsqgI_D4viEIh7q146pD2WSLdUxx_2Qa8",
  authDomain: "hortitrack.firebaseapp.com",
  messagingSenderId: "841216037830",
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
