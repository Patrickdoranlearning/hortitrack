import ELK from "elkjs";

export type LayoutNode = { id: string; width?: number; height?: number; labels?: { text: string }[]; };
export type LayoutEdge = { id: string; sources: string[]; targets: string[]; labels?: { text: string }[]; };
export type LayoutResult = { children: Array<LayoutNode & { x?: number; y?: number }>; edges: Array<LayoutEdge & { sections?: any[] }>; };

const elk = new ELK();

export async function layoutGraph(nodes: LayoutNode[], edges: LayoutEdge[], direction: "RIGHT" | "DOWN" = "RIGHT"): Promise<LayoutResult> {
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": direction,
      "elk.layered.spacing.nodeNodeBetweenLayers": "48",
      "elk.spacing.nodeNode": "32",
      "elk.layered.crossingMinimization.semiInteractive": "true",
    },
    children: nodes.map(n => ({ id: n.id, width: n.width ?? 200, height: n.height ?? 80, labels: n.labels ?? [{ text: n.id }] })),
    edges: edges.map(e => ({ id: e.id, sources: e.sources, targets: e.targets, labels: e.labels })),
  } as any;

  try {
    const res = await elk.layout(graph);
    return { children: res.children ?? [], edges: res.edges ?? [] };
  } catch (e) {
    // Fallback: simple linear layout
    return {
      children: nodes.map((n, i) => ({ ...n, x: 40 + i * 240, y: 40 })),
      edges: edges,
    } as any;
  }
}
