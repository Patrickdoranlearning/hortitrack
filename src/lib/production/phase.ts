// src/lib/production/phase.ts
// Infer phase from size metadata (best-effort until sizes carry explicit phase).
// DB: plant_sizes.container_type ('pot'|'tray'), cell_multiple >=1. :contentReference[oaicite:8]{index=8}
export type ProductionPhase = "propagation" | "plug" | "potted";

export function inferPhase(opts: { containerType: "pot" | "tray"; cellMultiple: number }): ProductionPhase {
  if (opts.containerType === "pot") return "potted";
  // Heuristic: very high multiples are propagation trays; lower multiples are plug/liner.
  if (opts.cellMultiple >= 150) return "propagation";
  return "plug";
}
