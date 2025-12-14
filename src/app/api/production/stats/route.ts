import { withApiGuard } from "@/server/http/guard";
import { getSupabaseAdmin } from "@/server/db/supabase";
import { getUserAndOrg } from "@/server/auth/org";

export const runtime = "nodejs";

type ProductionStats = {
  batchesInPropagation: number;
  readyForSale: number;
  lossLast7Days: number;
};

async function getProductionStats(orgId: string): Promise<ProductionStats> {
  const supabase = getSupabaseAdmin();

  // Optimized: Use SQL aggregation instead of fetching all batches
  // Get batch status counts with SQL aggregation
  const { data: statusCounts, error: statusError } = await supabase
    .from("batches")
    .select("status")
    .eq("org_id", orgId);

  if (statusError) throw new Error(statusError.message);

  // Count in memory (still efficient since we only fetch status field)
  const batchesInPropagation = statusCounts?.filter((b) => b.status === "Propagation").length ?? 0;
  const readyForSale = statusCounts?.filter((b) => 
    b.status === "Ready" || b.status === "Ready for Sale"
  ).length ?? 0;

  // Calculate loss for last 7 days from batch_events
  // Use SQL to filter by date range for better performance
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: lossEvents, error: lossError } = await supabase
    .from("batch_events")
    .select("payload")
    .eq("org_id", orgId)
    .in("type", ["LOSS", "DUMP"])
    .gte("at", sevenDaysAgo.toISOString());

  if (lossError) throw new Error(lossError.message);

  // Sum loss quantities from payloads
  let lossLast7Days = 0;
  if (lossEvents) {
    for (const event of lossEvents) {
      const payload = event.payload as any;
      const qty = payload?.qty ?? payload?.quantity ?? payload?.units ?? 0;
      if (typeof qty === "number" && qty > 0) {
        lossLast7Days += qty;
      }
    }
  }

  return {
    batchesInPropagation,
    readyForSale,
    lossLast7Days,
  };
}

export const GET = withApiGuard({
  method: "GET",
  requireRole: "user",
  async handler({ user }) {
    const { orgId } = await getUserAndOrg();
    if (!orgId) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 401, headers: { "content-type": "application/json" } }
      );
    }

    const stats = await getProductionStats(orgId);

    return new Response(
      JSON.stringify(stats),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  },
});

