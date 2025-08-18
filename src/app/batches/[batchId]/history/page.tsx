import { notFound } from "next/navigation";
import Link from "next/link";
import { buildBatchHistory } from "@/server/batches/history";
import { HistoryFlowchart } from "@/components/history/HistoryFlowchart";
import { HistoryLog } from "@/components/history/HistoryLog";
import { GenerateHistoryPdfButton } from "@/components/history/GenerateHistoryPdfButton";

function normalizeId(raw: unknown): string | null {
  const s = typeof raw === "string" ? decodeURIComponent(raw).trim() : "";
  if (!s || s.includes("/")) return null;
  return s;
}

export default async function BatchHistoryPage({ params }: { params: { batchId: string } }) {
  const id = normalizeId(params?.batchId);
  if (!id) notFound();

  const data = await buildBatchHistory(id!).catch(() => null);
  if (!data) {
    return (
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6">
        <h1 className="text-xl font-semibold mb-2">Batch history</h1>
        <p className="text-sm text-muted-foreground">Batch not found.</p>
        <Link href="/batches" className="underline mt-4 inline-block">Back to batches</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6 overflow-x-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold truncate">History — Batch {data.batch.batchNumber ?? data.batch.id}</h1>
          <div className="text-sm text-muted-foreground truncate">{data.batch.variety ?? data.batch.plantName ?? "—"}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/batches" className="px-3 py-2 rounded-lg border">Back</Link>
          <GenerateHistoryPdfButton batchId={id!} />
        </div>
      </div>

      {/* Flowchart */}
      <section className="rounded-xl border bg-muted/10 p-3 sm:p-5">
        <HistoryFlowchart data={data} />
      </section>

      {/* Action Log */}
      <section className="rounded-xl border bg-muted/10 p-3 sm:p-5">
        <HistoryLog logs={data.logs} />
      </section>
    </main>
  );
}
