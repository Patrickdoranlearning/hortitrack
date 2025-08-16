import Link from "next/link";
import { buildBatchRoute } from "@/server/batches/route";
import { adminDb } from "@/server/db/admin";
import { LineageDiagram } from "@/components/batches/LineageDiagram";
import { HistoryTimeline } from "@/components/batches/HistoryTimeline";
import { GenerateProtocolButton } from "@/components/batches/GenerateProtocolButton";
import { notFound } from "next/navigation";

function normalizeId(raw: unknown): string | null {
  const s = typeof raw === "string" ? decodeURIComponent(raw).trim() : "";
  if (!s || s.includes("/")) return null; // Firestore doc ids cannot contain '/'
  return s;
}

async function getBatch(id: string) {
  const snap = await adminDb.collection("batches").doc(id).get();
  if (!snap.exists) return null;
  const d = snap.data() as any;
  return {
    id: snap.id,
    batchNumber: d.batchNumber,
    variety: d.plantVariety ?? d.variety ?? null,
    potSize: d.size ?? d.potSize ?? null,
    supplierName: d.supplier?.name ?? d.supplierName ?? d.vendorName ?? null,
    supplierId: d.supplier?.id ?? d.supplierId ?? d.vendorId ?? null,
  };
}

export default async function BatchHistoryPage({ params }: { params: { batchId: string } }) {
  const id = normalizeId(params?.batchId);
  if (!id) {
    console.warn("[history] invalid batch id param:", params?.batchId);
    notFound();
  }
  
  const batch = await getBatch(id!);
  if (!batch) {
    return (
      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-6">
        <h1 className="text-xl font-semibold mb-2">Batch history</h1>
        <p className="text-sm text-muted-foreground">Batch not found.</p>
        <Link href="/batches" className="underline mt-4 inline-block">Back to batches</Link>
      </main>
    );
  }

  const route = await buildBatchRoute(id!, 3);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 space-y-6 overflow-x-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">History — Batch {batch.batchNumber}</h1>
          <div className="text-sm text-muted-foreground truncate" title={batch.variety || ""}>{batch.variety || "Unknown variety"}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/batches`} className="btn btn-ghost px-3 py-2 rounded-lg border">Back</Link>
          <GenerateProtocolButton batchId={id!} defaultName={`Protocol – ${batch.variety || "Batch"} (${new Date().toISOString().slice(0,10)})`} />
        </div>
      </div>

      <section className="rounded-xl border bg-muted/10 p-4 sm:p-5">
        <h2 className="text-base font-semibold mb-3">Lineage</h2>
        {/* Details inside the Lineage section */}
        <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Supplier</div>
            <div className="font-medium">
              {batch.supplierName || "—"}
              {batch.supplierId ? <span className="text-muted-foreground font-normal ml-1">({batch.supplierId})</span> : null}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Pot size</div>
            <div className="font-medium">{batch.potSize ?? "—"}</div>
          </div>
        </div>
        <LineageDiagram ancestry={route.ancestry} />
      </section>

      <section className="rounded-xl border bg-muted/10 p-4 sm:p-5">
        <h2 className="text-base font-semibold mb-3">Timeline</h2>
        <HistoryTimeline items={route.timeline} />
      </section>
    </main>
  );
}
