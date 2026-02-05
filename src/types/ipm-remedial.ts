/**
 * IPM Remedial Programs Types
 *
 * Types for pest/disease-targeted remedial treatment programs.
 * These programs are triggered during scouting when issues are found.
 */

import type { IpmProduct } from '@/app/actions/ipm';

// ============================================================================
// Core Entity Types
// ============================================================================

/**
 * A remedial program - treatment protocol for a specific pest/disease
 */
export type IpmRemedialProgram = {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  targetPestDisease: string;
  severityApplicability: string[];  // ['low', 'medium', 'critical']
  treatmentDurationDays: number;
  treatmentUrgency: 'immediate' | 'standard';
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  // Joined data
  steps?: IpmRemedialStep[];
  stepCount?: number;
  productNames?: string[];
};

/**
 * A step within a remedial program
 */
export type IpmRemedialStep = {
  id: string;
  programId: string;
  stepOrder: number;
  dayOffset: number;  // Days from treatment start (0, 7, 14, etc.)
  productId: string;
  rate?: number;
  rateUnit?: string;
  method?: string;
  notes?: string;
  createdAt: string;
  // Joined data
  product?: IpmProduct;
};

/**
 * An applied remedial treatment - tracks progress of a program instance
 */
export type IpmRemedialApplication = {
  id: string;
  orgId: string;
  programId: string;
  triggeredByLogId?: string;
  targetType: 'batch' | 'location';
  targetBatchId?: string;
  targetLocationId?: string;
  startedAt: string;
  expectedCompletion?: string;
  status: 'active' | 'completed' | 'cancelled';
  stepsCompleted: number;
  totalSteps: number;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  // Joined data
  program?: IpmRemedialProgram;
  batch?: { id: string; batchNumber: string };
  location?: { id: string; name: string };
  applicationSteps?: IpmRemedialApplicationStep[];
};

/**
 * Individual step tracking for an applied remedial treatment
 */
export type IpmRemedialApplicationStep = {
  id: string;
  applicationId: string;
  stepId: string;
  dueDate: string;
  completedAt?: string;
  completedBy?: string;
  plantHealthLogId?: string;
  notes?: string;
  createdAt: string;
  // Joined data
  step?: IpmRemedialStep;
};

// ============================================================================
// View Types
// ============================================================================

/**
 * Aggregated program view with product info - for listing/selection
 */
export type RemedialProgramByPest = {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  targetPestDisease: string;
  severityApplicability: string[];
  treatmentDurationDays: number;
  treatmentUrgency: 'immediate' | 'standard';
  isActive: boolean;
  createdAt: string;
  stepCount: number;
  productNames: string[];
  productIds: string[];
};

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for creating/updating a remedial program
 */
export type IpmRemedialProgramInput = {
  name: string;
  description?: string;
  targetPestDisease: string;
  severityApplicability?: string[];
  treatmentDurationDays?: number;
  treatmentUrgency?: 'immediate' | 'standard';
  isActive?: boolean;
  steps: IpmRemedialStepInput[];
};

/**
 * Input for a step within a remedial program
 */
export type IpmRemedialStepInput = {
  productId: string;
  dayOffset: number;
  rate?: number;
  rateUnit?: string;
  method?: string;
  notes?: string;
};

/**
 * Input for applying a remedial program (creating an application)
 */
export type ApplyRemedialProgramInput = {
  programId: string;
  triggeredByLogId?: string;
  targetType: 'batch' | 'location';
  targetBatchId?: string;
  targetLocationId?: string;
  notes?: string;
};

/**
 * Input for completing a step in an application
 */
export type CompleteRemedialStepInput = {
  applicationStepId: string;
  notes?: string;
};

// ============================================================================
// Result Types
// ============================================================================

/**
 * Standard result type for remedial program operations
 */
export type IpmRemedialResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Filters for listing remedial programs
 */
export type RemedialProgramFilters = {
  pest?: string;
  severity?: string;
  urgency?: 'immediate' | 'standard';
  activeOnly?: boolean;
};

/**
 * Filters for listing remedial applications
 */
export type RemedialApplicationFilters = {
  status?: 'active' | 'completed' | 'cancelled';
  programId?: string;
  batchId?: string;
  locationId?: string;
};
