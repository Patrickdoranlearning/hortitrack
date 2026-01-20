// Graph layout helper used by HistoryFlowchart.
import type { ElkNode, ElkExtendedEdge } from 'elkjs';

// ElkGraph is the root element (an ElkNode with children and edges)
type ElkGraph = ElkNode;

/**
 * Computes layout using ELK in the browser.
 * Loaded dynamically to avoid SSR and bundling issues.
 */
export async function layoutGraph(
  graph: ElkGraph,
): Promise<ElkGraph> {
  // Dynamically import elkjs on the client
  const ELK = (await import("elkjs/lib/elk.bundled.js")).default;
  const elk = new ELK({
    defaultLayoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.layered.spacing.nodeNodeBetweenLayers": "48",
        "elk.spacing.nodeNode": "24",
    }
  });

  const res = await elk.layout(graph);

  return res;
}
