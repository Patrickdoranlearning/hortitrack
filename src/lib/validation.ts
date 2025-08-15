ts
import { z } from "zod";

// Add endpoint schemas here as they grow
export const Whoami = z.object({}); // currently no inputs

export function mapError(e: any): { status: number; body: any } {
  if (e?.code === "UNAUTHORIZED") return { status: 401, body: { error: "Unauthorized" } };
  if (e?.name === "ZodError") return { status: 400, body: { error: "Bad Request", issues: e.issues } };
  return { status: 500, body: { error: "Internal Error" } };
}