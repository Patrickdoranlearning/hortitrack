/**
 * History Types - Separates Stock Movements from Plant Health Events
 */

// ============================================================================
// STOCK MOVEMENT TYPES
// ============================================================================

export type StockMovementType =
  | 'initial'
  | 'checkin'
  | 'check_in'
  | 'create'
  | 'transplant_in'
  | 'transplant_out'
  | 'move_in'
  | 'move'
  | 'propagate'
  | 'stock_received'
  | 'batch_actualized'
  | 'actualized'
  | 'consumed'
  | 'allocated'
  | 'picked'
  | 'sale'
  | 'dispatch'
  | 'loss'
  | 'adjustment';

export interface StockMovementDestination {
  type: 'order' | 'batch' | 'loss' | 'adjustment' | 'supplier';
  // Order destination
  orderId?: string;
  orderNumber?: string;
  customerName?: string;
  // Batch destination (transplant)
  batchId?: string;
  batchNumber?: string;
  // Loss details
  lossReason?: string;
  // Supplier (check-in)
  supplierName?: string;
}

export interface StockMovement {
  id: string;
  batchId: string;
  at: string;
  type: StockMovementType;
  quantity: number; // Positive for IN, negative for OUT
  runningBalance?: number; // Calculated running balance
  title: string;
  details?: string | null;
  destination?: StockMovementDestination;
  userId?: string | null;
  userName?: string | null;
}

// ============================================================================
// PLANT HEALTH EVENT TYPES
// ============================================================================

export type PlantHealthEventType =
  | 'treatment'
  | 'scout_flag'
  | 'measurement'
  | 'clearance'
  | 'irrigation'
  | 'fertilize'
  | 'pruning'
  | 'grading';

export interface PlantHealthEvent {
  id: string;
  batchId: string;
  batchNumber?: string;
  varietyName?: string;
  at: string;
  type: PlantHealthEventType;
  title: string;
  details?: string | null;
  // Treatment-specific fields
  productName?: string | null;
  rate?: number | null;
  unit?: string | null;
  method?: string | null;
  reasonForUse?: string | null;
  weatherConditions?: string | null;
  areaTreated?: string | null;
  sprayerUsed?: string | null;
  safeHarvestDate?: string | null;
  harvestIntervalDays?: number | null;
  // Measurement fields
  ecReading?: number | null;
  phReading?: number | null;
  // Scout fields
  severity?: string | null;
  issueType?: string | null;
  // Media
  photos?: string[];
  // User info
  userId?: string | null;
  userName?: string | null;
  signedBy?: string | null;
}

// ============================================================================
// DISTRIBUTION TYPES (Enhanced for Interactive Bar)
// ============================================================================

export interface AllocationDetail {
  id: string;
  quantity: number;
  date: string;
}

export interface OrderAllocationDetail extends AllocationDetail {
  orderId: string;
  orderNumber: string;
  customerName: string;
  deliveryDate?: string;
  status: 'reserved' | 'picked' | 'shipped';
}

export interface PlanAllocationDetail extends AllocationDetail {
  planId: string;
  planName: string;
  targetDate?: string;
}

export interface SoldDetail extends AllocationDetail {
  orderId: string;
  orderNumber: string;
  customerName: string;
  soldDate: string;
}

export interface DumpedDetail {
  reason: string;
  quantity: number;
  dates: string[];
}

export interface TransplantedDetail extends AllocationDetail {
  childBatchId: string;
  childBatchNumber: string;
}

export interface DetailedDistribution {
  available: number;
  allocatedPotting: {
    total: number;
    details: PlanAllocationDetail[];
  };
  allocatedSales: {
    total: number;
    details: OrderAllocationDetail[];
  };
  sold: {
    total: number;
    details: SoldDetail[];
  };
  dumped: {
    total: number;
    details: DumpedDetail[];
  };
  transplanted: {
    total: number;
    details: TransplantedDetail[];
  };
  totalAccounted: number;
}

// Simple distribution for basic display (without details)
export interface SimpleDistribution {
  available: number;
  allocatedPotting: number;
  allocatedSales: number;
  sold: number;
  dumped: number;
  transplanted: number;
  totalAccounted: number;
}

// ============================================================================
// TYPE GUARDS AND HELPERS
// ============================================================================

export const STOCK_MOVEMENT_TYPES: Set<string> = new Set([
  'initial', 'checkin', 'check_in', 'create',
  'transplant_in', 'transplant_out',
  'move_in', 'move', 'propagate', 'stock_received', 'batch_actualized',
  'actualized', 'consumed',
  'allocated', 'picked', 'sale', 'dispatch', 'loss', 'adjustment'
]);

export const PLANT_HEALTH_TYPES: Set<string> = new Set([
  'treatment', 'scout_flag', 'measurement', 'clearance',
  'irrigation', 'fertilize', 'pruning', 'grading'
]);

export function isStockMovementType(type: string): type is StockMovementType {
  return STOCK_MOVEMENT_TYPES.has(type.toLowerCase());
}

export function isPlantHealthType(type: string): type is PlantHealthEventType {
  return PLANT_HEALTH_TYPES.has(type.toLowerCase());
}

// IN events (positive quantity)
export const IN_EVENT_TYPES: Set<string> = new Set([
  'initial', 'checkin', 'check_in', 'create',
  'transplant_in', 'transplant_from', 'propagation_in',
  'move_in', 'propagate', 'stock_received', 'batch_actualized', 'actualized'
]);

// OUT events (negative quantity)
export const OUT_EVENT_TYPES: Set<string> = new Set([
  'transplant_out', 'transplant_to', 'move', 'consumed',
  'picked', 'sale', 'dispatch', 'loss', 'dump'
]);

export function isInEvent(type: string): boolean {
  return IN_EVENT_TYPES.has(type.toLowerCase());
}

export function isOutEvent(type: string): boolean {
  return OUT_EVENT_TYPES.has(type.toLowerCase());
}
