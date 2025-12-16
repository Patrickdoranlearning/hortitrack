/**
 * Trolley Capacity Calculation Utilities
 *
 * Calculates estimated trolleys needed for orders based on:
 * - Plant family + pot size → shelves per trolley
 * - Pot size → units per shelf (shelf_quantity from plant_sizes)
 * - Standard trolley has 33 hole positions for shelf placement
 */

// ================================================
// CONSTANTS
// ================================================

export const TROLLEY_CONSTANTS = {
  /** Standard trolley height: 33 hole positions */
  STANDARD_HOLES: 33,
  /** Extended trolley height: ~42 holes */
  EXTENDED_HOLES: 42,
  /** Default shelves per trolley when no config exists */
  DEFAULT_SHELVES_PER_TROLLEY: 6,
  /** Minimum shelves (very tall plants) */
  MIN_SHELVES: 1,
  /** Maximum shelves (propagation trays) */
  MAX_SHELVES: 16,
} as const;

// ================================================
// TYPES
// ================================================

/**
 * Configuration for trolley capacity by family + size combination
 */
export type TrolleyCapacityConfig = {
  family: string | null;
  sizeId: string | null;
  shelvesPerTrolley: number;
};

/**
 * Order line data needed for trolley calculation
 */
export type OrderLineForCalculation = {
  sizeId: string;
  family: string | null;
  quantity: number;
  /** Units per shelf from plant_sizes.shelf_quantity */
  shelfQuantity: number;
};

/**
 * Breakdown of trolley usage per order line
 */
export type TrolleyLineBreakdown = {
  sizeId: string;
  family: string | null;
  quantity: number;
  shelfQuantity: number;
  shelvesNeeded: number;
  holesPerShelf: number;
  holesUsed: number;
  shelvesPerTrolley: number;
};

/**
 * Result of trolley calculation
 */
export type TrolleyCalculationResult = {
  /** Total trolleys needed (rounded up) */
  totalTrolleys: number;
  /** Total holes used across all products */
  totalHolesUsed: number;
  /** Holes used on the current (last) trolley */
  currentTrolleyHolesUsed: number;
  /** Holes remaining on the current trolley */
  holesRemaining: number;
  /** Per-line breakdown */
  breakdown: TrolleyLineBreakdown[];
};

/**
 * Suggestion for what else fits on the trolley
 */
export type RemainingCapacitySuggestion = {
  sizeName: string;
  sizeId: string;
  shelvesCanFit: number;
  unitsCanFit: number;
};

// ================================================
// CORE CALCULATION FUNCTIONS
// ================================================

/**
 * Find the best matching capacity config for a family + size combination.
 *
 * Priority order:
 * 1. Exact match (family + size)
 * 2. Family only (size = null) - default for this family
 * 3. Size only (family = null) - default for this size
 * 4. Global default (both null)
 * 5. Fallback to DEFAULT_SHELVES_PER_TROLLEY
 */
export function findCapacityConfig(
  configs: TrolleyCapacityConfig[],
  family: string | null,
  sizeId: string
): TrolleyCapacityConfig | null {
  // Priority 1: Exact match (family + size)
  const exactMatch = configs.find(
    (c) => c.family === family && c.sizeId === sizeId
  );
  if (exactMatch) return exactMatch;

  // Priority 2: Family only (size = null)
  if (family) {
    const familyOnly = configs.find(
      (c) => c.family === family && c.sizeId === null
    );
    if (familyOnly) return familyOnly;
  }

  // Priority 3: Size only (family = null)
  const sizeOnly = configs.find(
    (c) => c.family === null && c.sizeId === sizeId
  );
  if (sizeOnly) return sizeOnly;

  // Priority 4: Global default (both null)
  const globalDefault = configs.find(
    (c) => c.family === null && c.sizeId === null
  );
  if (globalDefault) return globalDefault;

  return null;
}

/**
 * Calculate the number of trolleys needed for a set of order lines.
 *
 * Formula:
 * - holes_per_shelf = ceil(33 / shelves_per_trolley)
 * - shelves_needed = ceil(quantity / shelf_quantity)
 * - holes_used = shelves_needed * holes_per_shelf
 * - total_trolleys = ceil(total_holes_used / 33)
 */
export function calculateTrolleysNeeded(
  lines: OrderLineForCalculation[],
  configs: TrolleyCapacityConfig[]
): TrolleyCalculationResult {
  if (lines.length === 0) {
    return {
      totalTrolleys: 0,
      totalHolesUsed: 0,
      currentTrolleyHolesUsed: 0,
      holesRemaining: TROLLEY_CONSTANTS.STANDARD_HOLES,
      breakdown: [],
    };
  }

  let totalHolesUsed = 0;
  const breakdown: TrolleyLineBreakdown[] = [];

  for (const line of lines) {
    // Skip lines with no quantity
    if (line.quantity <= 0) continue;

    // Find the matching config for this family + size
    const config = findCapacityConfig(configs, line.family, line.sizeId);
    const shelvesPerTrolley =
      config?.shelvesPerTrolley ?? TROLLEY_CONSTANTS.DEFAULT_SHELVES_PER_TROLLEY;

    // Calculate holes per shelf: ceil(33 / shelves_per_trolley)
    const holesPerShelf = Math.ceil(
      TROLLEY_CONSTANTS.STANDARD_HOLES / shelvesPerTrolley
    );

    // Calculate shelves needed for this quantity
    // shelf_quantity is how many units fit on one shelf
    const shelfQuantity = line.shelfQuantity || 1;
    const shelvesNeeded = Math.ceil(line.quantity / shelfQuantity);

    // Calculate holes used for this line
    const holesUsed = shelvesNeeded * holesPerShelf;
    totalHolesUsed += holesUsed;

    breakdown.push({
      sizeId: line.sizeId,
      family: line.family,
      quantity: line.quantity,
      shelfQuantity,
      shelvesNeeded,
      holesPerShelf,
      holesUsed,
      shelvesPerTrolley,
    });
  }

  // Calculate total trolleys needed
  const totalTrolleys = Math.ceil(
    totalHolesUsed / TROLLEY_CONSTANTS.STANDARD_HOLES
  );

  // Calculate remaining capacity on the current trolley
  const currentTrolleyHolesUsed =
    totalHolesUsed % TROLLEY_CONSTANTS.STANDARD_HOLES ||
    (totalHolesUsed > 0 ? TROLLEY_CONSTANTS.STANDARD_HOLES : 0);
  const holesRemaining =
    totalHolesUsed > 0
      ? TROLLEY_CONSTANTS.STANDARD_HOLES - (totalHolesUsed % TROLLEY_CONSTANTS.STANDARD_HOLES) ||
        0
      : TROLLEY_CONSTANTS.STANDARD_HOLES;

  return {
    totalTrolleys,
    totalHolesUsed,
    currentTrolleyHolesUsed:
      totalHolesUsed % TROLLEY_CONSTANTS.STANDARD_HOLES ||
      (totalTrolleys > 0 ? TROLLEY_CONSTANTS.STANDARD_HOLES : 0),
    holesRemaining:
      holesRemaining === TROLLEY_CONSTANTS.STANDARD_HOLES && totalTrolleys > 0
        ? 0
        : holesRemaining,
    breakdown,
  };
}

/**
 * Get suggestions for what else can fit on the current trolley.
 */
export function getRemainingCapacitySuggestions(
  holesRemaining: number,
  availableSizes: Array<{
    sizeId: string;
    sizeName: string;
    shelfQuantity: number;
  }>,
  configs: TrolleyCapacityConfig[],
  currentFamily?: string | null
): RemainingCapacitySuggestion[] {
  if (holesRemaining <= 0) return [];

  const suggestions: RemainingCapacitySuggestion[] = [];

  for (const size of availableSizes) {
    // Find config for this size (using current family context if available)
    const config = findCapacityConfig(configs, currentFamily ?? null, size.sizeId);
    const shelvesPerTrolley =
      config?.shelvesPerTrolley ?? TROLLEY_CONSTANTS.DEFAULT_SHELVES_PER_TROLLEY;

    const holesPerShelf = Math.ceil(
      TROLLEY_CONSTANTS.STANDARD_HOLES / shelvesPerTrolley
    );

    // How many shelves can fit in remaining space?
    const shelvesCanFit = Math.floor(holesRemaining / holesPerShelf);

    if (shelvesCanFit > 0) {
      suggestions.push({
        sizeId: size.sizeId,
        sizeName: size.sizeName,
        shelvesCanFit,
        unitsCanFit: shelvesCanFit * (size.shelfQuantity || 1),
      });
    }
  }

  // Sort by units that can fit (most first)
  return suggestions.sort((a, b) => b.unitsCanFit - a.unitsCanFit);
}

/**
 * Calculate fill percentage for display
 */
export function calculateFillPercentage(
  holesUsed: number,
  totalHoles: number = TROLLEY_CONSTANTS.STANDARD_HOLES
): number {
  if (totalHoles <= 0) return 0;
  const percentage = Math.round((holesUsed / totalHoles) * 100);
  return Math.min(100, Math.max(0, percentage));
}

/**
 * Format trolley summary for display
 */
export function formatTrolleySummary(result: TrolleyCalculationResult): string {
  if (result.totalTrolleys === 0) {
    return "No trolleys needed";
  }

  if (result.totalTrolleys === 1) {
    const fillPct = calculateFillPercentage(result.currentTrolleyHolesUsed);
    return `1 trolley (${fillPct}% full)`;
  }

  const lastTrolleyFill = calculateFillPercentage(
    result.currentTrolleyHolesUsed
  );
  return `${result.totalTrolleys} trolleys (last one ${lastTrolleyFill}% full)`;
}
