import { withApiGuard } from "@/server/http/guard";
import { getSupabaseAdmin } from "@/server/db/supabase";

export const runtime = "nodejs";

async function countBatches(
  where: { column?: string; value?: string },
  orgId?: string | null
) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from("batches").select("id", { count: "exact", head: true });
  if (orgId) {
    query = query.eq("org_id", orgId);
  }
  if (where.column && where.value) {
    query = query.eq(where.column, where.value);
  }
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export const GET = withApiGuard({
  method: "GET",
  requireRole: "user",
  async handler({ user }) {
    const orgId = user?.orgId ?? null;
    const [all, propagation, ready, archived] = await Promise.all([
      countBatches({}, orgId),
      countBatches({ column: "status", value: "Propagation" }, orgId),
      countBatches({ column: "status", value: "Ready" }, orgId),
      countBatches({ column: "status", value: "Archived" }, orgId),
    ]);

    return new Response(
      JSON.stringify({
        totals: {
          all,
          propagation,
          ready,
          archived,
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  },
});
