import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Captures protocol performance metrics when a batch is completed.
 * Should be called when a batch status changes to "Ready" or "Archived"
 * and the batch has an associated protocol.
 */
export async function captureProtocolPerformance(
  supabase: SupabaseClient,
  orgId: string,
  batchId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch batch with protocol info
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .select(`
        id,
        protocol_id,
        quantity,
        initial_quantity,
        planted_at,
        ready_at,
        status,
        created_at
      `)
      .eq("id", batchId)
      .eq("org_id", orgId)
      .single();

    if (batchError || !batch) {
      console.error("[protocol-performance] Batch not found:", batchError);
      return { success: false, error: "Batch not found" };
    }

    // Skip if no protocol linked
    if (!batch.protocol_id) {
      return { success: true }; // Not an error, just nothing to capture
    }

    // Check if performance already captured for this batch
    const { data: existing } = await supabase
      .from("protocol_performance")
      .select("id")
      .eq("batch_id", batchId)
      .single();

    if (existing) {
      return { success: true }; // Already captured
    }

    // Fetch protocol to get planned metrics
    const { data: protocol, error: protocolError } = await supabase
      .from("protocols")
      .select("id, route, definition")
      .eq("id", batch.protocol_id)
      .single();

    if (protocolError || !protocol) {
      console.error("[protocol-performance] Protocol not found:", protocolError);
      return { success: false, error: "Protocol not found" };
    }

    // Calculate planned duration from protocol route
    let plannedDurationDays: number | null = null;
    let plannedReadyWeek: number | null = null;

    const route = protocol.route as {
      nodes?: Array<{
        stageName?: string;
        fromYear?: number;
        fromWeek?: number;
        toYear?: number;
        toWeek?: number;
      }>;
    } | null;

    if (route?.nodes && route.nodes.length >= 2) {
      // Find Ready/finish stage (first in array) and Propagation/start stage (last in array)
      const finishNode = route.nodes[0];
      const startNode = route.nodes[route.nodes.length - 1];

      if (startNode?.fromYear && startNode?.fromWeek && finishNode?.toYear && finishNode?.toWeek) {
        const startWeekTotal = startNode.fromYear * 52 + startNode.fromWeek;
        const endWeekTotal = finishNode.toYear * 52 + finishNode.toWeek;
        const weeksTotal = endWeekTotal - startWeekTotal;
        plannedDurationDays = Math.round(weeksTotal * 7);
        plannedReadyWeek = finishNode.toWeek;
      }
    }

    // Calculate actual metrics
    const plantedDate = batch.planted_at ? new Date(batch.planted_at) : null;
    const completedDate = batch.ready_at ? new Date(batch.ready_at) : new Date();

    let actualDurationDays: number | null = null;
    let actualReadyWeek: number | null = null;

    if (plantedDate) {
      const diffMs = completedDate.getTime() - plantedDate.getTime();
      actualDurationDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    // Get ISO week number for completion date
    actualReadyWeek = getISOWeek(completedDate);

    // Calculate yield percentage
    const initialQty = batch.initial_quantity ?? batch.quantity ?? 0;
    const finalQty = batch.quantity ?? 0;
    let actualYieldPct: number | null = null;
    
    if (initialQty > 0) {
      actualYieldPct = Math.round((finalQty / initialQty) * 100 * 100) / 100; // 2 decimal places
    }

    // Insert performance record
    const { error: insertError } = await supabase
      .from("protocol_performance")
      .insert({
        org_id: orgId,
        protocol_id: batch.protocol_id,
        batch_id: batchId,
        planned_duration_days: plannedDurationDays,
        planned_ready_week: plannedReadyWeek,
        planned_yield_pct: 100, // Assume 100% planned yield
        actual_duration_days: actualDurationDays,
        actual_ready_week: actualReadyWeek,
        actual_yield_pct: actualYieldPct,
        initial_quantity: initialQty,
        final_quantity: finalQty,
        completed_at: completedDate.toISOString(),
      });

    if (insertError) {
      console.error("[protocol-performance] Insert error:", insertError);
      return { success: false, error: insertError.message };
    }

    return { success: true };
  } catch (err) {
    console.error("[protocol-performance] Unexpected error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Get ISO week number for a date
 */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get aggregated performance stats for a protocol
 */
export async function getProtocolPerformanceStats(
  supabase: SupabaseClient,
  orgId: string,
  protocolId: string
): Promise<{
  totalBatches: number;
  avgDurationDays: number | null;
  avgYieldPct: number | null;
  durationAccuracy: number | null; // % difference from planned
  recentPerformance: Array<{
    batchId: string;
    completedAt: string;
    actualDurationDays: number | null;
    actualYieldPct: number | null;
  }>;
} | null> {
  try {
    const { data, error } = await supabase
      .from("protocol_performance")
      .select("*")
      .eq("org_id", orgId)
      .eq("protocol_id", protocolId)
      .order("completed_at", { ascending: false });

    if (error || !data) {
      console.error("[protocol-performance] Stats query error:", error);
      return null;
    }

    if (data.length === 0) {
      return {
        totalBatches: 0,
        avgDurationDays: null,
        avgYieldPct: null,
        durationAccuracy: null,
        recentPerformance: [],
      };
    }

    // Calculate averages
    const durations = data
      .filter((p) => p.actual_duration_days !== null)
      .map((p) => p.actual_duration_days as number);
    
    const yields = data
      .filter((p) => p.actual_yield_pct !== null)
      .map((p) => p.actual_yield_pct as number);

    const avgDurationDays = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;

    const avgYieldPct = yields.length > 0
      ? Math.round((yields.reduce((a, b) => a + b, 0) / yields.length) * 100) / 100
      : null;

    // Calculate duration accuracy (how close to planned)
    let durationAccuracy: number | null = null;
    const withPlannedDuration = data.filter(
      (p) => p.planned_duration_days && p.actual_duration_days
    );
    if (withPlannedDuration.length > 0) {
      const accuracies = withPlannedDuration.map((p) => {
        const diff = Math.abs(
          (p.actual_duration_days as number) - (p.planned_duration_days as number)
        );
        const planned = p.planned_duration_days as number;
        return 100 - (diff / planned) * 100;
      });
      durationAccuracy = Math.round(
        accuracies.reduce((a, b) => a + b, 0) / accuracies.length
      );
    }

    return {
      totalBatches: data.length,
      avgDurationDays,
      avgYieldPct,
      durationAccuracy,
      recentPerformance: data.slice(0, 10).map((p) => ({
        batchId: p.batch_id,
        completedAt: p.completed_at,
        actualDurationDays: p.actual_duration_days,
        actualYieldPct: p.actual_yield_pct,
      })),
    };
  } catch (err) {
    console.error("[protocol-performance] Stats error:", err);
    return null;
  }
}

