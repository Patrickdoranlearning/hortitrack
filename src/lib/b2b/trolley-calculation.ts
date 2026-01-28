/**
 * B2B Trolley Calculation
 *
 * Simple per-product trolley calculation based on each product's trolleyQuantity.
 * Each product contributes a fraction based on: quantity / trolleyQuantity.
 * Fractions from all products sum to give total trolleys.
 *
 * Example:
 * - 120 x 1L Heathers (trolleyQuantity=240) = 0.5 trolleys
 * - 144 x 1.5L Heathers (trolleyQuantity=288) = 0.5 trolleys
 * - Total: 1.0 trolleys (full)
 */

export type B2BTrolleyLine = {
  quantity: number;
  trolleyQuantity: number | null;
  sizeName?: string | null;
};

export type B2BTrolleySuggestion = {
  sizeName: string;
  trolleyQuantity: number;
  unitsCanFit: number;
};

export type B2BTrolleyResult = {
  /** Total trolleys as decimal (e.g., 1.4) */
  totalTrolleys: number;
  /** Fill percentage of current trolley (0-100) */
  currentFillPercent: number;
  /** Display string (e.g., "1.4") */
  displayValue: string;
  /** Fraction of trolley remaining (0-1) */
  remainingFraction: number;
  /** Suggestions for what else fits */
  suggestions: B2BTrolleySuggestion[];
  /** Lines that couldn't be calculated (no trolleyQuantity) */
  linesWithoutQuantity: number;
};

/**
 * Calculate trolley fill based on per-product trolleyQuantity.
 *
 * @param lines - Cart items with quantity and trolleyQuantity
 * @param availableProducts - Products available for suggestions (optional)
 * @returns Trolley calculation result
 */
export function calculateB2BTrolleys(
  lines: B2BTrolleyLine[],
  availableProducts?: Array<{ sizeName: string | null; trolleyQuantity: number | null }>
): B2BTrolleyResult {
  let totalTrolleys = 0;
  let linesWithoutQuantity = 0;

  // Calculate total trolleys from all lines
  for (const line of lines) {
    if (line.quantity <= 0) continue;

    if (line.trolleyQuantity && line.trolleyQuantity > 0) {
      totalTrolleys += line.quantity / line.trolleyQuantity;
    } else {
      // Track lines we can't calculate
      linesWithoutQuantity++;
    }
  }

  // Calculate remaining capacity
  const wholeTrolleys = Math.floor(totalTrolleys);
  const partialFill = totalTrolleys - wholeTrolleys;

  // Round partial fill to 1 decimal to match display value (0.66 → 0.7)
  const displayPartialFill = Math.round(partialFill * 10) / 10;

  // When trolley is exactly full (1.0, 2.0, etc.), show 100% not 0%
  // Use rounded value for percentage to be consistent with display
  const currentFillPercent = displayPartialFill === 0 && totalTrolleys > 0
    ? 100
    : Math.round(displayPartialFill * 100);

  // Remaining fraction: 0 when full, 1 when empty, otherwise (1 - partialFill)
  const remainingFraction = totalTrolleys === 0
    ? 1
    : partialFill === 0
      ? 0
      : 1 - partialFill;

  // Generate suggestions for what else fits
  const suggestions: B2BTrolleySuggestion[] = [];

  if (availableProducts && remainingFraction > 0) {
    // Group products by size to get unique sizes with their trolleyQuantity
    const sizeMap = new Map<string, number>();

    for (const product of availableProducts) {
      if (product.sizeName && product.trolleyQuantity && product.trolleyQuantity > 0) {
        // Keep the highest trolleyQuantity for each size (in case of variation)
        const existing = sizeMap.get(product.sizeName);
        if (!existing || product.trolleyQuantity > existing) {
          sizeMap.set(product.sizeName, product.trolleyQuantity);
        }
      }
    }

    // Calculate how many units of each size would fit
    for (const [sizeName, trolleyQuantity] of sizeMap) {
      const unitsCanFit = Math.floor(remainingFraction * trolleyQuantity);
      if (unitsCanFit > 0) {
        suggestions.push({ sizeName, trolleyQuantity, unitsCanFit });
      }
    }

    // Sort by units that can fit (most first)
    suggestions.sort((a, b) => b.unitsCanFit - a.unitsCanFit);
  }

  // Format display value
  const displayValue = totalTrolleys > 0 ? totalTrolleys.toFixed(1) : '0';

  return {
    totalTrolleys,
    currentFillPercent,
    displayValue,
    remainingFraction,
    suggestions: suggestions.slice(0, 3), // Top 3 suggestions
    linesWithoutQuantity,
  };
}
