import { withApiGuard } from "@/server/http/guard";
import { archiveBatch } from "@/server/batches/archive";

export const runtime = "nodejs";

export const POST = withApiGuard({
  method: "POST",
  requireRole: "user",
  rate: { max: 20, windowMs: 60_000, keyPrefix: "archive" },
  async handler({ req, user }) {
    const id = req.nextUrl.pathname.split("/").at(-2)!; // [batchId]/archive
    await archiveBatch(id, user!.uid);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
  },
});
