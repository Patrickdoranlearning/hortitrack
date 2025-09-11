type AncestryItem = {
  level: number;
  node: {
    id: string;
    batchNumber?: string | number | null;
    plantVariety?: string | null;
    plantingDate?: string | null;
    sowDate?: string | null;
    potSize?: string | number | null;
    supplierName?: string | null;
    supplierId?: string | null;
  };
  via?: { action?: string; week?: string | null } | null;
};

export function LineageDiagram({ ancestry }: { ancestry: AncestryItem[] }) {
  if (!Array.isArray(ancestry) || ancestry.length === 0) {
    return <div className="text-sm text-muted-foreground">No lineage information.</div>;
  }
  // Oldest on the left
  const nodes = [...ancestry].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  const n = nodes.length;
  const boxW = 220;
  const boxH = 104;
  const gap = 36;
  const width = n * boxW + (n - 1) * gap + 24;
  const height = 140;

  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} role="img" aria-label="Batch lineage flow">
        {nodes.map((a, i) => {
          const x = 12 + i * (boxW + gap);
          const y = 28;
          const tag = a.level === 0 ? "Current" : `Batch -${a.level}`;
          const node = a.node || {};
          const header = `#${node.batchNumber ?? node.id}`;
          const sub = node.plantVariety ?? "";
          const sub2 = node.plantingDate ? `Planted ${node.plantingDate?.slice(0, 10)}` : (node.sowDate ? `Sowed ${node.sowDate?.slice(0, 10)}` : "");
          const sub3 = node.potSize != null ? `Pot: ${String(node.potSize)}` : "";
          const supplier =
            node.supplierName ? `Supplier: ${node.supplierName}${node.supplierId ? ` (${node.supplierId})` : ""}` : "";

          return (
            <g key={i}>
              {/* Arrow to next */}
              {i < n - 1 && (
                <>
                  <line x1={x + boxW + 4} y1={y + boxH / 2} x2={x + boxW + gap - 12} y2={y + boxH / 2} stroke="#666" strokeWidth={1} />
                  <polyline points={`${x + boxW + gap - 12},${y + boxH / 2} ${x + boxW + gap - 18},${y + boxH / 2 + 4} ${x + boxW + gap - 18},${y + boxH / 2 - 4}`} fill="none" stroke="#666" strokeWidth={1} />
                  {nodes[i + 1].via?.action && (
                    <text x={x + boxW + 8} y={y + boxH / 2 - 8} fontSize={11} fill="#444">
                      {(nodes[i + 1].via!.action || "") + (nodes[i + 1].via!.week ? ` @ ${nodes[i + 1].via!.week}` : "")}
                    </text>
                  )}
                </>
              )}
              {/* Box */}
              <rect x={x} y={y} width={boxW} height={boxH} fill="#fff" stroke="#aaa" rx="8" />
              <text x={x + 10} y={y + 16} fontSize={11} fontWeight="bold" fill="#111">{tag}</text>
              <text x={x + 10} y={y + 32} fontSize={13} fill="#000">{header}</text>
              {sub ? <text x={x + 10} y={y + 48} fontSize={11} fill="#444">{sub}</text> : null}
              {sub2 ? <text x={x + 10} y={y + 62} fontSize={10} fill="#666">{sub2}</text> : null}
              {sub3 ? <text x={x + 10} y={y + 74} fontSize={10} fill="#666">{sub3}</text> : null}
              {supplier ? <text x={x + 10} y={y + 88} fontSize={10} fill="#666">
                {supplier.length > 40 ? supplier.slice(0, 39) + "…" : supplier}
              </text> : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
