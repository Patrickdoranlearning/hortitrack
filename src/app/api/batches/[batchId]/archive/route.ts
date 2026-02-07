import { withApiGuard } from "@/server/http/guard";
import { archiveBatch } from "@/server/batches/archive";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  reason: z.string().optional(),
}).optional();

export const POST = withApiGuard({
  method: "POST",
  requireRole: "user",
  bodySchema: BodySchema,
  rate: { max: 20, windowMs: 60_000, keyPrefix: "archive" },
  async handler({ req, user, body }) {
    const id = req.nextUrl.pathname.split("/").at(-2)!; // [batchId]/archive

    if (!user?.orgId) {
      return new Response(JSON.stringify({ error: "Organization not found" }), { status: 403, headers: { "content-type": "application/json" } });
    }

    const result = await archiveBatch(id, user.orgId, user.uid, body?.reason);
    return new Response(JSON.stringify({ ok: true, ...result }), { status: 200, headers: { "content-type": "application/json" } });
  },
});
