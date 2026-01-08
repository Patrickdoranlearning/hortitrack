/**
 * Materials Management Types
 * Covers materials catalog, stock tracking, purchase orders, and consumption rules
 */

// ============================================================================
// Material Categories (shared - no org_id)
// ============================================================================

export type ConsumptionType = 'per_unit' | 'proportional' | 'fixed';

export type MaterialCategoryCode =
  | 'POT' | 'TRY' | 'MKT'  // Containers
  | 'SOI' | 'PER' | 'VER'  // Growing Media
  | 'LBL' | 'TAG'          // Labels/Tags
  | 'FRT' | 'PST' | 'BIO'; // Chemicals

export type MaterialParentGroup =
  | 'Containers'
  | 'Growing Media'
  | 'Labels/Tags'
  | 'Chemicals';

export type MaterialCategory = {
  id: string;
  code: MaterialCategoryCode;
  name: string;
  parentGroup: MaterialParentGroup;
  consumptionType: ConsumptionType;
  sortOrder: number;
  createdAt: string;
};

// ============================================================================
// Materials (org-scoped)
// ============================================================================

export type MaterialUOM = 'each' | 'litre' | 'kg' | 'ml' | 'g';

export type Material = {
  id: string;
  orgId: string;
  partNumber: string;
  name: string;
  description?: string | null;
  categoryId: string;
  category?: MaterialCategory;
  linkedSizeId?: string | null;
  linkedSize?: {
    id: string;
    name: string;
    containerType?: string;
  } | null;
  baseUom: MaterialUOM;
  defaultSupplierId?: string | null;
  defaultSupplier?: {
    id: string;
    name: string;
  } | null;
  reorderPoint?: number | null;
  reorderQuantity?: number | null;
  targetStock?: number | null;
  standardCost?: number | null;
  barcode?: string | null;
  internalBarcode?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MaterialWithStock = Material & {
  stock?: MaterialStockSummary;
};

// ============================================================================
// Material Stock (org-scoped)
// ============================================================================

export type MaterialStock = {
  id: string;
  orgId: string;
  materialId: string;
  material?: Material;
  locationId?: string | null;
  location?: {
    id: string;
    name: string;
  } | null;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number;
  lastCountedAt?: string | null;
  lastMovementAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MaterialStockSummary = {
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  locationCount: number;
  lastMovementAt?: string | null;
};

// ============================================================================
// Material Transactions (audit log)
// ============================================================================

export type MaterialTransactionType =
  | 'receive'
  | 'consume'
  | 'adjust'
  | 'transfer'
  | 'count'
  | 'return'
  | 'scrap';

export type MaterialTransaction = {
  id: string;
  orgId: string;
  materialId: string;
  material?: Material;
  transactionType: MaterialTransactionType;
  quantity: number;
  uom: string;
  fromLocationId?: string | null;
  fromLocation?: { id: string; name: string } | null;
  toLocationId?: string | null;
  toLocation?: { id: string; name: string } | null;
  purchaseOrderLineId?: string | null;
  batchId?: string | null;
  batch?: { id: string; batchNumber: string } | null;
  quantityAfter?: number | null;
  reference?: string | null;
  notes?: string | null;
  costPerUnit?: number | null;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
};

// ============================================================================
// Purchase Orders
// ============================================================================

export type PurchaseOrderStatus =
  | 'draft'
  | 'submitted'
  | 'confirmed'
  | 'partially_received'
  | 'received'
  | 'cancelled';

export type PurchaseOrder = {
  id: string;
  orgId: string;
  poNumber: string;
  supplierId: string;
  supplier?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  };
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  deliveryLocationId?: string | null;
  deliveryLocation?: { id: string; name: string } | null;
  deliveryNotes?: string | null;
  supplierRef?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  receivedAt?: string | null;
  lines?: PurchaseOrderLine[];
};

export type PurchaseOrderLine = {
  id: string;
  purchaseOrderId: string;
  materialId: string;
  material?: Material;
  lineNumber: number;
  quantityOrdered: number;
  quantityReceived: number;
  uom: string;
  unitPrice: number;
  discountPct: number;
  lineTotal: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseOrderWithLines = PurchaseOrder & {
  lines: PurchaseOrderLine[];
};

// ============================================================================
// Material Consumption Rules
// ============================================================================

export type MaterialConsumptionRule = {
  id: string;
  orgId: string;
  materialId: string;
  material?: Material;
  sizeId: string;
  size?: { id: string; name: string };
  quantityPerUnit: number;
  createdAt: string;
  updatedAt: string;
};

// ============================================================================
// API Input Types
// ============================================================================

export type CreateMaterialInput = {
  name: string;
  description?: string;
  categoryId: string;
  linkedSizeId?: string;
  baseUom?: MaterialUOM;
  defaultSupplierId?: string;
  reorderPoint?: number;
  reorderQuantity?: number;
  targetStock?: number;
  standardCost?: number;
  barcode?: string;
};

export type UpdateMaterialInput = Partial<CreateMaterialInput> & {
  isActive?: boolean;
};

export type StockAdjustmentInput = {
  materialId: string;
  locationId?: string;
  quantity: number;
  reason: string;
  notes?: string;
};

export type StockTransferInput = {
  materialId: string;
  fromLocationId?: string;
  toLocationId: string;
  quantity: number;
  notes?: string;
};

export type CreatePurchaseOrderInput = {
  supplierId: string;
  expectedDeliveryDate?: string;
  deliveryLocationId?: string;
  deliveryNotes?: string;
  supplierRef?: string;
  notes?: string;
  lines: {
    materialId: string;
    quantityOrdered: number;
    unitPrice: number;
    discountPct?: number;
    notes?: string;
  }[];
};

export type ReceiveGoodsInput = {
  lines: {
    lineId: string;
    quantityReceived: number;
    notes?: string;
  }[];
  locationId?: string;
  notes?: string;
};

// ============================================================================
// Consumption Preview (for ActualizeWizard)
// ============================================================================

export type MaterialConsumptionPreview = {
  materialId: string;
  materialName: string;
  partNumber: string;
  categoryName: string;
  quantityToConsume: number;
  uom: string;
  availableStock: number;
  insufficientStock: boolean;
  consumptionType: ConsumptionType;
  linkedSizeId?: string;
};

export type ConsumptionResult = {
  materialId: string;
  materialName: string;
  quantityConsumed: number;
  uom: string;
  success: boolean;
  error?: string;
};
