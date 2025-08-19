
'use server';

import { adminDb } from "@/server/db/admin";
import { isValidDocId } from "@/server/util/ids";

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
};

type AnyDate = Date | string | number | null | undefined;
const toDate = (v: AnyDate) => {
  if (!v) return null;
  // Handle Firestore Timestamps
  if (typeof v === "object" && (v as any).toDate) {
    return (v as any).toDate() as Date;
  }
  const d = new Date(v as any);
  return isFinite(d.getTime()) ? d : null;
};
const daysBetween = (a?: AnyDate, b?: AnyDate) => {
  const d1 = toDate(a), d2 = toDate(b);
  if (!d1 || !d2) return null;
  return Math.max(0, Math.round((+d2 - +d1) / 86400000));
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
  meta?: Record<string, any>;
};

export type HistoryEdge = {
  id: string;
  from: string;
  to: string;
  label?: string;
  kind: "flow" | "split" | "merge" | "move";
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
    parentBatchId: d.transplantedFrom ?? null, // Use transplantedFrom for lineage
    composition: Array.isArray(d.composition) ? d.composition : [],
  };
}


async function readChildren(batchNumber: string) {
    if (!batchNumber) return [];
    const q = adminDb.collection("batches").where("transplantedFrom", "==", batchNumber);
    const qs = await q.limit(20).get().catch(() => ({ empty: true, docs: [] } as any));
    return qs.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
}

async function readLogs(id: string) {
  const logHistory = (await adminDb.collection("batches").doc(id).get()).data()?.logHistory || [];
  return logHistory.map((l: any, i: number) => ({ id: l.id || `log-${i}`, ...l }));
}


export async function buildBatchHistory(rootId: string): Promise<BatchHistory> {
  if (!isValidDocId(rootId)) {
    throw new Error("Invalid batch ID provided.");
  }
  const b = await readBatch(rootId);
  if (!b) throw new Error("Batch not found");

  const nodes: HistoryNode[] = [];
  const edges: HistoryEdge[] = [];
  
  nodes.push({ id: `batch:${b.id}`, kind: "batch", batchId: b.id, label: `Batch ${b.batchNumber ?? b.id}`, meta: { variety: b.variety } });

  if (b.parentBatchId) {
    const parentSnap = await adminDb.collection('batches').where('batchNumber', '==', b.parentBatchId).limit(1).get();
    if (!parentSnap.empty) {
        const parent = await readBatch(parentSnap.docs[0].id);
        if (parent) {
             const pNodeId = `batch:${parent.id}`;
             nodes.push({ id: pNodeId, kind: "batch", batchId: parent.id, label: `Batch ${parent.batchNumber ?? parent.id}`, meta: { variety: parent.variety } });
             edges.push({ id: `e:${pNodeId}->batch:${b.id}`, from: pNodeId, to: `batch:${b.id}`, kind: "flow", label: "transplant" });
        }
    }
  }

  const kids = await readChildren(b.batchNumber!);
  if (kids.length > 0) {
    const splitId = `split:${b.id}`;
    nodes.push({ id: splitId, kind: "split", batchId: b.id, label: `Split (${kids.length})` });
    edges.push({ id: `e:batch:${b.id}->${splitId}`, from: `batch:${b.id}`, to: splitId, kind: "split", label: "split" });
    for (const c of kids) {
      const cNodeId = `batch:${c.id}`;
      nodes.push({ id: cNodeId, kind: "batch", batchId: c.id, label: `Batch ${c.batchNumber ?? c.id}` });
      edges.push({ id: `e:${splitId}->${cNodeId}`, from: splitId, to: cNodeId, kind: "split", label: "→" });
    }
  }

  const rawLogs = await readLogs(b.id);

  const STAGE_ACTIONS = new Set(["cuttings", "potting", "graded", "spaced", "ready", "rooted", "create"]);
  const MOVE_ACTIONS = new Set(["move", "relocate"]);
  type StageSpan = { name: string; start?: AnyDate; end?: AnyDate };
  const stages: StageSpan[] = [];
  let currentStage: StageSpan | null = null;

  for (const l of rawLogs) {
    const at = toDate(l.at || l.date) ?? new Date();
    const action = (l.type || l.action || "action").toString().toLowerCase();

    if (STAGE_ACTIONS.has(action)) {
      if (currentStage) {
        currentStage.end = currentStage.end || at || currentStage.start;
        stages.push(currentStage);
      }
      currentStage = { name: l.note || l.type || action, start: at };
    }
    
    if (l.newLocation && MOVE_ACTIONS.has(action)) {
        // This logic is simplified; a full location history would need its own spans
    }
  }
  if (currentStage) {
    currentStage.end = currentStage.end || new Date();
    stages.push(currentStage);
  }

  let prevStageNodeId: string | null = `batch:${b.id}`;
  stages.forEach((s, i) => {
    const id = `stage:${b.id}:${i}`;
    const start = toDate(s.start)?.toISOString() ?? null;
    const end = toDate(s.end)?.toISOString() ?? null;
    const dur = daysBetween(s.start, s.end);
    nodes.push({ id, kind: "stage", batchId: b.id, stageName: s.name, label: s.name, start, end, durationDays: dur });
    if (prevStageNodeId) {
      edges.push({ id: `e:${prevStageNodeId}->${id}`, from: prevStageNodeId, to: id, kind: "flow", label: dur != null ? `${dur}d` : "" });
    }
    prevStageNodeId = id;
  });

  const logs: HistoryLog[] = rawLogs.map((l: any) => ({
    id: l.id,
    batchId: b.id,
    at: toDate(l.at || l.date)?.toISOString() ?? new Date().toISOString(),
    type: (l.type || l.action || "action").toString().toLowerCase(),
    title: l.note || l.type || l.action || "Action Log",
    details: l.details || null,
    userId: l.userId || l.uid || null,
    userName: l.userName || l.user || null,
    media: l.photoUrl ? [{url: l.photoUrl, name: 'photo'}] : [],
  }));
  logs.sort((a, b) => +new Date(a.at) - +new Date(b.at));

  return {
    batch: { id: b.id, batchNumber: b.batchNumber, plantName: b.plantName, variety: b.variety, quantity: b.quantity, createdAt: b.createdAt },
    graph: { nodes, edges },
    logs,
  };
}
