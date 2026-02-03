// Batch Stock Constants
// Extracted from server action file to allow client-side imports

export type AdjustmentReason =
  | 'count_correction'
  | 'damage'
  | 'theft'
  | 'found'
  | 'transfer_in'
  | 'other';

export type LossReason =
  | 'pest_damage'
  | 'disease'
  | 'environmental'
  | 'quality_cull'
  | 'mechanical_damage'
  | 'other';

export const ADJUSTMENT_REASON_LABELS: Record<AdjustmentReason, string> = {
  count_correction: 'Count Correction',
  damage: 'Damage (subtract)',
  theft: 'Theft/Loss',
  found: 'Found/Recovered',
  transfer_in: 'Transfer In',
  other: 'Other',
};

export const LOSS_REASON_LABELS: Record<LossReason, string> = {
  pest_damage: 'Pest Damage',
  disease: 'Disease',
  environmental: 'Environmental (frost/heat/wind)',
  quality_cull: 'Quality Cull',
  mechanical_damage: 'Mechanical Damage',
  other: 'Other',
};
