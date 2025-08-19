import { withApiGuard } from "@/server/http/guard";
import { adminDb } from "@/server/db/admin";

export const runtime = "nodejs";

export const GET = withApiGuard({
  method: "GET",
  requireRole: "user",
  async handler() {
    const col = adminDb.collection("batches");
    const [all, prop, ready, arch] = await Promise.all([
      col.count().get(),
      col.where("status","==","Propagation").count().get(),
      col.where("status","==","Ready").count().get(),
      col.where("status","==","Archived").count().get(),
    ]);
    return new Response(JSON.stringify({
      totals: {
        all: all.data().count,
        propagation: prop.data().count,
        ready: ready.data().count,
        archived: arch.data().count,
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
  },
});
