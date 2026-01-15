import { z } from 'zod';

// ============================================================================
// Material Schemas
// ============================================================================

export const MaterialUOMSchema = z.enum(['each', 'litre', 'kg', 'ml', 'g']);

export const CreateMaterialSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(500).optional(),
  categoryId: z.string().uuid('Invalid category'),
  linkedSizeId: z.string().uuid().optional().nullable(),
  baseUom: MaterialUOMSchema.default('each'),
  defaultSupplierId: z.string().uuid().optional().nullable(),
  reorderPoint: z.number().int().min(0).optional().nullable(),
  reorderQuantity: z.number().int().min(1).optional().nullable(),
  targetStock: z.number().int().min(0).optional().nullable(),
  standardCost: z.number().min(0).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  // Initial stock quantity when creating a new material
  initialStock: z.number().int().min(0).optional().nullable(),
});

export const UpdateMaterialSchema = CreateMaterialSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateMaterialSchemaType = z.infer<typeof CreateMaterialSchema>;
export type UpdateMaterialSchemaType = z.infer<typeof UpdateMaterialSchema>;

// ============================================================================
// Stock Adjustment Schemas
// ============================================================================

export const StockAdjustmentSchema = z.object({
  locationId: z.string().uuid().optional().nullable(),
  quantity: z.number(),
  reason: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  isCount: z.boolean().optional().default(false),
});

export const StockTransferSchema = z.object({
  materialId: z.string().uuid('Invalid material'),
  fromLocationId: z.string().uuid().optional().nullable(),
  toLocationId: z.string().uuid('Destination location is required'),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().max(500).optional(),
});

export const StockCountSchema = z.object({
  materialId: z.string().uuid('Invalid material'),
  locationId: z.string().uuid().optional().nullable(),
  countedQuantity: z.number().min(0, 'Counted quantity cannot be negative'),
  notes: z.string().max(500).optional(),
});

export type StockAdjustmentSchemaType = z.infer<typeof StockAdjustmentSchema>;
export type StockTransferSchemaType = z.infer<typeof StockTransferSchema>;
export type StockCountSchemaType = z.infer<typeof StockCountSchema>;

// ============================================================================
// Purchase Order Schemas
// ============================================================================

export const PurchaseOrderLineInputSchema = z.object({
  materialId: z.string().uuid('Invalid material'),
  quantityOrdered: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price cannot be negative'),
  discountPct: z.number().min(0).max(100).default(0),
  notes: z.string().max(500).optional(),
});

export const CreatePurchaseOrderSchema = z.object({
  supplierId: z.string().uuid('Supplier is required'),
  expectedDeliveryDate: z.string().optional().nullable(),
  deliveryLocationId: z.string().uuid().optional().nullable(),
  deliveryNotes: z.string().max(500).optional(),
  supplierRef: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  lines: z.array(PurchaseOrderLineInputSchema).min(1, 'At least one line item is required'),
});

export const UpdatePurchaseOrderSchema = z.object({
  supplierId: z.string().uuid().optional(),
  expectedDeliveryDate: z.string().optional().nullable(),
  deliveryLocationId: z.string().uuid().optional().nullable(),
  deliveryNotes: z.string().max(500).optional(),
  supplierRef: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
});

export const ReceiveLineSchema = z.object({
  lineId: z.string().uuid('Invalid line'),
  quantityReceived: z.number().min(0, 'Quantity cannot be negative'),
  notes: z.string().max(500).optional(),
});

export const ReceiveGoodsSchema = z.object({
  lines: z.array(ReceiveLineSchema).min(1, 'At least one line must be received'),
  locationId: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional(),
});

export type CreatePurchaseOrderSchemaType = z.infer<typeof CreatePurchaseOrderSchema>;
export type UpdatePurchaseOrderSchemaType = z.infer<typeof UpdatePurchaseOrderSchema>;
export type ReceiveGoodsSchemaType = z.infer<typeof ReceiveGoodsSchema>;

// ============================================================================
// Consumption Rule Schemas
// ============================================================================

export const ConsumptionRuleSchema = z.object({
  materialId: z.string().uuid('Invalid material'),
  sizeId: z.string().uuid('Invalid size'),
  quantityPerUnit: z.number().positive('Quantity per unit must be positive'),
});

export const UpsertConsumptionRulesSchema = z.object({
  rules: z.array(ConsumptionRuleSchema),
});

export type ConsumptionRuleSchemaType = z.infer<typeof ConsumptionRuleSchema>;

// ============================================================================
// Query Param Schemas
// ============================================================================

export const MaterialsQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  categoryCode: z.string().optional(),
  linkedSizeId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
});

export const PurchaseOrdersQuerySchema = z.object({
  status: z.enum(['draft', 'submitted', 'confirmed', 'partially_received', 'received', 'cancelled']).optional(),
  supplierId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const TransactionsQuerySchema = z.object({
  materialId: z.string().uuid().optional(),
  transactionType: z.enum(['receive', 'consume', 'adjust', 'transfer', 'count', 'return', 'scrap']).optional(),
  batchId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
});

export type MaterialsQuerySchemaType = z.infer<typeof MaterialsQuerySchema>;
export type PurchaseOrdersQuerySchemaType = z.infer<typeof PurchaseOrdersQuerySchema>;
export type TransactionsQuerySchemaType = z.infer<typeof TransactionsQuerySchema>;
