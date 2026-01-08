import { z } from 'zod';

// Enums
export const TrialStatus = z.enum(['draft', 'active', 'paused', 'completed', 'archived']);
export type TrialStatus = z.infer<typeof TrialStatus>;

export const GroupType = z.enum(['control', 'treatment']);
export type GroupType = z.infer<typeof GroupType>;

export const FindingType = z.enum(['observation', 'conclusion', 'recommendation', 'action_item']);
export type FindingType = z.infer<typeof FindingType>;

export const FindingStatus = z.enum(['draft', 'reviewed', 'approved', 'implemented']);
export type FindingStatus = z.infer<typeof FindingStatus>;

export const TreatmentType = z.enum(['ipm', 'material', 'protocol', 'custom']);
export type TreatmentType = z.infer<typeof TreatmentType>;

export const QualityGrade = z.enum(['A', 'B', 'C', 'cull']);
export type QualityGrade = z.infer<typeof QualityGrade>;

// Strategy Schema (JSONB structure for trial group)
export const IpmProductStrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  rate: z.number().optional(),
  rateUnit: z.string().optional(),
  method: z.string().optional(),
  frequency: z.string().optional(),
});
export type IpmProductStrategy = z.infer<typeof IpmProductStrategySchema>;

export const MaterialStrategySchema = z.object({
  id: z.string(),
  name: z.string(),
  rate: z.number().optional(),
  rateUnit: z.string().optional(),
  application: z.string().optional(),
});
export type MaterialStrategy = z.infer<typeof MaterialStrategySchema>;

export const CustomTreatmentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  frequency: z.string().optional(),
});
export type CustomTreatment = z.infer<typeof CustomTreatmentSchema>;

export const GroupStrategySchema = z.object({
  ipmProducts: z.array(IpmProductStrategySchema).optional(),
  materials: z.array(MaterialStrategySchema).optional(),
  protocolId: z.string().optional(),
  customTreatments: z.array(CustomTreatmentSchema).optional(),
});
export type GroupStrategy = z.infer<typeof GroupStrategySchema>;

// Trial Schema
export const TrialSchema = z.object({
  id: z.string().optional(),
  orgId: z.string(),
  trialNumber: z.string(),
  name: z.string().min(1, 'Trial name is required'),
  description: z.string().optional().nullable(),
  hypothesis: z.string().optional().nullable(),
  objective: z.string().optional().nullable(),
  methodology: z.string().optional().nullable(),
  varietyId: z.string().optional().nullable(),
  targetSizeId: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  plannedEndDate: z.string().optional().nullable(),
  actualEndDate: z.string().optional().nullable(),
  measurementFrequencyDays: z.number().int().positive().default(7),
  status: TrialStatus.default('draft'),
  protocolId: z.string().optional().nullable(),
  trialLocationId: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Trial = z.infer<typeof TrialSchema>;

// Trial Group Schema
export const TrialGroupSchema = z.object({
  id: z.string().optional(),
  trialId: z.string(),
  name: z.string().min(1, 'Group name is required'),
  groupType: GroupType,
  sortOrder: z.number().int().min(0).default(0),
  description: z.string().optional().nullable(),
  strategy: GroupStrategySchema.default({}),
  targetPlantCount: z.number().int().positive().default(3),
  labelColor: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type TrialGroup = z.infer<typeof TrialGroupSchema>;

// Trial Subject Schema
export const TrialSubjectSchema = z.object({
  id: z.string().optional(),
  groupId: z.string(),
  subjectNumber: z.number().int().positive(),
  label: z.string().optional().nullable(),
  batchId: z.string().optional().nullable(),
  plantIdentifier: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  positionNotes: z.string().optional().nullable(),
  initialHeightCm: z.number().optional().nullable(),
  initialLeafCount: z.number().int().optional().nullable(),
  initialVigorScore: z.number().int().min(1).max(5).optional().nullable(),
  initialPhotoUrl: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  dropoutReason: z.string().optional().nullable(),
  dropoutDate: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type TrialSubject = z.infer<typeof TrialSubjectSchema>;

// Trial Measurement Schema
export const TrialMeasurementSchema = z.object({
  id: z.string().optional(),
  subjectId: z.string(),
  measurementDate: z.string(),
  weekNumber: z.number().int().min(0),
  // Growth Metrics
  heightCm: z.number().optional().nullable(),
  stemDiameterMm: z.number().optional().nullable(),
  leafCount: z.number().int().optional().nullable(),
  rootScore: z.number().int().min(1).max(5).optional().nullable(),
  biomassG: z.number().optional().nullable(),
  canopyWidthCm: z.number().optional().nullable(),
  internodeLengthMm: z.number().optional().nullable(),
  // Environmental
  ec: z.number().optional().nullable(),
  ph: z.number().optional().nullable(),
  temperatureC: z.number().optional().nullable(),
  humidityPct: z.number().optional().nullable(),
  lightLevelLux: z.number().int().optional().nullable(),
  // Visual Assessments
  colorScore: z.number().int().min(1).max(5).optional().nullable(),
  vigorScore: z.number().int().min(1).max(5).optional().nullable(),
  pestScore: z.number().int().min(1).max(5).optional().nullable(),
  diseaseScore: z.number().int().min(1).max(5).optional().nullable(),
  overallHealthScore: z.number().int().min(1).max(5).optional().nullable(),
  // Yield
  flowersCount: z.number().int().optional().nullable(),
  fruitsCount: z.number().int().optional().nullable(),
  harvestWeightG: z.number().optional().nullable(),
  qualityGrade: QualityGrade.optional().nullable(),
  // Notes
  photoUrls: z.array(z.string()).optional().nullable(),
  observations: z.string().optional().nullable(),
  anomalies: z.string().optional().nullable(),
  recordedBy: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type TrialMeasurement = z.infer<typeof TrialMeasurementSchema>;

// Trial Treatment Schema
export const TrialTreatmentSchema = z.object({
  id: z.string().optional(),
  groupId: z.string(),
  treatmentType: TreatmentType,
  treatmentDate: z.string(),
  ipmProductId: z.string().optional().nullable(),
  materialId: z.string().optional().nullable(),
  protocolId: z.string().optional().nullable(),
  name: z.string(),
  rate: z.number().optional().nullable(),
  rateUnit: z.string().optional().nullable(),
  method: z.string().optional().nullable(),
  quantityApplied: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  appliedBy: z.string().optional().nullable(),
  createdAt: z.string().optional(),
});
export type TrialTreatment = z.infer<typeof TrialTreatmentSchema>;

// Trial Finding Schema
export const TrialFindingSchema = z.object({
  id: z.string().optional(),
  trialId: z.string(),
  findingType: FindingType,
  title: z.string().min(1),
  description: z.string().min(1),
  supportingData: z.any().optional().nullable(),
  recommendedProtocolChanges: z.any().optional().nullable(),
  status: FindingStatus.default('draft'),
  implementedAt: z.string().optional().nullable(),
  implementedProtocolId: z.string().optional().nullable(),
  createdBy: z.string().optional().nullable(),
  reviewedBy: z.string().optional().nullable(),
  approvedBy: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type TrialFinding = z.infer<typeof TrialFindingSchema>;

// Extended types for UI with related data
export interface TrialWithRelations extends Trial {
  variety?: { id: string; name: string } | null;
  groups?: TrialGroupWithSubjects[];
  location?: { id: string; name: string } | null;
  protocol?: { id: string; name: string } | null;
  findings?: TrialFinding[];
}

export interface TrialGroupWithSubjects extends TrialGroup {
  subjects?: TrialSubject[];
  treatments?: TrialTreatment[];
  measurementCount?: number;
  latestMeasurementDate?: string | null;
}

export interface TrialSubjectWithMeasurements extends TrialSubject {
  measurements?: TrialMeasurement[];
  group?: TrialGroup;
}

// Summary type for list view (from v_trial_summary)
export interface TrialSummary {
  id: string;
  orgId: string;
  trialNumber: string;
  name: string;
  status: TrialStatus;
  startDate?: string | null;
  plannedEndDate?: string | null;
  varietyName?: string | null;
  groupCount: number;
  subjectCount: number;
  measurementCount: number;
  lastMeasurementDate?: string | null;
  currentWeek: number;
}

// Form input types for wizards
export interface TrialSetupInput {
  name: string;
  description?: string;
  hypothesis?: string;
  objective?: string;
  methodology?: string;
  varietyId?: string;
  targetSizeId?: string;
  protocolId?: string;
  trialLocationId?: string;
  startDate?: string;
  plannedEndDate?: string;
  measurementFrequencyDays: number;
  groups: TrialGroupInput[];
}

export interface TrialGroupInput {
  name: string;
  groupType: GroupType;
  description?: string;
  strategy: GroupStrategy;
  targetPlantCount: number;
  labelColor?: string;
  subjects?: TrialSubjectInput[];
}

export interface TrialSubjectInput {
  subjectNumber: number;
  label?: string;
  batchId?: string;
  plantIdentifier?: string;
  locationId?: string;
  positionNotes?: string;
  initialHeightCm?: number;
  initialLeafCount?: number;
  initialVigorScore?: number;
}

export interface MeasurementInput {
  subjectId: string;
  measurementDate: string;
  weekNumber: number;
  // Growth Metrics
  heightCm?: number;
  stemDiameterMm?: number;
  leafCount?: number;
  rootScore?: number;
  biomassG?: number;
  canopyWidthCm?: number;
  internodeLengthMm?: number;
  // Environmental
  ec?: number;
  ph?: number;
  temperatureC?: number;
  humidityPct?: number;
  lightLevelLux?: number;
  // Visual Assessments
  colorScore?: number;
  vigorScore?: number;
  pestScore?: number;
  diseaseScore?: number;
  overallHealthScore?: number;
  // Yield
  flowersCount?: number;
  fruitsCount?: number;
  harvestWeightG?: number;
  qualityGrade?: QualityGrade;
  // Notes
  observations?: string;
  anomalies?: string;
}

// Group colors for visual identification
export const GROUP_COLORS = [
  { name: 'Gray', value: '#6B7280', bg: 'bg-gray-500' },      // Control
  { name: 'Blue', value: '#3B82F6', bg: 'bg-blue-500' },      // Treatment A
  { name: 'Green', value: '#22C55E', bg: 'bg-green-500' },    // Treatment B
  { name: 'Orange', value: '#F97316', bg: 'bg-orange-500' },  // Treatment C
  { name: 'Purple', value: '#A855F7', bg: 'bg-purple-500' },  // Treatment D
  { name: 'Pink', value: '#EC4899', bg: 'bg-pink-500' },      // Treatment E
  { name: 'Cyan', value: '#06B6D4', bg: 'bg-cyan-500' },      // Treatment F
  { name: 'Yellow', value: '#EAB308', bg: 'bg-yellow-500' },  // Treatment G
] as const;

// Score labels for visual assessments
export const SCORE_LABELS = {
  1: 'Poor',
  2: 'Below Average',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
} as const;

// Inverse score labels (for pest/disease where 5 = healthy)
export const INVERSE_SCORE_LABELS = {
  1: 'Severe',
  2: 'Moderate',
  3: 'Minor',
  4: 'Trace',
  5: 'None',
} as const;
