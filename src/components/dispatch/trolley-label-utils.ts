// src/components/dispatch/trolley-label-utils.ts

/**
 * Generates the datamatrix payload for a trolley label
 * Format: HT:<orgId>:<orderId>:<timestamp>
 */
export function generateTrolleyLabelCode(orgId: string, orderId: string): string {
  const timestamp = Date.now().toString(36); // Base36 for shorter string
  return `HT:${orgId.slice(0, 8)}:${orderId.slice(0, 8)}:${timestamp}`;
}
