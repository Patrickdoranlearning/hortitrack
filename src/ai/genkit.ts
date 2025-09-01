import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';
import '@/server/db/admin'; // Ensures firebase admin is initialized

export const ai = genkit({
  plugins: [
    googleAI(),
    vertexAI({ location: 'us-central1' }),
  ],
  traceSinks: ['firebase'],
  enableTracingAndMetrics: true,
});