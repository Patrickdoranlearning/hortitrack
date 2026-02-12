import { parse } from 'csv-parse/sync';
import type { OrderExtraction, OrderLineItem } from './match-extraction';

// ─── Column Detection Maps ──────────────────────────────────────────────────

const QUANTITY_ALIASES = [
  'aantal', 'quantity', 'qty', 'amount', 'count', 'stuks', 'pcs', 'units',
];
const VARIETY_ALIASES = [
  'omschrijving', 'description', 'variety', 'plant', 'product', 'name',
  'cultivar', 'item', 'artikel', 'soort',
];
const SIZE_ALIASES = [
  'maat', 'size', 'tray', 'pot', 'container', 'formaat', 'potmaat',
];
const UNIT_PRICE_ALIASES = [
  'p./stuk', 'prijs', 'price', 'unit_price', 'unitprice', 'stuksprijs',
  'prijs/stuk', 'price_each', 'eenheidsprijs',
];
const LINE_TOTAL_ALIASES = [
  'bedrag', 'total', 'amount', 'line_total', 'totaal', 'subtotal',
  'subtotaal', 'regeltotaal',
];
const REFERENCE_ALIASES = [
  'ref', 'reference', 'order', 'bestelling', 'ordernr', 'order_number',
  'referentie', 'po', 'po_number',
];

// ─── Column Detection ───────────────────────────────────────────────────────

type ColumnMap = {
  quantity: string | null;
  variety: string | null;
  size: string | null;
  unit_price: string | null;
  line_total: string | null;
  reference: string | null;
};

function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {
    quantity: null,
    variety: null,
    size: null,
    unit_price: null,
    line_total: null,
    reference: null,
  };

  const normalised = headers.map((h) => h.toLowerCase().trim());

  for (let i = 0; i < normalised.length; i++) {
    const h = normalised[i];
    const original = headers[i];

    if (!map.quantity && QUANTITY_ALIASES.some((a) => h.includes(a))) {
      map.quantity = original;
    } else if (!map.variety && VARIETY_ALIASES.some((a) => h.includes(a))) {
      map.variety = original;
    } else if (!map.size && SIZE_ALIASES.some((a) => h.includes(a))) {
      map.size = original;
    } else if (!map.unit_price && UNIT_PRICE_ALIASES.some((a) => h.includes(a))) {
      map.unit_price = original;
    } else if (!map.line_total && LINE_TOTAL_ALIASES.some((a) => h.includes(a))) {
      map.line_total = original;
    } else if (!map.reference && REFERENCE_ALIASES.some((a) => h.includes(a))) {
      map.reference = original;
    }
  }

  return map;
}

// ─── Parsing Helpers ────────────────────────────────────────────────────────

function parseNumber(val: string | undefined | null): number | undefined {
  if (!val) return undefined;
  // Handle European number format (comma as decimal, period as thousands)
  const cleaned = val.replace(/[^\d,.\-]/g, '');
  // If it has both . and ,: determine which is decimal
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // "1.234,56" → 1234.56 (European)
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
    }
    // "1,234.56" → 1234.56 (US)
    return parseFloat(cleaned.replace(/,/g, ''));
  }
  // If only comma: treat as decimal separator
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return parseFloat(cleaned.replace(',', '.'));
  }
  return parseFloat(cleaned) || undefined;
}

function parseSize(sizeStr: string): { cell_multiple?: number; container_type?: string } {
  const numMatch = sizeStr.match(/(\d+)/);
  const cell_multiple = numMatch ? parseInt(numMatch[1], 10) : undefined;

  let container_type: string | undefined;
  const lower = sizeStr.toLowerCase();
  if (lower.includes('tray') || lower.includes('gts') || lower.includes('plug')) {
    container_type = 'tray';
  } else if (lower.includes('pot') || lower.includes('liter') || lower.includes('cm')) {
    container_type = 'pot';
  }

  return { cell_multiple, container_type };
}

function parseVarietyParts(name: string): {
  genus?: string;
  species?: string;
  cultivar?: string;
} {
  // Try to extract cultivar from quotes: "Erica carnea 'Challenger'"
  const cultivarMatch = name.match(/[''""]([^''""\u2018\u2019\u201C\u201D]+)[''""\u2018\u2019\u201C\u201D]/);
  const cultivar = cultivarMatch ? cultivarMatch[1].trim() : undefined;

  // Extract genus and species from the botanical part
  const cleaned = name.replace(/[''""\u2018\u2019\u201C\u201D][^''""\u2018\u2019\u201C\u201D]+[''""\u2018\u2019\u201C\u201D]/, '').trim();
  const words = cleaned.split(/\s+/);

  return {
    genus: words[0] || undefined,
    species: words[1] || undefined,
    cultivar,
  };
}

// ─── Main CSV Parser ────────────────────────────────────────────────────────

export function parseOrderCsv(csvText: string): OrderExtraction {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  if (records.length === 0) {
    throw new Error('CSV file is empty or has no data rows');
  }

  // Detect columns from headers
  const headers = Object.keys(records[0]);
  const columnMap = detectColumns(headers);

  if (!columnMap.variety) {
    throw new Error(
      'Could not detect a variety/description column. ' +
        `Found headers: ${headers.join(', ')}. ` +
        'Expected one of: ' + VARIETY_ALIASES.join(', ')
    );
  }

  if (!columnMap.quantity) {
    throw new Error(
      'Could not detect a quantity column. ' +
        `Found headers: ${headers.join(', ')}. ` +
        'Expected one of: ' + QUANTITY_ALIASES.join(', ')
    );
  }

  // Parse line items
  const line_items: OrderLineItem[] = [];

  for (const row of records) {
    const varietyName = row[columnMap.variety!]?.trim();
    if (!varietyName) continue; // Skip empty rows

    const qtyRaw = row[columnMap.quantity!];
    const qty = parseNumber(qtyRaw);
    if (!qty || qty <= 0) continue; // Skip rows without valid quantity

    const sizeRaw = columnMap.size ? (row[columnMap.size] ?? '') : '';
    const sizeInfo = parseSize(sizeRaw);
    const varietyParts = parseVarietyParts(varietyName);

    line_items.push({
      quantity: Math.round(qty),
      variety_name: varietyName,
      genus: varietyParts.genus,
      species: varietyParts.species,
      cultivar: varietyParts.cultivar,
      size_description: sizeRaw,
      cell_multiple: sizeInfo.cell_multiple,
      container_type: sizeInfo.container_type,
      unit_price: columnMap.unit_price ? parseNumber(row[columnMap.unit_price]) : undefined,
      line_total: columnMap.line_total ? parseNumber(row[columnMap.line_total]) : undefined,
    });
  }

  if (line_items.length === 0) {
    throw new Error('No valid line items found in CSV');
  }

  // Try to extract a reference from the first row if a reference column exists
  const orderRef = columnMap.reference
    ? records[0][columnMap.reference]?.trim() || null
    : null;

  return {
    supplier_name: null, // CSV typically doesn't contain supplier info in the data rows
    order_reference: orderRef,
    document_date: null, // CSV typically doesn't contain date info
    line_items,
    total_amount: null,
  };
}
