// src/lib/validation.ts
import { ZodError } from "zod";

type ErrorBody =
  | { error: string; issues?: unknown }
  | { error: string };

export function mapError(e: unknown): { status: number; body: ErrorBody } {
  // Zod validation errors
  if (e instanceof ZodError) {
    return {
      status: 400,
      body: { error: "Validation failed", issues: e.issues },
    };
  }

  // Generic error
  const msg =
    (e as any)?.message ||
    (typeof e === "string" ? e : "Internal Server Error");

  // You can branch on Firebase errors here if you want:
  // if ((e as any)?.code === 'permission-denied') return { status: 403, body: { error: msg } };

  return {
    status: 500,
    body: { error: msg },
  };
}