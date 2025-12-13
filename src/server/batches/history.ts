
'use server';

import { getSupabaseAdmin } from "@/server/db/supabase";
import { isValidDocId } from "@/server/utils/ids";

export type HistoryLog = {
  id: string;
  batchId: string;
  at: string;
  type: string;
  title: string;
  details?: string | null;
  userId?: string | null;
  userName?: string | null;
  media?: Array<{ url: string; name?: string | null }>;
  quantity?: number | null; // Quantity change (+/- units)
};

type AnyDate = Date | string | number | null | undefined;

const toDate = (value: AnyDate) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  }
  return null;
};

const daysBetween = (a?: AnyDate, b?: AnyDate) => {
  const start = toDate(a);
  const end = toDate(b);
  if (!start || !end) return null;
  return Math.max(0, Math.round((+end - +start) / 86_400_000));
};

export type HistoryNode = {
  id: string;
  label: string;
  kind: "batch" | "stage" | "move" | "split" | "merge";
  batchId: string;
  stageName?: string | null;
  locationName?: string | null;
  start?: string | null;
  end?: string | null;
  durationDays?: number | null;
  meta?: Record<string, unknown>;
};

export type HistoryEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind: "flow" | "split" | "merge" | "move";
};

export type BatchHistory = {
  batch: {
    id: string;
    batchNumber?: string | number | null;
    plantName?: string | null;
    variety?: string | null;
    quantity?: number | null;
    createdAt?: string | null;
  };
  graph: { nodes: HistoryNode[]; edges: HistoryEdge[] };
  logs: HistoryLog[];
};

type BatchRow = {
  id: string;
  batch_number: string | null;
  plant_varieties?: { name: string | null };
  quantity: number | null;
  created_at: string | null;
  parent_batch_id: string | null;
};

async function readBatch(id: string): Promise<BatchRow | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("batches")
    .select("id, batch_number, quantity, created_at, parent_batch_id, plant_varieties(name)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as BatchRow) ?? null;
}

async function readChildren(id: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("batches")
    .select("id, batch_number")
    .eq("parent_batch_id", id)
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function readEvents(batchId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("batch_events")
    .select("id, type, at, by_user_id, payload")
    .eq("batch_id", batchId)
    .order("at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function readPlantHealthLogs(batchId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("plant_health_logs")
    .select(`
      id,
      event_type,
      event_at,
      recorded_by,
      title,
      notes,
      product_name,
      rate,
      unit,
      method,
      reason_for_use,
      weather_conditions,
      area_treated,
      sprayer_used,
      signed_by,
      safe_harvest_date,
      harvest_interval_days
    `)
    .eq("batch_id", batchId)
    .order("event_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

function parsePayload(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function buildBatchHistory(rootId: string): Promise<BatchHistory> {
  if (!isValidDocId(rootId)) {
    throw new Error("Invalid batch ID provided.");
  }

  const batch = await readBatch(rootId);
  if (!batch) throw new Error("Batch not found");

  const nodes: HistoryNode[] = [];
  const edges: HistoryEdge[] = [];
  nodes.push({
    id: `batch:${batch.id}`,
    kind: "batch",
    batchId: batch.id,
    label: `Batch ${batch.batch_number ?? batch.id}`,
    meta: { variety: batch.plant_varieties?.name ?? null },
  });

  if (batch.parent_batch_id) {
    const parent = await readBatch(batch.parent_batch_id);
    if (parent) {
      const parentId = `batch:${parent.id}`;
      nodes.push({
        id: parentId,
        kind: "batch",
        batchId: parent.id,
        label: `Batch ${parent.batch_number ?? parent.id}`,
        meta: { variety: parent.plant_varieties?.name ?? null },
      });
      edges.push({
        id: `e:${parentId}->batch:${batch.id}`,
        from: parentId,
        to: `batch:${batch.id}`,
        kind: "flow",
        label: "transplant",
      });
    }
  }

  const children = await readChildren(batch.id);
  if (children.length) {
    const splitId = `split:${batch.id}`;
    nodes.push({
      id: splitId,
      kind: "split",
      batchId: batch.id,
      label: `Split (${children.length})`,
    });
    edges.push({
      id: `e:batch:${batch.id}->${splitId}`,
      from: `batch:${batch.id}`,
      to: splitId,
      kind: "split",
      label: "split",
    });
    for (const child of children) {
      const childId = `batch:${child.id}`;
      nodes.push({
        id: childId,
        kind: "batch",
        batchId: child.id,
        label: `Batch ${child.batch_number ?? child.id}`,
      });
      edges.push({
        id: `e:${splitId}->${childId}`,
        from: splitId,
        to: childId,
        kind: "split",
        label: "→",
      });
    }
  }

  const [events, healthLogs] = await Promise.all([
    readEvents(batch.id),
    readPlantHealthLogs(batch.id),
  ]);

  const logs: HistoryLog[] = events.map((evt) => {
    const payload = parsePayload(evt.payload);
    const photos = getArray(payload, "photos");
    const eventType = (evt.type ?? "event").toLowerCase();

    // Extract quantity from payload based on event type
    let quantity: number | null = null;
    if (payload) {
      const rawQty = payload.qty ?? payload.quantity ?? payload.units_picked ?? payload.units ?? payload.diff ?? null;
      if (typeof rawQty === "number") {
        // Determine sign based on event type
        const upperType = evt.type?.toUpperCase() ?? "";
        if (["PICKED", "LOSS", "TRANSPLANT_TO"].includes(upperType)) {
          quantity = -Math.abs(rawQty);
        } else if (["TRANSPLANT_FROM", "CREATE", "CHECKIN"].includes(upperType)) {
          quantity = Math.abs(rawQty);
        } else {
          quantity = rawQty;
        }
      }
    }

    // Build better title based on event type
    let title =
      getString(payload, "notes") ??
      getString(payload, "reason") ??
      getString(payload, "stage") ??
      evt.type ??
      "event";

    // Improve title for specific event types
    const upperType = evt.type?.toUpperCase() ?? "";
    if (upperType === "PICKED" && quantity) {
      title = `${Math.abs(quantity)} units picked for sale`;
    } else if (upperType === "TRANSPLANT_TO" && quantity) {
      title = `${Math.abs(quantity)} units transplanted out`;
    } else if (upperType === "TRANSPLANT_FROM" && quantity) {
      title = `${Math.abs(quantity)} units transplanted in`;
    } else if (upperType === "LOSS" && quantity) {
      title = `${Math.abs(quantity)} units lost${getString(payload, "reason") ? `: ${getString(payload, "reason")}` : ""}`;
    } else if (upperType === "STATUS_CHANGE") {
      const status = getString(payload, "status") ?? getString(payload, "newStatus");
      if (status) title = `Status changed to ${status}`;
    }

    return {
      id: evt.id,
      batchId: batch.id,
      at: toDate(evt.at)?.toISOString() ?? new Date().toISOString(),
      type: eventType,
      title,
      details:
        getString(payload, "details") ??
        getString(payload, "notes") ??
        getString(payload, "reason") ??
        null,
      userId: evt.by_user_id ?? null,
      userName: getString(payload, "by_user"),
      media: photos
        .map((photo) => normalizePhoto(photo))
        .filter((photo): photo is { url: string; caption?: string } => !!photo?.url)
        .map((photo) => ({
          url: photo.url,
          name: photo.caption ?? null,
        })),
      quantity,
    };
  });

  // Add plant health logs (IPM treatments, etc.) to the history
  for (const hl of healthLogs) {
    // Build details string with application info
    const detailParts: string[] = [];
    if (hl.product_name) {
      let productInfo = hl.product_name;
      if (hl.rate && hl.unit) {
        productInfo += ` @ ${hl.rate} ${hl.unit}`;
      }
      if (hl.method) {
        productInfo += ` (${hl.method})`;
      }
      detailParts.push(productInfo);
    }
    if (hl.reason_for_use) detailParts.push(`Reason: ${hl.reason_for_use}`);
    if (hl.weather_conditions) detailParts.push(`Weather: ${hl.weather_conditions}`);
    if (hl.area_treated) detailParts.push(`Area: ${hl.area_treated}`);
    if (hl.sprayer_used) detailParts.push(`Sprayer: ${hl.sprayer_used}`);
    if (hl.safe_harvest_date) {
      detailParts.push(`Safe harvest: ${new Date(hl.safe_harvest_date).toLocaleDateString()}`);
    }
    if (hl.notes) detailParts.push(hl.notes);

    logs.push({
      id: hl.id,
      batchId: batch.id,
      at: toDate(hl.event_at)?.toISOString() ?? new Date().toISOString(),
      type: hl.event_type === 'treatment' ? 'treatment' : (hl.event_type ?? 'health'),
      title: hl.title ?? hl.product_name ?? hl.event_type ?? 'Health Log',
      details: detailParts.length > 0 ? detailParts.join(' | ') : null,
      userId: hl.recorded_by ?? null,
      userName: hl.signed_by ?? null,
      media: [],
    });
  }

  const STAGE_ACTIONS = new Set([
    "cuttings",
    "potting",
    "graded",
    "spaced",
    "ready",
    "rooted",
    "create",
    "checkin",
  ]);

  type StageSpan = { name: string; start?: AnyDate; end?: AnyDate };
  const stages: StageSpan[] = [];
  let currentStage: StageSpan | null = null;

  for (const log of logs) {
    const at = toDate(log.at) ?? new Date();
    if (STAGE_ACTIONS.has(log.type)) {
      if (currentStage) {
        currentStage.end = currentStage.end || at;
        stages.push(currentStage);
      }
      currentStage = { name: log.title, start: at };
    }
  }
  if (currentStage) {
    currentStage.end = currentStage.end || new Date();
    stages.push(currentStage);
  }

  let prevStageNodeId: string | null = `batch:${batch.id}`;
  stages.forEach((stage, idx) => {
    const nodeId = `stage:${batch.id}:${idx}`;
    const start = toDate(stage.start)?.toISOString() ?? null;
    const end = toDate(stage.end)?.toISOString() ?? null;
    const duration = daysBetween(stage.start, stage.end);
    nodes.push({
      id: nodeId,
      kind: "stage",
      batchId: batch.id,
      stageName: stage.name,
      label: stage.name,
      start,
      end,
      durationDays: duration,
    });
    if (prevStageNodeId) {
      edges.push({
        id: `e:${prevStageNodeId}->${nodeId}`,
        from: prevStageNodeId,
        to: nodeId,
        kind: "flow",
        label: duration != null ? `${duration}d` : "",
      });
    }
    prevStageNodeId = nodeId;
  });

  logs.sort((a, b) => +new Date(a.at) - +new Date(b.at));

  return {
    batch: {
      id: batch.id,
      batchNumber: batch.batch_number,
      plantName: batch.plant_varieties?.name ?? null,
      variety: batch.plant_varieties?.name ?? null,
      quantity: batch.quantity,
      createdAt: batch.created_at,
    },
    graph: { nodes, edges },
    logs,
  };
}

function getString(
  payload: Record<string, unknown> | null,
  key: string
): string | null {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

function getArray(
  payload: Record<string, unknown> | null,
  key: string
): unknown[] {
  const value = payload?.[key];
  return Array.isArray(value) ? value : [];
}

type PhotoCandidate =
  | string
  | { url?: unknown; caption?: unknown }
  | null
  | undefined;

function normalizePhoto(candidate: PhotoCandidate) {
  if (typeof candidate === "string" && candidate.length) {
    return { url: candidate, caption: undefined };
  }
  if (
    candidate &&
    typeof candidate === "object" &&
    typeof (candidate as { url?: unknown }).url === "string"
  ) {
    const url = (candidate as { url: string }).url;
    const captionValue = (candidate as { caption?: unknown }).caption;
    const caption = typeof captionValue === "string" ? captionValue : undefined;
    return { url, caption };
  }
  return null;
}
