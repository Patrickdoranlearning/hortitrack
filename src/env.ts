import { z } from "zod";

const Env = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1, "Missing FIREBASE_PROJECT_ID"),
  FIREBASE_CLIENT_EMAIL: z.string().email("Invalid FIREBASE_CLIENT_EMAIL"),
  FIREBASE_PRIVATE_KEY: z.string().min(10, "Missing FIREBASE_PRIVATE_KEY"),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  GCS_BUCKET: z.string().optional(),
});

// Parse once at module init; throws helpful error in dev, logs in prod
export const env = (() => {
  return Env.parse(process.env);
})();
