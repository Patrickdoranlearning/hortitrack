
import { genkit } from 'genkit';
import { firebase } from '@genkit-ai/firebase';
import { googleAI } from '@genkit-ai/googleai';
import { vertexAI } from '@genkit-ai/vertexai';

export const ai = genkit({
  plugins: [
    firebase(),
    googleAI(),
    vertexAI({ location: 'us-central1' }),
  ],
  logSinks: ['firebase'],
  traceSinks: ['firebase'],
  enableTracingAndMetrics: true,
});
