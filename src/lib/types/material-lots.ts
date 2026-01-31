/**
 * Material Lots Types
 * Tracks individual boxes/bags/units of materials with scannable barcodes
 */

import type { Material } from './materials';

// ============================================================================
// Material Lot Enums
// ============================================================================

export type MaterialLotStatus =
  | 'available'
  | 'depleted'
  | 'quarantine'
  | 'damaged'
  | 'expired';

export type MaterialLotUnitType =
  | 'box'
  | 'bag'
  | 'pallet'
  | 'roll'
  | 'bundle'
  | 'unit';

// ============================================================================
// Material Lot (org-scoped)
// ============================================================================

export type MaterialLot = {
  id: string;
  orgId: string;
  materialId: string;
  material?: Material;

  // Identifiers
  lotNumber: string;
  lotBarcode: string;
  supplierLotNumber?: string | null;

  // Quantity tracking
  initialQuantity: number;
  currentQuantity: number;
  uom: string;

  // Unit/packaging info
  unitType: MaterialLotUnitType;
  unitsPerPackage?: number | null;

  // Provenance
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  purchaseOrderLineId?: string | null;
  purchaseOrderLine?: {
    id: string;
    purchaseOrderId: string;
    purchaseOrder?: { id: string; poNumber: string };
  } | null;

  // Location
  locationId?: string | null;
  location?: { id: string; name: string } | null;

  // Dates
  receivedAt: string;
  expiryDate?: string | null;
  manufacturedDate?: string | null;

  // Status
  status: MaterialLotStatus;

  // Costing
  costPerUnit?: number | null;

  // Notes
  notes?: string | null;
  qualityNotes?: string | null;

  // Audit
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MaterialLotWithMaterial = MaterialLot & {
  material: Material;
};

// ============================================================================
// Material Lot Transactions (audit log)
// ============================================================================

export type MaterialLotTransactionType =
  | 'receive'
  | 'consume'
  | 'adjust'
  | 'transfer'
  | 'split'
  | 'merge'
  | 'scrap'
  | 'return';

export type MaterialLotTransaction = {
  id: string;
  orgId: string;
  lotId: string;
  lot?: MaterialLot;
  materialId: string;
  material?: Material;
  transactionType: MaterialLotTransactionType;
  quantity: number;
  uom: string;

  // Location tracking
  fromLocationId?: string | null;
  fromLocation?: { id: string; name: string } | null;
  toLocationId?: string | null;
  toLocation?: { id: string; name: string } | null;

  // Source references
  batchId?: string | null;
  batch?: { id: string; batchNumber: string } | null;
  jobId?: string | null;
  job?: { id: string; name: string } | null;
  purchaseOrderLineId?: string | null;

  // Running balance
  quantityAfter: number;

  // Metadata
  reference?: string | null;
  notes?: string | null;

  // Audit
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
};

// ============================================================================
// Batch Material Lots (Consumption Junction)
// ============================================================================

export type BatchMaterialLot = {
  id: string;
  orgId: string;
  batchId: string;
  batch?: { id: string; batchNumber: string };
  lotId: string;
  lot?: MaterialLot;
  materialId: string;
  material?: Material;
  quantityConsumed: number;
  uom: string;
  consumedAt: string;
  consumedBy?: string | null;
  consumedByName?: string | null;
  jobId?: string | null;
  job?: { id: string; name: string } | null;
  notes?: string | null;
  createdAt: string;
};

// ============================================================================
// API Input Types
// ============================================================================

export type CreateMaterialLotInput = {
  materialId: string;
  quantity: number;
  unitType: MaterialLotUnitType;
  unitsPerPackage?: number;
  supplierId?: string;
  supplierLotNumber?: string;
  locationId?: string;
  expiryDate?: string;
  manufacturedDate?: string;
  costPerUnit?: number;
  notes?: string;
  qualityNotes?: string;
};

export type ReceiveMaterialLotsInput = {
  materialId: string;
  lots: CreateMaterialLotInput[];
  locationId?: string;
  notes?: string;
};

export type AdjustLotInput = {
  lotId: string;
  quantity: number;
  reason: string;
  notes?: string;
};

export type TransferLotInput = {
  lotId: string;
  toLocationId: string;
  notes?: string;
};

export type ConsumeLotInput = {
  lotId: string;
  quantity: number;
  batchId: string;
  jobId?: string;
  notes?: string;
};

export type ScrapLotInput = {
  lotId: string;
  reason: string;
  notes?: string;
};

// ============================================================================
// FIFO Selection Types
// ============================================================================

export type AvailableLot = {
  lotId: string;
  lotNumber: string;
  lotBarcode: string;
  currentQuantity: number;
  receivedAt: string;
  expiryDate?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  supplierLotNumber?: string | null;
  isSuggested: boolean;
};

export type FifoSelectionResult = {
  lots: AvailableLot[];
  totalAvailable: number;
  canFulfill: boolean;
  requiredQuantity: number;
};

// ============================================================================
// Lot Consumption for Production
// ============================================================================

export type LotConsumptionEntry = {
  lotId: string;
  quantity: number;
};

export type LotConsumptionPreview = {
  materialId: string;
  materialName: string;
  partNumber: string;
  categoryName: string;
  quantityRequired: number;
  uom: string;
  requiresLotTracking: boolean;
  availableLots: AvailableLot[];
  suggestedLots: LotConsumptionEntry[];
  canFulfill: boolean;
  shortfall: number;
};

export type LotConsumptionResult = {
  materialId: string;
  materialName: string;
  lotsConsumed: {
    lotId: string;
    lotNumber: string;
    quantityConsumed: number;
  }[];
  totalConsumed: number;
  success: boolean;
  error?: string;
};

// ============================================================================
// Query Types
// ============================================================================

export type MaterialLotFilters = {
  materialId?: string;
  locationId?: string;
  status?: MaterialLotStatus | MaterialLotStatus[];
  supplierId?: string;
  hasStock?: boolean;
  expiringWithinDays?: number;
  search?: string;
};

export type MaterialLotSortField =
  | 'lotNumber'
  | 'receivedAt'
  | 'currentQuantity'
  | 'expiryDate'
  | 'status';

export type MaterialLotSortOrder = 'asc' | 'desc';

export type MaterialLotQueryParams = {
  filters?: MaterialLotFilters;
  sortField?: MaterialLotSortField;
  sortOrder?: MaterialLotSortOrder;
  page?: number;
  pageSize?: number;
};

// ============================================================================
// Label Types
// ============================================================================

export type LotLabelInput = {
  lotNumber: string;
  lotBarcode: string;
  materialName: string;
  materialPartNumber: string;
  categoryName: string;
  quantity: number;
  uom: string;
  unitType: MaterialLotUnitType;
  unitsPerPackage?: number;
  supplierName?: string;
  supplierLotNumber?: string;
  receivedDate: string;
  expiryDate?: string;
  locationName?: string;
};

// ============================================================================
// Traceability Types
// ============================================================================

export type BatchMaterialTraceability = {
  batchId: string;
  batchNumber: string;
  materials: {
    materialId: string;
    materialName: string;
    partNumber: string;
    categoryName: string;
    totalConsumed: number;
    uom: string;
    lots: {
      lotId: string;
      lotNumber: string;
      supplierLotNumber?: string | null;
      quantityConsumed: number;
      consumedAt: string;
      supplier?: { id: string; name: string } | null;
      purchaseOrder?: { id: string; poNumber: string } | null;
    }[];
  }[];
};

export type LotUsageHistory = {
  lotId: string;
  lotNumber: string;
  materialName: string;
  initialQuantity: number;
  currentQuantity: number;
  batches: {
    batchId: string;
    batchNumber: string;
    varietyName: string;
    quantityConsumed: number;
    consumedAt: string;
  }[];
};
