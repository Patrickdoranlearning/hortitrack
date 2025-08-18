// Graph layout helper used by HistoryFlowchart.
// NOTE: No top-level import of 'elkjs'. We dynamic-import it in the browser.

export type ElkEdge = {
  id: string;
  sources: string[];
  targets: string[];
};

export type ElkNode = {
  id: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  children?: ElkNode[];
  edges?: ElkEdge[];
  [key: string]: any;
};

export type ElkGraph = ElkNode;

/**
 * Computes layout using ELK in the browser.
 * Loaded dynamically to avoid SSR and bundling issues.
 */
export async function layoutGraph(
  graph: ElkGraph,
  options?: Record<string, any>
): Promise<ElkGraph> {
  // Dynamically import elkjs on the client
  const ELK = (await import("elkjs")).default as any;
  const elk = new ELK({
    // Do NOT set workerUrl here; default path avoids extra requires.
  });

  const layoutOptions = {
    "elk.algorithm": "layered",
    "elk.direction": "RIGHT",
    "elk.layered.spacing.nodeNodeBetweenLayers": "48",
    "elk.spacing.nodeNode": "24",
    ...(options?.layoutOptions || {}),
  };

  const res = await elk.layout(
    {
      id: graph.id ?? "root",
      children: graph.children ?? [],
      edges: graph.edges ?? [],
    },
    { layoutOptions }
  );

  return res;
}
