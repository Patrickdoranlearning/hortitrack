import { adminDb } from "@/server/db/admin";

type AnyDate = Date | string | number | null | undefined;
const toDate = (v: AnyDate) => {
  if (!v) return null;
  if (typeof v === "object" && (v as any).toDate) return (v as any).toDate() as Date;
  const d = new Date(v as any);
  return isFinite(d.getTime()) ? d : null;
};
const daysBetween = (a?: AnyDate, b?: AnyDate) => {
  const d1 = toDate(a), d2 = toDate(b);
  if (!d1 || !d2) return null;
  return Math.max(0, Math.round((+d2 - +d1) / 86400000));
};

export type HistoryNode = {
  id: string;                         // graph node id
  label: string;                      // display
  kind: "batch" | "stage" | "move" | "split" | "merge";
  batchId: string;
  stageName?: string | null;
  locationName?: string | null;
  start?: string | null;              // ISO
  end?: string | null;                // ISO
  durationDays?: number | null;
  meta?: Record<string, any>;
};
export type HistoryEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind: "flow" | "split" | "merge" | "move";
};
export type HistoryLog = {
  id: string;
  batchId: string;
  at: string;                         // ISO
  type: string;                       // "irrigation" | "pest" | "fertilize" | ...
  title: string;
  details?: string | null;
  userId?: string | null;
  userName?: string | null;
  media?: Array<{ url: string; name?: string | null }>;
};

export type BatchHistory = {
  batch: { id: string; batchNumber?: string | number | null; plantName?: string | null; variety?: string | null; quantity?: number | null; createdAt?: string | null; };
  graph: { nodes: HistoryNode[]; edges: HistoryEdge[] };
  logs: HistoryLog[];
};

async function readBatch(id: string) {
  const snap = await adminDb.collection("batches").doc(id).get();
  if (!snap.exists) return null;
  const d = snap.data() || {};
  return {
    id: snap.id,
    batchNumber: d.batchNumber ?? null,
    plantName: d.plantName ?? null,
    variety: d.plantVariety ?? d.variety ?? null,
    quantity: d.quantity ?? d.plants ?? null,
    createdAt: toDate(d.createdAt)?.toISOString() ?? null,
    parentBatchId: d.parentBatchId ?? d.sourceBatchId ?? d.previousBatchId ?? null,
    composition: Array.isArray(d.composition) ? d.composition : [], // for merges (potting from multiple inputs)
  };
}

async function readChildren(id: string) {
  // prefer explicit children; fallback to logs search if needed (narrow by recent)
  const qs = await adminDb.collection("batches").where("parentBatchId", "==", id).limit(20).get().catch(() => ({ empty: true, docs: [] } as any));
  return qs.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
}

async function readLogs(id: string) {
  const qs = await adminDb.collection("batches").doc(id).collection("logs").orderBy("at", "asc").limit(2000).get().catch(() => ({ empty: true, docs: [] } as any));
  return qs.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
}

export async function buildBatchHistory(rootId: string): Promise<BatchHistory> {
  // Core batch
  const b = await readBatch(rootId);
  if (!b) throw new Error("Batch not found");

  // Ancestor (single chain) and merge composition
  const nodes: HistoryNode[] = [];
  const edges: HistoryEdge[] = [];

  // Always a "batch" node (current)
  const batchNodeId = `batch:${b.id}`;
  nodes.push({ id: batchNodeId, kind: "batch", batchId: b.id, label: `Batch ${b.batchNumber ?? b.id}`, meta: { variety: b.variety } });

  // If merged from multiple sources → add a merge gateway and parent batch nodes
  if (Array.isArray(b.composition) && b.composition.length > 1) {
    const mergeId = `merge:${b.id}`;
    nodes.push({ id: mergeId, kind: "merge", batchId: b.id, label: `Merge (${b.composition.length})` });
    edges.push({ id: `e:${mergeId}->${batchNodeId}`, from: mergeId, to: batchNodeId, kind: "merge", label: "merge" });
    for (const s of b.composition) {
      const pid = String(s.batchId);
      const p = await readBatch(pid);
      const pNodeId = `batch:${pid}`;
      if (p) nodes.push({ id: pNodeId, kind: "batch", batchId: pid, label: `Batch ${p.batchNumber ?? pid}`, meta: { variety: p.variety } });
      edges.push({ id: `e:${pNodeId}->${mergeId}`, from: pNodeId, to: mergeId, kind: "merge", label: "→" });
    }
  } else if (b.parentBatchId) {
    // Simple parent chain (no merge)
    const parent = await readBatch(b.parentBatchId);
    if (parent) {
      const pNodeId = `batch:${parent.id}`;
      nodes.push({ id: pNodeId, kind: "batch", batchId: parent.id, label: `Batch ${parent.batchNumber ?? parent.id}`, meta: { variety: parent.variety } });
      edges.push({ id: `e:${pNodeId}->${batchNodeId}`, from: pNodeId, to: batchNodeId, kind: "flow", label: "transplant" });
    }
  }

  // Children (splits)
  const kids = await readChildren(b.id);
  if (kids.length > 0) {
    const splitId = `split:${b.id}`;
    nodes.push({ id: splitId, kind: "split", batchId: b.id, label: `Split (${kids.length})` });
    edges.push({ id: `e:${batchNodeId}->${splitId}`, from: batchNodeId, to: splitId, kind: "split", label: "split" });
    for (const c of kids) {
      const cNodeId = `batch:${c.id}`;
      nodes.push({ id: cNodeId, kind: "batch", batchId: c.id, label: `Batch ${c.batchNumber ?? c.id}` });
      edges.push({ id: `e:${splitId}->${cNodeId}`, from: splitId, to: cNodeId, kind: "split", label: "→" });
    }
  }

  // Stage & Location history from logs (or dedicated subcollections if you have them)
  const rawLogs = await readLogs(b.id);

  // Heuristics: treat logs with kind:"stage" or action in STAGE_ACTIONS as stages
  const STAGE_ACTIONS = new Set(["cuttings", "potting", "graded", "spaced", "ready", "rooted"]);
  const MOVE_ACTIONS = new Set(["move", "relocate"]);
  type StageSpan = { name: string; start?: AnyDate; end?: AnyDate };
  const stages: StageSpan[] = [];
  let currentStage: StageSpan | null = null;
  const locations: Array<{ name: string; start?: AnyDate; end?: AnyDate }> = [];
  let currentLoc: { name: string; start?: AnyDate; end?: AnyDate } | null = null;

  for (const l of rawLogs) {
    const at = toDate(l.at) ?? toDate(l.createdAt) ?? toDate(l.timestamp) ?? null;
    const kind = (l.kind || "").toString();
    const action = (l.action || l.type || "").toString().toLowerCase();

    if (kind === "stage" || STAGE_ACTIONS.has(action)) {
      // close previous
      if (currentStage) {
        currentStage.end = currentStage.end || at || currentStage.start;
        stages.push(currentStage); currentStage = null;
      }
      currentStage = { name: l.stageName || l.title || action, start: at || new Date() };
    }

    if (kind === "move" || MOVE_ACTIONS.has(action)) {
      if (currentLoc) { currentLoc.end = currentLoc.end || at || currentLoc.start; locations.push(currentLoc); currentLoc = null; }
      currentLoc = { name: l.locationName || l.to || l.location || l.title || "Move", start: at || new Date() };
    }
  }
  if (currentStage) { currentStage.end = currentStage.end || new Date(); stages.push(currentStage); }
  if (currentLoc)   { currentLoc.end = currentLoc.end || new Date(); locations.push(currentLoc); }

  // Convert stage spans to nodes/edges
  let prevStageNodeId: string | null = null;
  stages.forEach((s, i) => {
    const id = `stage:${b.id}:${i}`;
    const start = toDate(s.start)?.toISOString() ?? null;
    const end = toDate(s.end)?.toISOString() ?? null;
    const dur = daysBetween(s.start, s.end);
    nodes.push({ id, kind: "stage", batchId: b.id, stageName: s.name, label: s.name, start, end, durationDays: dur });
    if (prevStageNodeId) edges.push({ id: `e:${prevStageNodeId}->${id}`, from: prevStageNodeId, to: id, kind: "flow", label: dur != null ? `${dur}d` : "" });
    prevStageNodeId = id;
  });
  if (prevStageNodeId) edges.push({ id: `e:${batchNodeId}->${prevStageNodeId}`, from: batchNodeId, to: prevStageNodeId, kind: "flow", label: "" });

  // Moves as nodes chained
  let prevMoveId: string | null = null;
  locations.forEach((loc, i) => {
    const id = `move:${b.id}:${i}`;
    const start = toDate(loc.start)?.toISOString() ?? null;
    const end = toDate(loc.end)?.toISOString() ?? null;
    const dur = daysBetween(loc.start, loc.end);
    nodes.push({ id, kind: "move", batchId: b.id, locationName: loc.name, label: loc.name, start, end, durationDays: dur });
    if (prevMoveId) edges.push({ id: `e:${prevMoveId}->${id}`, from: prevMoveId, to: id, kind: "move", label: dur != null ? `${dur}d` : "" });
    prevMoveId = id;
  });
  if (prevMoveId) edges.push({ id: `e:${batchNodeId}->${prevMoveId}`, from: batchNodeId, to: prevMoveId, kind: "move", label: "" });

  // Normalize action logs for UI
  const logs: HistoryLog[] = rawLogs.map((l: any) => ({
    id: l.id,
    batchId: b.id,
    at: toDate(l.at || l.createdAt || l.timestamp)?.toISOString() ?? new Date().toISOString(),
    type: (l.action || l.type || l.kind || "action").toString().toLowerCase(),
    title: l.title || l.action || l.kind || "Action",
    details: l.notes || l.details || l.payload?.note || null,
    userId: l.userId || l.uid || null,
    userName: l.userName || l.user || null,
    media: Array.isArray(l.media) ? l.media.map((m: any) => ({ url: m.url || m, name: m.name || null })) : [],
  }));

  // Sort logs by time asc
  logs.sort((a, b) => +new Date(a.at) - +new Date(b.at));

  return {
    batch: { id: b.id, batchNumber: b.batchNumber, plantName: b.plantName, variety: b.variety, quantity: b.quantity, createdAt: b.createdAt },
    graph: { nodes, edges },
    logs,
  };
}
