// Central helpers to avoid "[object Object]" everywhere.

export function toMessage(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message || String(err);
  try {
    // Common Next/ServerAction objects or zod errors
    if (typeof err === "object") {
      // surface common fields if present
      const anyErr = err as Record<string, unknown>;
      if (anyErr.error && typeof anyErr.error === "string") return anyErr.error;
      if (anyErr.message && typeof anyErr.message === "string") return anyErr.message;
      return JSON.stringify(anyErr);
    }
    return String(err);
  } catch {
    return String(err);
  }
}

export function ensureError(e: unknown): Error {
  if (e instanceof Error) return e;
  try {
    return new Error(toMessage(e));
  } catch {
    return new Error("Unknown error");
  }
}

// --- Server Action Error Pattern ---

/**
 * Standard error response for server actions
 */
export type ActionError = {
  error: string;           // User-facing message
  code?: string;           // Error code for programmatic handling
  details?: unknown;       // Technical details (dev only)
  field?: string;          // Field name if validation error
};

/**
 * Standard result type for server actions
 * Use this for consistent error handling across all actions
 *
 * @example
 * async function createOrder(data: unknown): Promise<ActionResult<Order>> {
 *   const validation = schema.safeParse(data);
 *   if (!validation.success) {
 *     return {
 *       success: false,
 *       error: 'Invalid input',
 *       code: 'VALIDATION_ERROR',
 *       details: validation.error.flatten(),
 *     };
 *   }
 *
 *   return {
 *     success: true,
 *     data: order,
 *   };
 * }
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | ({ success: false } & ActionError);