import type { VarietyBatchInfo } from './types';

/**
 * Low stock threshold for traffic light indicator
 * Green: qty > threshold
 * Orange: qty <= threshold and qty > 0
 */
export const LOW_STOCK_THRESHOLD = 100;

/**
 * Calculate variety-level status from its batches
 * Since B2B only shows available batches (filtered at query level),
 * traffic light indicates stock level and quality
 *
 * @param batches - Array of batch information for this variety
 * @returns 'plenty' | 'low' | 'out' status
 */
export function calculateVarietyStatus(
  batches: VarietyBatchInfo[]
): 'plenty' | 'low' | 'out' {
  // Calculate total available quantity
  const totalAvailableQty = batches.reduce(
    (sum, batch) => sum + batch.availableQty,
    0
  );

  // No stock available
  if (totalAvailableQty === 0 || batches.length === 0) {
    return 'out';
  }

  // Check if any batch has quality issues
  const hasQualityIssues = batches.some(
    (batch) => batch.qcStatus === 'quarantined' || batch.qcStatus === 'rejected'
  );

  // Low stock if below threshold
  if (totalAvailableQty <= LOW_STOCK_THRESHOLD) {
    return 'low';
  }

  // Plenty of stock with good quality
  return 'plenty';
}

/**
 * Get display properties for status badge
 * Returns color, label, and icon for each status
 */
export function getStatusDisplay(status: 'plenty' | 'low' | 'out') {
  switch (status) {
    case 'plenty':
      return {
        color: 'bg-green-500',
        bgColor: 'bg-green-50',
        textColor: 'text-green-700',
        borderColor: 'border-green-200',
        label: 'Plenty of Stock',
        icon: '●',
        description: 'Good stock levels',
      };
    case 'low':
      return {
        color: 'bg-orange-500',
        bgColor: 'bg-orange-50',
        textColor: 'text-orange-700',
        borderColor: 'border-orange-200',
        label: 'Low Stock',
        icon: '●',
        description: 'Stock running low',
      };
    case 'out':
      return {
        color: 'bg-red-500',
        bgColor: 'bg-red-50',
        textColor: 'text-red-700',
        borderColor: 'border-red-200',
        label: 'Out of Stock',
        icon: '●',
        description: 'No stock available',
      };
  }
}

/**
 * Format batch notes for display
 * Handles common batch status notes like "Blooming", "Budded", etc.
 */
export function formatBatchNotes(notes: string | null): string | null {
  if (!notes) return null;

  // Capitalize first letter
  return notes.charAt(0).toUpperCase() + notes.slice(1);
}

/**
 * Format planted date for display
 * Shows relative age or formatted date
 */
export function formatPlantedDate(plantedAt: string | null): string | null {
  if (!plantedAt) return null;

  try {
    const date = new Date(plantedAt);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 7) {
      return `${diffDays} days old`;
    } else if (diffDays < 60) {
      const weeks = Math.floor(diffDays / 7);
      return `${weeks} week${weeks > 1 ? 's' : ''} old`;
    } else {
      const months = Math.floor(diffDays / 30);
      return `${months} month${months > 1 ? 's' : ''} old`;
    }
  } catch {
    return null;
  }
}
