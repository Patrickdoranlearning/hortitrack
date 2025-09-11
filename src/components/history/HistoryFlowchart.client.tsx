"use client";
 
import dynamic from "next/dynamic";
import type { BatchHistory } from "@/server/batches/history";
 
const Flow = dynamic(() => import("./HistoryFlowchart"), {
   ssr: false,
   loading: () => (
     <div className="text-sm text-muted-foreground">Loading flowchart…</div>
   ),
});
 
export default function HistoryFlowchartClient(props: { batchId: string; data: BatchHistory }) {
  return <Flow {...props} />; // forwards batchId & data
}
