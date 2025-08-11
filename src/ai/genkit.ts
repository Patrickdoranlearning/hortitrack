
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';
import admin from 'firebase-admin';

// Correct Firebase Admin SDK Initialization
if (!admin.apps.length) {
  try {
    // Ensure the environment variable is read correctly
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_KEY
      );
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
        console.warn("FIREBASE_SERVICE_ACCOUNT_KEY is not set. Firebase log and trace sinks will not work.");
    }
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK in genkit.ts:', error);
  }
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
