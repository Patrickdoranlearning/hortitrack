import { getSupabaseServerApp } from "@/server/db/supabase";

export type HealthStatusLevel = "healthy" | "attention" | "critical" | "unknown";

export type BatchHealthStatus = {
  batchId: string;
  level: HealthStatusLevel;
  lastEventAt: string | null;
  lastEventType: string | null;
  lastEventSeverity: string | null;
  activeIssuesCount: number;
  hasUnresolvedScouts: boolean;
};

/**
 * Get health status summary for a batch
 * Based on recent plant_health_logs entries
 */
export async function getBatchHealthStatus(
  batchId: string,
  orgId: string
): Promise<BatchHealthStatus> {
  const supabase = await getSupabaseServerApp();

  // Get recent health logs for this batch (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: healthLogs, error } = await supabase
    .from("plant_health_logs")
    .select("id, event_type, severity, event_at, clearance_at")
    .eq("batch_id", batchId)
    .eq("org_id", orgId)
    .gte("event_at", thirtyDaysAgo.toISOString())
    .order("event_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[getBatchHealthStatus] error:", error);
    return {
      batchId,
      level: "unknown",
      lastEventAt: null,
      lastEventType: null,
      lastEventSeverity: null,
      activeIssuesCount: 0,
      hasUnresolvedScouts: false,
    };
  }

  if (!healthLogs || healthLogs.length === 0) {
    return {
      batchId,
      level: "healthy",
      lastEventAt: null,
      lastEventType: null,
      lastEventSeverity: null,
      activeIssuesCount: 0,
      hasUnresolvedScouts: false,
    };
  }

  // Analyze health logs to determine status
  const latestLog = healthLogs[0];
  const unresolvedScouts = healthLogs.filter(
    (log) => log.event_type === "scout_flag" && !log.clearance_at
  );
  const hasUnresolvedScouts = unresolvedScouts.length > 0;

  // Count active issues (scouts without clearance)
  const activeIssuesCount = unresolvedScouts.length;

  // Determine severity level
  let level: HealthStatusLevel = "healthy";

  // Check for critical issues
  const hasCritical = unresolvedScouts.some((log) => log.severity === "critical");
  const hasHigh = unresolvedScouts.some((log) => log.severity === "high");
  const hasMedium = unresolvedScouts.some((log) => log.severity === "medium");

  if (hasCritical) {
    level = "critical";
  } else if (hasHigh || activeIssuesCount >= 3) {
    level = "critical";
  } else if (hasMedium || activeIssuesCount >= 1) {
    level = "attention";
  }

  return {
    batchId,
    level,
    lastEventAt: latestLog.event_at,
    lastEventType: latestLog.event_type,
    lastEventSeverity: latestLog.severity,
    activeIssuesCount,
    hasUnresolvedScouts,
  };
}

/**
 * Get health status summaries for multiple batches
 * Optimized for batch list views
 */
export async function getBatchHealthStatuses(
  batchIds: string[],
  orgId: string
): Promise<Map<string, BatchHealthStatus>> {
  const supabase = await getSupabaseServerApp();
  const result = new Map<string, BatchHealthStatus>();

  if (batchIds.length === 0) {
    return result;
  }

  // Initialize all batches as healthy
  for (const id of batchIds) {
    result.set(id, {
      batchId: id,
      level: "healthy",
      lastEventAt: null,
      lastEventType: null,
      lastEventSeverity: null,
      activeIssuesCount: 0,
      hasUnresolvedScouts: false,
    });
  }

  // Get recent health logs for all batches (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: healthLogs, error } = await supabase
    .from("plant_health_logs")
    .select("id, batch_id, event_type, severity, event_at, clearance_at")
    .in("batch_id", batchIds)
    .eq("org_id", orgId)
    .gte("event_at", thirtyDaysAgo.toISOString())
    .order("event_at", { ascending: false });

  if (error) {
    console.error("[getBatchHealthStatuses] error:", error);
    return result;
  }

  if (!healthLogs || healthLogs.length === 0) {
    return result;
  }

  // Group logs by batch
  const logsByBatch = new Map<string, typeof healthLogs>();
  for (const log of healthLogs) {
    if (!log.batch_id) continue;
    const existing = logsByBatch.get(log.batch_id) || [];
    existing.push(log);
    logsByBatch.set(log.batch_id, existing);
  }

  // Analyze each batch
  for (const [batchId, logs] of logsByBatch) {
    const latestLog = logs[0];
    const unresolvedScouts = logs.filter(
      (log) => log.event_type === "scout_flag" && !log.clearance_at
    );
    const hasUnresolvedScouts = unresolvedScouts.length > 0;
    const activeIssuesCount = unresolvedScouts.length;

    // Determine severity level
    let level: HealthStatusLevel = "healthy";

    const hasCritical = unresolvedScouts.some((log) => log.severity === "critical");
    const hasHigh = unresolvedScouts.some((log) => log.severity === "high");
    const hasMedium = unresolvedScouts.some((log) => log.severity === "medium");

    if (hasCritical) {
      level = "critical";
    } else if (hasHigh || activeIssuesCount >= 3) {
      level = "critical";
    } else if (hasMedium || activeIssuesCount >= 1) {
      level = "attention";
    }

    result.set(batchId, {
      batchId,
      level,
      lastEventAt: latestLog.event_at,
      lastEventType: latestLog.event_type,
      lastEventSeverity: latestLog.severity,
      activeIssuesCount,
      hasUnresolvedScouts,
    });
  }

  return result;
}

/**
 * Get production health summary stats
 */
export async function getProductionHealthSummary(orgId: string): Promise<{
  totalBatches: number;
  healthyBatches: number;
  attentionBatches: number;
  criticalBatches: number;
  unresolvedScoutsCount: number;
  upcomingTreatmentsCount: number;
  recentIssues: Array<{
    batchId: string;
    batchNumber: string;
    varietyName: string;
    severity: string;
    issueType: string;
    eventAt: string;
  }>;
}> {
  const supabase = await getSupabaseServerApp();

  // Get active batches
  const { data: batches, error: batchError } = await supabase
    .from("batches")
    .select("id, batch_number, quantity, plant_varieties(name)")
    .eq("org_id", orgId)
    .neq("status", "Archived")
    .gt("quantity", 0);

  if (batchError || !batches) {
    console.error("[getProductionHealthSummary] batch error:", batchError);
    return {
      totalBatches: 0,
      healthyBatches: 0,
      attentionBatches: 0,
      criticalBatches: 0,
      unresolvedScoutsCount: 0,
      upcomingTreatmentsCount: 0,
      recentIssues: [],
    };
  }

  const batchIds = batches.map((b) => b.id);
  const healthStatuses = await getBatchHealthStatuses(batchIds, orgId);

  // Count by status level
  let healthyBatches = 0;
  let attentionBatches = 0;
  let criticalBatches = 0;
  let unresolvedScoutsCount = 0;

  for (const status of healthStatuses.values()) {
    switch (status.level) {
      case "healthy":
        healthyBatches++;
        break;
      case "attention":
        attentionBatches++;
        break;
      case "critical":
        criticalBatches++;
        break;
    }
    unresolvedScoutsCount += status.activeIssuesCount;
  }

  // Get upcoming treatments (scheduled tasks)
  const { data: upcomingTasks } = await supabase
    .from("ipm_tasks")
    .select("id")
    .eq("org_id", orgId)
    .eq("status", "pending")
    .gte("scheduled_date", new Date().toISOString().split("T")[0])
    .limit(100);

  const upcomingTreatmentsCount = upcomingTasks?.length ?? 0;

  // Get recent issues (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentScouts } = await supabase
    .from("plant_health_logs")
    .select(`
      id,
      batch_id,
      severity,
      event_type,
      event_at,
      batches!inner(batch_number, plant_varieties(name))
    `)
    .eq("org_id", orgId)
    .eq("event_type", "scout_flag")
    .is("clearance_at", null)
    .gte("event_at", sevenDaysAgo.toISOString())
    .order("event_at", { ascending: false })
    .limit(10);

  const recentIssues = (recentScouts || []).map((scout) => {
    const batchData = scout.batches as unknown as {
      batch_number: string;
      plant_varieties: { name: string }[] | { name: string } | null;
    };
    const varietyData = batchData?.plant_varieties;
    const varietyName = Array.isArray(varietyData)
      ? varietyData[0]?.name || "Unknown"
      : (varietyData as { name: string } | null)?.name || "Unknown";

    return {
      batchId: scout.batch_id || "",
      batchNumber: batchData?.batch_number || "Unknown",
      varietyName,
      severity: scout.severity || "low",
      issueType: scout.event_type || "scout_flag",
      eventAt: scout.event_at || "",
    };
  });

  return {
    totalBatches: batches.length,
    healthyBatches,
    attentionBatches,
    criticalBatches,
    unresolvedScoutsCount,
    upcomingTreatmentsCount,
    recentIssues,
  };
}
