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
      body: { error: "Bad Request", issues: e.errors },
    };
  }

  // Handle errors with a 'code' property, e.g., from Firebase or custom errors
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = (e as { code: unknown }).code;
    if (code === 'UNAUTHORIZED') {
      return { status: 401, body: { error: 'Unauthorized' } };
    }
     if (code === 'NOT_FOUND') {
      return { status: 404, body: { error: 'Not Found' } };
    }
  }
  
  // Generic error
  const msg =
    (e as any)?.message ||
    (typeof e === "string" ? e : "Internal Server Error");

  return {
    status: 500,
    body: { error: msg },
  };
}
