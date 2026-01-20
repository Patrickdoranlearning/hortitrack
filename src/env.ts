
import "server-only";
import { z } from "zod";

/**
 * Central, server-only environment validation.
 * Do NOT import this from client components.
 */
const Schema = z.object({
  // Firebase Admin (Legacy - Optional)
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email("Invalid FIREBASE_CLIENT_EMAIL").optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  // Optional buckets
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  GCS_BUCKET: z.string().optional(),

  // Origin / host config
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().optional(),

  // Supabase (required for application to function)
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE: z.string().min(1, "SUPABASE_SERVICE_ROLE is required"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  USE_SUPABASE_READS: z.string().optional(),  // "1" to prefer Supabase for reads
  DUAL_WRITE: z.string().optional(),

  // Runtime hints (optional)
  VERCEL_URL: z.string().optional(),
  VERCEL: z.string().optional(),

  // Sentry (optional - only needed for error monitoring)
  SENTRY_DSN: z.string().url().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
});

const raw = {
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  // Support literal "\n" newlines as provided by most secret managers
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),

  FIREBASE_STORAGE_BUCKET: process.env.FIREBASE_STORAGE_BUCKET,
  GCS_BUCKET: process.env.GCS_BUCKET,

  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,

  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE: process.env.SUPABASE_SERVICE_ROLE,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  USE_SUPABASE_READS: process.env.USE_SUPABASE_READS,
  DUAL_WRITE: process.env.DUAL_WRITE,

  VERCEL_URL: process.env.VERCEL_URL,
  VERCEL: process.env.VERCEL,

  SENTRY_DSN: process.env.SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  SENTRY_ORG: process.env.SENTRY_ORG,
  SENTRY_PROJECT: process.env.SENTRY_PROJECT,
};

export const env = Schema.parse(raw);
export type Env = z.output<typeof Schema>;
