import type { PlantVariety, PlantSize, Supplier } from '@/lib/referenceData/types';

// ─── Shared Extraction Types ────────────────────────────────────────────────
// Both PDF (AI) and CSV (direct parse) paths produce this format.

export type OrderLineItem = {
  quantity: number;
  variety_name: string;
  genus?: string;
  species?: string;
  cultivar?: string;
  size_description: string;
  cell_multiple?: number;
  container_type?: string;
  unit_price?: number;
  line_total?: number;
};

export type OrderExtraction = {
  supplier_name: string | null;
  order_reference: string | null;
  document_date: string | null; // YYYY-MM-DD
  line_items: OrderLineItem[];
  total_amount: number | null;
};

// ─── Matched Result Types ───────────────────────────────────────────────────

export type MatchConfidence = 'exact' | 'high' | 'low' | 'none';

export type MatchedLineItem = {
  extracted_variety_name: string;
  extracted_size: string;
  extracted_quantity: number;
  unit_price?: number;
  line_total?: number;
  matched_variety_id: string | null;
  matched_variety_name: string | null;
  matched_variety_family: string | null;
  variety_match_confidence: MatchConfidence;
  matched_size_id: string | null;
  matched_size_name: string | null;
  size_match_confidence: MatchConfidence;
};

export type MatchedExtraction = {
  extracted_supplier_name: string | null;
  matched_supplier_id: string | null;
  matched_supplier_name: string | null;
  order_reference: string | null;
  expected_date: string | null;
  line_items: MatchedLineItem[];
  total_items: number;
  matched_items: number;
  needs_review_items: number;
};

// ─── Normalisation Helpers ──────────────────────────────────────────────────

function normalizeVarietyName(name: string): string {
  return name
    .replace(/[''`\u2018\u2019]/g, "'")
    .replace(/[""\u201C\u201D]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ─── Variety Matching (4-pass) ──────────────────────────────────────────────

function matchVariety(
  item: OrderLineItem,
  varieties: PlantVariety[]
): { id: string | null; name: string | null; family: string | null; confidence: MatchConfidence } {
  const normalized = normalizeVarietyName(item.variety_name);
  const noMatch = { id: null, name: null, family: null, confidence: 'none' as const };

  if (!normalized) return noMatch;

  // Pass 1: Exact name match (case-insensitive, normalised quotes)
  const exact = varieties.find(
    (v) => normalizeVarietyName(v.name) === normalized
  );
  if (exact) return { id: exact.id, name: exact.name, family: exact.family, confidence: 'exact' };

  // Pass 2: Genus + cultivar match
  if (item.genus) {
    const genusLower = item.genus.toLowerCase();
    const cultivarLower = item.cultivar?.toLowerCase();

    const genusMatches = varieties.filter((v) => {
      const vGenus = v.genus?.toLowerCase();
      if (vGenus === genusLower) return true;
      return normalizeVarietyName(v.name).startsWith(genusLower);
    });

    if (cultivarLower && genusMatches.length > 0) {
      const cultivarMatch = genusMatches.find((v) =>
        normalizeVarietyName(v.name).includes(cultivarLower)
      );
      if (cultivarMatch) {
        return { id: cultivarMatch.id, name: cultivarMatch.name, family: cultivarMatch.family, confidence: 'high' };
      }
    }
  }

  // Pass 3: Substring containment
  const substringMatch = varieties.find((v) => {
    const vNorm = normalizeVarietyName(v.name);
    return vNorm.includes(normalized) || normalized.includes(vNorm);
  });
  if (substringMatch) {
    return { id: substringMatch.id, name: substringMatch.name, family: substringMatch.family, confidence: 'low' };
  }

  // Pass 4: Word overlap scoring
  const extractedWords = normalized.split(/\s+/).filter((w) => w.length > 2);
  if (extractedWords.length >= 2) {
    let bestScore = 0;
    let bestVariety: PlantVariety | null = null;

    for (const v of varieties) {
      const vWords = normalizeVarietyName(v.name).split(/\s+/);
      const overlap = extractedWords.filter((w) =>
        vWords.some((vw) => vw.includes(w) || w.includes(vw))
      ).length;
      const score = overlap / Math.max(extractedWords.length, vWords.length);
      if (score > bestScore && score >= 0.5) {
        bestScore = score;
        bestVariety = v;
      }
    }

    if (bestVariety) {
      return { id: bestVariety.id, name: bestVariety.name, family: bestVariety.family, confidence: 'low' };
    }
  }

  return noMatch;
}

// ─── Size Matching ──────────────────────────────────────────────────────────

function matchSize(
  item: OrderLineItem,
  sizes: PlantSize[]
): { id: string | null; name: string | null; confidence: MatchConfidence } {
  const noMatch = { id: null, name: null, confidence: 'none' as const };

  // Match by cell_multiple + container_type
  if (item.cell_multiple) {
    const exactMatch = sizes.find(
      (s) =>
        s.cell_multiple === item.cell_multiple &&
        (item.container_type
          ? s.container_type.toLowerCase() === item.container_type.toLowerCase()
          : true)
    );
    if (exactMatch) return { id: exactMatch.id, name: exactMatch.name, confidence: 'exact' };

    // Relax: just cell_multiple
    const cellMatch = sizes.find((s) => s.cell_multiple === item.cell_multiple);
    if (cellMatch) return { id: cellMatch.id, name: cellMatch.name, confidence: 'high' };
  }

  // Parse size_description for a number as fallback
  const numMatch = item.size_description.match(/(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    const sizeMatch = sizes.find((s) => s.cell_multiple === num);
    if (sizeMatch) return { id: sizeMatch.id, name: sizeMatch.name, confidence: 'high' };
  }

  return noMatch;
}

// ─── Supplier Matching ──────────────────────────────────────────────────────

function matchSupplier(
  extractedName: string | null,
  suppliers: Supplier[]
): { id: string | null; name: string | null } {
  const noMatch = { id: null, name: null };
  if (!extractedName) return noMatch;

  const normalized = extractedName.toLowerCase().trim();

  // Exact match
  const exact = suppliers.find(
    (s) => s.name.toLowerCase().trim() === normalized
  );
  if (exact) return { id: exact.id, name: exact.name };

  // Substring match
  const partial = suppliers.find(
    (s) =>
      s.name.toLowerCase().includes(normalized) ||
      normalized.includes(s.name.toLowerCase())
  );
  if (partial) return { id: partial.id, name: partial.name };

  return noMatch;
}

// ─── Main Matching Entry Point ──────────────────────────────────────────────

export function matchExtraction(
  extraction: OrderExtraction,
  refData: { varieties: PlantVariety[]; sizes: PlantSize[]; suppliers: Supplier[] }
): MatchedExtraction {
  const supplierResult = matchSupplier(extraction.supplier_name, refData.suppliers);

  const matchedItems: MatchedLineItem[] = extraction.line_items.map((item) => {
    const varietyResult = matchVariety(item, refData.varieties);
    const sizeResult = matchSize(item, refData.sizes);

    return {
      extracted_variety_name: item.variety_name,
      extracted_size: item.size_description,
      extracted_quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      matched_variety_id: varietyResult.id,
      matched_variety_name: varietyResult.name,
      matched_variety_family: varietyResult.family,
      variety_match_confidence: varietyResult.confidence,
      matched_size_id: sizeResult.id,
      matched_size_name: sizeResult.name,
      size_match_confidence: sizeResult.confidence,
    };
  });

  const fullyMatched = matchedItems.filter(
    (i) =>
      (i.variety_match_confidence === 'exact' || i.variety_match_confidence === 'high') &&
      (i.size_match_confidence === 'exact' || i.size_match_confidence === 'high')
  ).length;

  return {
    extracted_supplier_name: extraction.supplier_name,
    matched_supplier_id: supplierResult.id,
    matched_supplier_name: supplierResult.name,
    order_reference: extraction.order_reference,
    expected_date: extraction.document_date,
    line_items: matchedItems,
    total_items: matchedItems.length,
    matched_items: fullyMatched,
    needs_review_items: matchedItems.length - fullyMatched,
  };
}
