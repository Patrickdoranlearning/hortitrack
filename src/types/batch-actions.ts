import { z } from "zod";

/**
 * Batch Actions Type Definitions
 *
 * Two-Flow Approach:
 * 1. Apply Treatment (regulated) - Chemical, Fertilizer - uses existing flow
 * 2. Log Action (operational) - Simple batch actions with minimal compliance burden
 */

// ============================================================================
// Operational Action Categories
// ============================================================================

export type OperationalActionCategory = 'care' | 'operation';

/**
 * Simple care actions - no compliance burden
 * These are day-to-day maintenance activities
 */
export type CareActionType = 'irrigation' | 'pruning' | 'grading' | 'mechanical';

/**
 * Batch operation actions - inventory/location changes
 */
export type OperationActionType = 'move' | 'dump';

/**
 * All operational actions (excludes regulated: chemical, fertilizer)
 */
export type OperationalActionType = CareActionType | OperationActionType;

// ============================================================================
// Sub-Types for Specific Actions
// ============================================================================

/**
 * Irrigation methods
 */
export const IrrigationMethodSchema = z.enum([
  'drip',
  'overhead',
  'hand',
  'flood',
  'mist'
]);
export type IrrigationMethod = z.infer<typeof IrrigationMethodSchema>;

export const IRRIGATION_METHODS: Record<IrrigationMethod, string> = {
  drip: 'Drip Irrigation',
  overhead: 'Overhead',
  hand: 'Hand Watering',
  flood: 'Flood/Ebb',
  mist: 'Misting',
};

/**
 * Pruning types
 */
export const PruningTypeSchema = z.enum([
  'tip',
  'shape',
  'deadhead',
  'thin',
  'pinch',
  'root'
]);
export type PruningType = z.infer<typeof PruningTypeSchema>;

export const PRUNING_TYPES: Record<PruningType, string> = {
  tip: 'Tip Pruning',
  shape: 'Shape Pruning',
  deadhead: 'Deadheading',
  thin: 'Thinning',
  pinch: 'Pinching',
  root: 'Root Pruning',
};

/**
 * Quality grades for grading action
 */
export const QualityGradeSchema = z.enum([
  'premium',
  'standard',
  'economy',
  'reject'
]);
export type QualityGrade = z.infer<typeof QualityGradeSchema>;

export const QUALITY_GRADES: Record<QualityGrade, { label: string; color: string }> = {
  premium: { label: 'Premium', color: 'text-green-600' },
  standard: { label: 'Standard', color: 'text-blue-600' },
  economy: { label: 'Economy', color: 'text-amber-600' },
  reject: { label: 'Reject', color: 'text-red-600' },
};

/**
 * Mechanical action types
 */
export const MechanicalActionTypeSchema = z.enum([
  'trimming',
  'spacing',
  'weeding',
  'removing',
  'staking',
  'labeling'
]);
export type MechanicalActionType = z.infer<typeof MechanicalActionTypeSchema>;

export const MECHANICAL_ACTION_TYPES: Record<MechanicalActionType, string> = {
  trimming: 'Trimming',
  spacing: 'Spacing',
  weeding: 'Weeding',
  removing: 'Removing Dead/Damaged',
  staking: 'Staking/Support',
  labeling: 'Labeling',
};

/**
 * Dump reasons - why plants were lost/removed
 */
export const DumpReasonSchema = z.enum([
  'mortality',
  'disease',
  'quality_reject',
  'breakage',
  'old_stock',
  'other'
]);
export type DumpReason = z.infer<typeof DumpReasonSchema>;

export const DUMP_REASONS: Record<DumpReason, string> = {
  mortality: 'Mortality',
  disease: 'Disease/Pest Damage',
  quality_reject: 'Quality Reject',
  breakage: 'Lost/Breakage',
  old_stock: 'Old Stock',
  other: 'Other',
};

// ============================================================================
// Action Metadata
// ============================================================================

export const ACTION_META: Record<OperationalActionType, {
  label: string;
  icon: string; // Lucide icon name
  category: OperationalActionCategory;
  description: string;
}> = {
  irrigation: {
    label: 'Irrigation',
    icon: 'Droplets',
    category: 'care',
    description: 'Water or adjust irrigation',
  },
  pruning: {
    label: 'Pruning',
    icon: 'Scissors',
    category: 'care',
    description: 'Prune or trim plants',
  },
  grading: {
    label: 'Grading',
    icon: 'Star',
    category: 'care',
    description: 'Grade batch quality',
  },
  mechanical: {
    label: 'Mechanical',
    icon: 'Wrench',
    category: 'care',
    description: 'Trimming, spacing, weeding',
  },
  move: {
    label: 'Move Batch',
    icon: 'MapPin',
    category: 'operation',
    description: 'Move to different location',
  },
  dump: {
    label: 'Log Dump/Loss',
    icon: 'Trash2',
    category: 'operation',
    description: 'Record waste or loss',
  },
};

// ============================================================================
// Form Schemas
// ============================================================================

/**
 * Irrigation form input
 */
export const IrrigationFormSchema = z.object({
  method: IrrigationMethodSchema,
  durationMinutes: z.coerce.number().int().min(1).max(480).optional(),
  notes: z.string().max(500).optional(),
});
export type IrrigationFormInput = z.infer<typeof IrrigationFormSchema>;

/**
 * Pruning form input
 */
export const PruningFormSchema = z.object({
  pruningType: PruningTypeSchema,
  notes: z.string().max(500).optional(),
  photoUrl: z.string().url().optional(),
});
export type PruningFormInput = z.infer<typeof PruningFormSchema>;

/**
 * Grading form input
 */
export const GradingFormSchema = z.object({
  grade: QualityGradeSchema,
  percentagePremium: z.coerce.number().int().min(0).max(100).optional(),
  percentageStandard: z.coerce.number().int().min(0).max(100).optional(),
  percentageEconomy: z.coerce.number().int().min(0).max(100).optional(),
  percentageReject: z.coerce.number().int().min(0).max(100).optional(),
  notes: z.string().max(500).optional(),
});
export type GradingFormInput = z.infer<typeof GradingFormSchema>;

/**
 * Mechanical action form input
 */
export const MechanicalFormSchema = z.object({
  actionType: MechanicalActionTypeSchema,
  notes: z.string().max(500).optional(),
});
export type MechanicalFormInput = z.infer<typeof MechanicalFormSchema>;

// ============================================================================
// Combined Log Action Input
// ============================================================================

/**
 * Union type for all operational action inputs
 */
export type LogActionInput =
  | { actionType: 'irrigation'; data: IrrigationFormInput; batchId: string }
  | { actionType: 'pruning'; data: PruningFormInput; batchId: string }
  | { actionType: 'grading'; data: GradingFormInput; batchId: string }
  | { actionType: 'mechanical'; data: MechanicalFormInput; batchId: string }
  | { actionType: 'move'; batchId: string; locationId: string; notes?: string }
  | { actionType: 'dump'; batchId: string; units: number; reason: string; notes?: string; archiveIfEmpty?: boolean };

/**
 * Wizard state for the Log Action Wizard
 */
export type LogActionWizardState = {
  step: 'select' | 'form' | 'confirm';
  selectedAction: OperationalActionType | null;
  formData: LogActionInput | null;
};
