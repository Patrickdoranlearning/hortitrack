/**
 * Shared Calculation Utilities
 *
 * Common calculation functions used by both main app and worker app.
 */

/**
 * Calculate total plants from container count and cell multiple
 *
 * @param containers - Number of containers (trays, pots, etc.)
 * @param cellMultiple - Number of cells/plants per container
 * @returns Total plant count
 */
export function calculateTotalPlants(
  containers: number,
  cellMultiple: number
): number {
  return containers * Math.max(1, cellMultiple);
}

/**
 * Calculate containers needed for a given plant quantity
 *
 * @param totalPlants - Desired number of plants
 * @param cellMultiple - Number of cells/plants per container
 * @returns Number of containers (rounded up)
 */
export function calculateContainersNeeded(
  totalPlants: number,
  cellMultiple: number
): number {
  const multiple = Math.max(1, cellMultiple);
  return Math.ceil(totalPlants / multiple);
}

/**
 * Calculate remainder plants after transplant
 *
 * @param parentQuantity - Plants available in parent batch
 * @param childQuantity - Plants being moved to child batch
 * @returns Remainder plants in parent
 */
export function calculateRemainder(
  parentQuantity: number,
  childQuantity: number
): number {
  return Math.max(0, parentQuantity - childQuantity);
}

/**
 * Check if there are sufficient plants for an operation
 *
 * @param available - Plants available
 * @param required - Plants required
 * @returns true if sufficient, false otherwise
 */
export function hasSufficientQuantity(
  available: number,
  required: number
): boolean {
  return available >= required;
}

/**
 * Format plant count for display with locale-aware formatting
 *
 * @param count - Plant count
 * @param locale - Locale string (default: 'en-IE')
 * @returns Formatted string (e.g., "1,234")
 */
export function formatPlantCount(count: number, locale = "en-IE"): string {
  return count.toLocaleString(locale);
}

/**
 * Calculate distribution percentages
 *
 * @param available - Available plants
 * @param allocated - Allocated plants
 * @param total - Total plants
 * @returns Object with percentages
 */
export function calculateDistribution(
  available: number,
  allocated: number,
  total: number
): { availablePercent: number; allocatedPercent: number } {
  if (total === 0) {
    return { availablePercent: 0, allocatedPercent: 0 };
  }
  return {
    availablePercent: Math.round((available / total) * 100),
    allocatedPercent: Math.round((allocated / total) * 100),
  };
}
