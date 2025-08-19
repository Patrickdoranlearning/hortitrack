// Lightweight ELK graph sanitizer for history flow.
export type ElkNode = { id?: string; [k: string]: any };
export type ElkEdge = { id?: string; source: string; target: string; [k: string]: any };
export type ElkGraph = { id?: string; children?: ElkNode[]; edges?: ElkEdge[]; [k: string]: any };

function prefixNode(idLike: string) {
  return idLike.startsWith("n_") ? idLike : `n_${idLike}`;
}
function prefixEdge(idLike: string) {
  return idLike.startsWith("e_") ? idLike : `e_${idLike}`;
}

/**
 * Ensures:
 *  - graph.id present
 *  - every child node has .id (uses node.id || node.batchId || index)
 *  - every edge has .id, and source/target reference normalized node ids
 */
export function sanitizeElkGraph(input: ElkGraph): ElkGraph {
  const childrenIn = Array.isArray(input?.children) ? input.children : [];
  const edgesIn = Array.isArray(input?.edges) ? input.edges : [];

  // Build nodes with guaranteed ids and a lookup map for id resolution
  const idMap = new Map<string, string>();
  const children = childrenIn.map((n, idx) => {
    const base = String(n.id ?? n.batchId ?? `idx_${idx}`);
    const id = prefixNode(base);
    // Map both raw base and an existing id (if any) to the normalized id
    idMap.set(base, id);
    if (n.id) idMap.set(String(n.id), id);
    if (n.batchId) idMap.set(String(n.batchId), id);
    return { ...n, id };
  });

  // Normalize edges
  const edges = edgesIn.map((e, idx) => {
    const id = prefixEdge(String(e.id ?? `idx_${idx}`));

    const srcRaw = String(e.source ?? "");
    const tgtRaw = String(e.target ?? "");

    const source =
      idMap.get(srcRaw) ??
      (srcRaw ? prefixNode(srcRaw) : prefixNode(`missing_source_${idx}`));

    const target =
      idMap.get(tgtRaw) ??
      (tgtRaw ? prefixNode(tgtRaw) : prefixNode(`missing_target_${idx}`));

    return { ...e, id, source, target };
  });

  // Root id
  const graphId =
    input.id ??
    `g_${children.length}_${edges.length}`;

  return { ...input, id: graphId, children, edges };
}
