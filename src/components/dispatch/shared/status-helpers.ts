/**
 * Shared status helper functions for dispatch components
 * Re-exports from centralized types for convenience
 */

import { getStatusPillColor, STATUS_PILL_COLORS } from '@/lib/dispatch/types';

export function getStatusColor(stage: string): string {
  // Use centralized colors with dark mode support
  const baseColor = getStatusPillColor(stage);
  // Add dark mode variants
  switch (stage) {
    case 'to_pick':
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    case 'picking':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'ready_to_load':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'on_route':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'delivered':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

export function getStageLabel(stage: string): string {
  switch (stage) {
    case 'to_pick':
      return 'To Pick';
    case 'picking':
      return 'Picking';
    case 'ready_to_load':
      return 'Ready';
    case 'on_route':
      return 'On Route';
    case 'delivered':
      return 'Delivered';
    default:
      return stage;
  }
}

export function getFillColor(percentage: number): string {
  if (percentage >= 90) return 'text-red-600';
  if (percentage >= 70) return 'text-yellow-600';
  return 'text-green-600';
}

// Re-export the centralized color helpers for direct use
export { getStatusPillColor, STATUS_PILL_COLORS };
