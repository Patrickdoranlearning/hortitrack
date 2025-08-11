import "server-only";
import admin from 'firebase-admin';

export function getAdminFirestore() {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
        throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable.");
    }
    
    if (!admin.apps.length) {
        try {
            admin.initializeApp({
                credential: admin.credential.cert(JSON.parse(serviceAccountKey)),
            });
        } catch (error: any) {
            console.error('Firebase admin initialization error', error.stack);
            throw new Error("Failed to initialize Firebase Admin SDK.");
        }
    }
    return admin.firestore();
}
