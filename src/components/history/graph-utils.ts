// Lightweight ELK graph sanitizer for history flow.
export type ElkNode = { id?: string; batchId?: string; label?: string; [k: string]: any };
export type ElkEdge = { id?: string; source: string; target: string; [k: string]: any };
export type ElkGraph = { id?: string; children?: ElkNode[]; edges?: ElkEdge[]; [k: string]: any };

// --- NEW: id normalizers ----------------------------------------------------
function stripKnownPrefixes(raw: string): string {
  // Handle formats: 'batch:<id>', 'n_<id>', 'b_<id>' → '<id>'
  return String(raw)
    .replace(/^batch:/i, "")
    .replace(/^n_/, "")
    .replace(/^b_/, "")
    .trim();
}
function nodeId(raw: string) {
  const base = stripKnownPrefixes(raw);
  return `n_${base}`; // single canonical form used everywhere
}
function edgeId(raw: string) {
  return raw.startsWith("e_") ? raw : `e_${raw}`;
}

// --- sanitizer --------------------------------------------------------------
/**
 * Ensures:
 *  - graph.id present
 *  - every child node has canonical .id of form 'n_<base>'
 *  - edges use canonical node ids for source/target
 *  - if an edge references a missing node, we create a "ghost" node placeholder
 *  - optionally drops self-loops and fully invalid edges
 */
export function sanitizeElkGraph(input: ElkGraph): ElkGraph {
  const childrenIn = Array.isArray(input?.children) ? [...input.children] : [];
  const edgesIn = Array.isArray(input?.edges) ? [...input.edges] : [];

  const idMap = new Map<string, string>(); // base -> canonical node id
  const present = new Set<string>();       // canonical node ids present

  // 1) Canonicalize nodes and build lookup
  const children: ElkNode[] = childrenIn.map((n, idx) => {
    const base = stripKnownPrefixes(String(n.id ?? n.batchId ?? `idx_${idx}`));
    const id = nodeId(base);
    idMap.set(base, id);
    idMap.set(stripKnownPrefixes(String(n.id ?? "")), id);
    if (n.batchId) idMap.set(stripKnownPrefixes(String(n.batchId)), id);
    present.add(id);
    return { ...n, id };
  });

  // 2) Prepare edges; add ghost nodes for any missing endpoints
  const edges: ElkEdge[] = [];
  for (let idx = 0; idx < edgesIn.length; idx++) {
    const e = edgesIn[idx];
    const srcBase = stripKnownPrefixes(String(e.source ?? ""));
    const tgtBase = stripKnownPrefixes(String(e.target ?? ""));
    if (!srcBase || !tgtBase) continue; // drop invalid

    const source = idMap.get(srcBase) ?? nodeId(srcBase);
    const target = idMap.get(tgtBase) ?? nodeId(tgtBase);

    // Ghost nodes if missing
    if (!present.has(source)) {
      children.push({ id: source, label: `⟂ ${srcBase}`, ghost: true });
      present.add(source);
    }
    if (!present.has(target)) {
      children.push({ id: target, label: `⟂ ${tgtBase}`, ghost: true });
      present.add(target);
    }

    // Drop self-loops
    if (source === target) continue;

    const id = edgeId(String(e.id ?? `idx_${idx}`));
    edges.push({ ...e, id, source, target });
  }

  // 3) Root id (stable but not critical)
  const graphId = input.id ?? `g_${children.length}_${edges.length}`;

  return { ...input, id: graphId, children, edges };
}
