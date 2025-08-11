
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';
import admin from 'firebase-admin';

// Correct Firebase Admin SDK Initialization
try {
  if (!admin.apps.length) {
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      const serviceAccount = JSON.parse(serviceAccountKey);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT_KEY is not set. Firebase log and trace sinks will not work.");
    }
  }
} catch (error) {
    console.error('Failed to initialize Firebase Admin SDK in genkit.ts:', error);
}


export const ai = genkit({
  plugins: [
    googleAI(),
    vertexAI({ location: 'us-central1' }),
  ],
  logSinks: ['firebase'],
  traceSinks: ['firebase'],
  enableTracingAndMetrics: true,
});
