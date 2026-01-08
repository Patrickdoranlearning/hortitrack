import { withApiGuard } from "@/server/http/guard";
import { getSupabaseAdmin } from "@/server/db/supabase";

export const runtime = "nodejs";

// Optimized: Single query with status aggregation instead of 4 separate count queries
async function getBatchStatusCounts(orgId?: string | null) {
  const supabase = getSupabaseAdmin();

  // Fetch all batches with just status field (minimal data)
  let query = supabase
    .from("batches")
    .select("status");

  if (orgId) {
    query = query.eq("org_id", orgId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Count locally - much faster than 4 separate DB queries
  const batches = data || [];
  const counts = {
    all: batches.length,
    propagation: 0,
    ready: 0,
    archived: 0,
  };

  for (const batch of batches) {
    if (batch.status === "Propagation") counts.propagation++;
    else if (batch.status === "Ready") counts.ready++;
    else if (batch.status === "Archived") counts.archived++;
  }

  return counts;
}

export const GET = withApiGuard({
  method: "GET",
  requireRole: "user",
  async handler({ user }) {
    const orgId = user?.orgId ?? null;
    const totals = await getBatchStatusCounts(orgId);

    return new Response(
      JSON.stringify({ totals }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  },
});
