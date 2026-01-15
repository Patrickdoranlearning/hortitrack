/**
 * Supabase database types (re-export).
 *
 * NOTE:
 * This file exists because many parts of the app import `Database` from `@/types/supabase`.
 * The source of truth for generated Supabase types is `src/lib/database.types.ts`.
 *
 * Keeping this file as a lightweight re-export prevents accidental overwrites with
 * CLI error output (which would break `tsc` immediately).
 */

export type { Database, Json } from "@/lib/database.types";
