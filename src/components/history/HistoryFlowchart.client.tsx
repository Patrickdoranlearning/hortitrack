"use client";

import dynamic from "next/dynamic";

const Flow = dynamic(() => import("./HistoryFlowchart"), {
  ssr: false,
  loading: () => (
    <div className="text-sm text-muted-foreground">Loading flowchart…</div>
  ),
});

export default function HistoryFlowchartClient(props: { batchId: string }) {
  return <Flow {...props} />;
}
