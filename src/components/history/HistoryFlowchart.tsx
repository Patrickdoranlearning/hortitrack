"use client";

import * as React from "react";
import { layoutGraph } from "@/server/batches/graphLayout";
import type { BatchHistory } from "@/server/batches/history";

const icon = (kind: string) => {
  switch (kind) {
    case "batch": return "🪴";
    case "stage": return "📋";
    case "move":  return "📦";
    case "split": return "🔀";
    case "merge": return "➕";
    default: return "•";
  }
};

type GraphLike = BatchHistory["graph"] | undefined;
type Props = {
  batchId: string;
  data?: BatchHistory;
};

function buildNodes(graph: GraphLike) {
  const list = Array.isArray(graph?.nodes) ? graph.nodes : [];
  return list.map(n => ({
    id: n.id,
    width: 220,
    height: 96,
    labels: [{ text: n.label }],
  }));
}

function buildEdges(graph: GraphLike) {
  const list = Array.isArray(graph?.edges) ? graph.edges : [];
  return list.map(e => ({
    id: e.id,
    sources: [e.from],
    targets: [e.to],
    labels: e.label ? [{ text: e.label }] : [],
  }));
}

export default function HistoryFlowchart({ batchId, data }: Props) {
  const [highlight, setHighlight] = React.useState<string | null>(null);

  const graph: GraphLike = data?.graph;
  const nodes = React.useMemo(() => buildNodes(graph), [graph?.nodes]);
  const edges = React.useMemo(() => buildEdges(graph), [graph?.edges]);

  const [layout, setLayout] = React.useState<any | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setError(null);
    const safeNodes = (nodes ?? []);
    const safeEdges = (edges ?? []);
    if (safeNodes.length || safeEdges.length) {
        let alive = true;
        layoutGraph({ children: safeNodes, edges: safeEdges })
            .then((res) => { if (alive) setLayout(res); })
            .catch((e: any) => { if(alive) setError(e?.message ?? String(e))});
        return () => { alive = false; };
    } else {
      setLayout(null);
    }
  }, [nodes, edges]);

  if (error) {
    return <div className="text-sm text-red-600">Failed to render flow: {error}</div>;
  }
  if (!layout) {
    return <div className="text-sm text-muted-foreground">No history yet.</div>;
  }
  
  const width  = Math.max(320, Math.max(...layout.children.map((c: any) => (c.x || 0) + (c.width || 0))) + 40);
  const height = Math.max(120, Math.max(...layout.children.map((c: any) => (c.y || 0) + (c.height || 0))) + 40);
  const layoutEdges = layout.edges || [];

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Batch journey flowchart">
        {/* edges */}
        {layoutEdges.map((e: any) => (e.sections || []).map((s: any, idx: number) => (
          <g key={`${e.id}:${idx}`} opacity={highlight && !e.id.includes(highlight) ? 0.4 : 1}>
            <path d={`M ${s.startPoint.x} ${s.startPoint.y} ${s.bendPoints?.map((p: any) => `L ${p.x} ${p.y}`).join(" ") ?? ""} L ${s.endPoint.x} ${s.endPoint.y}`} stroke="#777" strokeWidth="1.2" fill="none" />
            {(e.labels || []).map((l: any, i: number) => (
              <text key={i} x={(s.startPoint.x + s.endPoint.x) / 2} y={(s.startPoint.y + s.endPoint.y) / 2 - 6} fontSize={11} fill="#444">{l.text}</text>
            ))}
          </g>
        )))}

        {/* nodes */}
        {layout.children.map((n: any) => {
          const origin = { x: n.x || 0, y: n.y || 0 };
          const dataNode = graph?.nodes.find(x => x.id === n.id);
          if (!dataNode) return null;
          
          const muted = highlight && highlight !== dataNode.batchId;

          return (
            <g key={n.id} transform={`translate(${origin.x},${origin.y})`} cursor="pointer"
              onClick={() => setHighlight(dataNode.batchId)}
              onMouseEnter={() => setHighlight(dataNode.batchId)}
              onMouseLeave={() => setHighlight(null)}>
              <rect width={n.width} height={n.height} rx="12" fill="#fff" stroke={muted ? "#BBB" : "#888"} strokeWidth="1.2" />
              <text x={10} y={18} fontSize={12} fontWeight="bold">{icon(dataNode.kind)} {n.labels?.[0]?.text}</text>
              {dataNode.stageName ? <text x={10} y={36} fontSize={11} fill="#333">{dataNode.stageName}</text> : null}
              {dataNode.locationName ? <text x={10} y={36} fontSize={11} fill="#333">{dataNode.locationName}</text> : null}
              {dataNode.start && <text x={10} y={54} fontSize={10} fill="#666">Start: {dataNode.start.slice(0,10)}</text>}
              {dataNode.end   && <text x={10} y={68} fontSize={10} fill="#666">End: {dataNode.end.slice(0,10)}</text>}
              {dataNode.durationDays != null && <text x={10} y={84} fontSize={11} fill="#111">⏱ {dataNode.durationDays} days</text>}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 text-xs text-muted-foreground">Tip: hover/click a card to filter the action log to that batch/stage.</div>
    </div>
  );
}
