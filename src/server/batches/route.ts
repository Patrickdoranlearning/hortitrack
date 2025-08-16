import { adminDb } from "@/server/db/admin";

type AnyDate = Date | string | number | null | undefined;
const toDate = (v: AnyDate) => (v ? new Date(v as any) : null);

function isoWeek(d: Date) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((dt.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: dt.getUTCFullYear(), week: weekNo };
}
const weekLabel = (d: AnyDate) => {
  const dd = toDate(d);
  if (!dd) return null;
  const { year, week } = isoWeek(dd);
  return `${year}-W${String(week).padStart(2, "0")}`;
};

export type BatchNode = {
  id: string;
  batchNumber?: string | number | null;
  plantVariety?: string | null;
  sowDate?: string | null;
  plantingDate?: string | null;
  producedAt?: string | null;
};

export type BatchEdge = {
  from: string;
  to: string;
  action: "transplant" | "split" | "propagate" | "move" | "produce" | "unknown";
  at?: string | null;
  week?: string | null;
  notes?: string | null;
};

export type BatchRoute = {
  ancestry: Array<{ level: number; node: BatchNode; via?: BatchEdge | null }>;
  edges: BatchEdge[];
  nodes: Record<string, BatchNode>;
  timeline: Array<{ at?: string | null; week?: string | null; action: string; batchId: string; note?: string }>;
  summary: {
    transplantWeek?: string | null;
    previousProducedWeek?: string | null;
    originBatchId?: string | null;
    hops: number;
  };
};

async function readBatch(id: string): Promise<BatchNode | null> {
  const snap = await adminDb.collection("batches").doc(id).get();
  if (!snap.exists) return null;
  const d = snap.data() || {};
  return {
    id: snap.id,
    batchNumber: d.batchNumber ?? null,
    plantVariety: d.plantVariety ?? d.variety ?? null,
    sowDate: d.sowDate ?? null,
    plantingDate: d.plantingDate ?? null,
    producedAt: d.producedAt ?? d.harvestDate ?? null,
  };
}

async function readLogs(id: string) {
  return adminDb
    .collection("batches").doc(id).collection("logs")
    .orderBy("at", "asc").limit(1000).get()
    .catch(() => ({ empty: true, docs: [] } as any));
}

function findParentCandidate(batchDoc: any, logs: FirebaseFirestore.QuerySnapshot) {
  const explicit = batchDoc?.parentBatchId || batchDoc?.sourceBatchId || batchDoc?.previousBatchId || null;
  let fromLog: string | null = null;
  for (const doc of logs.docs) {
    const ev = doc.data() as any;
    if (ev?.kind === "action" && ["transplant", "split", "propagate", "move"].includes(ev.action)) {
      fromLog = ev?.fromBatchId || ev?.sourceBatchId || null;
      if (fromLog) break;
    }
  }
  return (explicit as string) || fromLog || null;
}

export async function buildBatchRoute(batchId: string, maxDepth = 3): Promise<BatchRoute> {
  const nodes: Record<string, BatchNode> = {};
  const edges: BatchEdge[] = [];
  const ancestry: BatchRoute["ancestry"] = [];
  const timeline: BatchRoute["timeline"] = [];

  let currentId: string | null = batchId;
  let level = 0;
  let originBatchId: string | null = null;
  let transplantWeek: string | null = null;
  let previousProducedWeek: string | null = null;

  while (currentId && level <= maxDepth) {
    const batchSnap = await adminDb.collection("batches").doc(currentId).get();
    if (!batchSnap.exists) break;
    const batchDoc = batchSnap.data() || {};
    const node = await readBatch(currentId);
    if (node) nodes[currentId] = node;

    const logs = await readLogs(currentId);

    if (node?.sowDate) timeline.push({ at: node.sowDate, week: weekLabel(node.sowDate), action: "sow", batchId: currentId });
    if (node?.plantingDate) timeline.push({ at: node.plantingDate, week: weekLabel(node.plantingDate), action: "plant", batchId: currentId });

    for (const doc of logs.docs) {
      const ev = doc.data() as any;
      if (ev?.kind === "action") {
        const wk = weekLabel(ev?.at);
        timeline.push({ at: ev?.at ?? null, week: wk, action: String(ev.action || "action"), batchId: currentId, note: ev?.notes || ev?.payload?.note });
        if (!transplantWeek && String(ev.action) === "transplant") transplantWeek = wk || transplantWeek;
        if (!previousProducedWeek && String(ev.action).match(/produce|harvest/)) previousProducedWeek = wk || previousProducedWeek;
      }
    }

    const parentId = findParentCandidate(batchDoc, logs);
    const viaEdge: BatchEdge | null = parentId
      ? {
          from: parentId,
          to: currentId,
          action: "transplant",
          at: batchDoc?.transplantedAt || (logs.docs.find((d) => (d.data() as any)?.action === "transplant")?.data() as any)?.at || null,
          week: weekLabel(batchDoc?.transplantedAt || (logs.docs.find((d) => (d.data() as any)?.action === "transplant")?.data() as any)?.at || null),
          notes: null,
        }
      : null;

    ancestry.push({ level, node: node!, via: viaEdge });
    if (viaEdge) edges.push(viaEdge);

    if (!parentId) { originBatchId = originBatchId || currentId; break; }
    currentId = parentId;
    level += 1;
  }

  timeline.sort((a, b) => {
    if (!a.at && !b.at) return 0;
    if (!a.at) return 1;
    if (!b.at) return -1;
    return new Date(a.at!).getTime() - new Date(b.at!).getTime();
  });

  return {
    ancestry,
    edges,
    nodes,
    timeline,
    summary: { transplantWeek, previousProducedWeek, originBatchId: originBatchId || null, hops: ancestry.length - 1 },
  };
}
