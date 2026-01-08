import 'server-only';
import { genkit } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { vertexAI } from "@genkit-ai/vertexai";

export const ai = genkit({
  plugins: [googleAI(), vertexAI({ location: "us-central1" })],
  traceSinks: ["console"],
  enableTracingAndMetrics: true,
});