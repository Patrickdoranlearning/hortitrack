import { z } from 'zod';

// ============================================================================
// Material Lot Enums
// ============================================================================

export const MaterialLotStatusSchema = z.enum([
  'available',
  'depleted',
  'quarantine',
  'damaged',
  'expired',
]);

export const MaterialLotUnitTypeSchema = z.enum([
  'box',
  'bag',
  'pallet',
  'roll',
  'bundle',
  'unit',
]);

// ============================================================================
// Material Lot Input Schemas
// ============================================================================

export const CreateMaterialLotSchema = z.object({
  materialId: z.string().uuid('Invalid material'),
  quantity: z.number().positive('Quantity must be positive'),
  unitType: MaterialLotUnitTypeSchema.default('box'),
  unitsPerPackage: z.number().positive().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  supplierLotNumber: z.string().max(100).optional().nullable(),
  locationId: z.string().uuid().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  manufacturedDate: z.string().optional().nullable(),
  costPerUnit: z.number().min(0).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  qualityNotes: z.string().max(500).optional().nullable(),
});

export const ReceiveMaterialLotsSchema = z.object({
  materialId: z.string().uuid('Invalid material'),
  lots: z.array(
    z.object({
      quantity: z.number().positive('Quantity must be positive'),
      unitType: MaterialLotUnitTypeSchema.default('box'),
      unitsPerPackage: z.number().positive().optional().nullable(),
      supplierId: z.string().uuid().optional().nullable(),
      supplierLotNumber: z.string().max(100).optional().nullable(),
      expiryDate: z.string().optional().nullable(),
      manufacturedDate: z.string().optional().nullable(),
      costPerUnit: z.number().min(0).optional().nullable(),
      notes: z.string().max(500).optional().nullable(),
      qualityNotes: z.string().max(500).optional().nullable(),
    })
  ).min(1, 'At least one lot is required'),
  locationId: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const AdjustLotSchema = z.object({
  quantity: z.number({ required_error: 'Quantity is required' }),
  reason: z.string().min(1, 'Reason is required').max(200),
  notes: z.string().max(500).optional().nullable(),
});

export const TransferLotSchema = z.object({
  toLocationId: z.string().uuid('Destination location is required'),
  notes: z.string().max(500).optional().nullable(),
});

export const ConsumeLotSchema = z.object({
  quantity: z.number().positive('Quantity must be positive'),
  batchId: z.string().uuid('Batch is required'),
  jobId: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const ScrapLotSchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(200),
  notes: z.string().max(500).optional().nullable(),
});

export const UpdateLotStatusSchema = z.object({
  status: MaterialLotStatusSchema,
  notes: z.string().max(500).optional().nullable(),
});

// ============================================================================
// Lot Selection Schemas (for production)
// ============================================================================

export const LotConsumptionEntrySchema = z.object({
  lotId: z.string().uuid('Invalid lot'),
  quantity: z.number().positive('Quantity must be positive'),
});

export const ConsumeMaterialWithLotsSchema = z.object({
  materialId: z.string().uuid('Invalid material'),
  batchId: z.string().uuid('Invalid batch'),
  jobId: z.string().uuid().optional().nullable(),
  lots: z.array(LotConsumptionEntrySchema).min(1, 'At least one lot must be selected'),
  notes: z.string().max(500).optional().nullable(),
});

export const BatchMaterialLotsConsumptionSchema = z.object({
  batchId: z.string().uuid('Invalid batch'),
  jobId: z.string().uuid().optional().nullable(),
  materials: z.array(
    z.object({
      materialId: z.string().uuid('Invalid material'),
      lots: z.array(LotConsumptionEntrySchema),
    })
  ),
  useFifo: z.boolean().default(true),
  allowPartial: z.boolean().default(false),
});

// ============================================================================
// PO Receipt with Lots
// ============================================================================

export const ReceiveLotFromPOSchema = z.object({
  quantity: z.number().positive('Quantity must be positive'),
  unitType: MaterialLotUnitTypeSchema.default('box'),
  unitsPerPackage: z.number().positive().optional().nullable(),
  supplierLotNumber: z.string().max(100).optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  manufacturedDate: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  qualityNotes: z.string().max(500).optional().nullable(),
});

export const ReceiveLineWithLotsSchema = z.object({
  lineId: z.string().uuid('Invalid line'),
  quantityReceived: z.number().min(0, 'Quantity cannot be negative'),
  lots: z.array(ReceiveLotFromPOSchema).min(1, 'At least one lot is required'),
  notes: z.string().max(500).optional().nullable(),
});

export const ReceiveGoodsWithLotsSchema = z.object({
  lines: z.array(ReceiveLineWithLotsSchema).min(1, 'At least one line must be received'),
  locationId: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

// ============================================================================
// Query Param Schemas
// ============================================================================

export const MaterialLotsQuerySchema = z.object({
  materialId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  status: z.union([
    MaterialLotStatusSchema,
    z.array(MaterialLotStatusSchema),
  ]).optional(),
  supplierId: z.string().uuid().optional(),
  hasStock: z.enum(['true', 'false']).optional(),
  expiringWithinDays: z.coerce.number().min(0).optional(),
  search: z.string().optional(),
  sortField: z.enum(['lotNumber', 'receivedAt', 'currentQuantity', 'expiryDate', 'status']).default('receivedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
});

export const LotTransactionsQuerySchema = z.object({
  lotId: z.string().uuid().optional(),
  materialId: z.string().uuid().optional(),
  transactionType: z.enum([
    'receive', 'consume', 'adjust', 'transfer', 'split', 'merge', 'scrap', 'return'
  ]).optional(),
  batchId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
});

export const FifoLotsQuerySchema = z.object({
  materialId: z.string().uuid('Material is required'),
  requiredQuantity: z.coerce.number().positive().optional(),
  locationId: z.string().uuid().optional(),
});

export const BatchLotsQuerySchema = z.object({
  batchId: z.string().uuid('Batch is required'),
});

export const LotUsageQuerySchema = z.object({
  lotId: z.string().uuid('Lot is required'),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// ============================================================================
// Type Exports
// ============================================================================

export type CreateMaterialLotSchemaType = z.infer<typeof CreateMaterialLotSchema>;
export type ReceiveMaterialLotsSchemaType = z.infer<typeof ReceiveMaterialLotsSchema>;
export type AdjustLotSchemaType = z.infer<typeof AdjustLotSchema>;
export type TransferLotSchemaType = z.infer<typeof TransferLotSchema>;
export type ConsumeLotSchemaType = z.infer<typeof ConsumeLotSchema>;
export type ScrapLotSchemaType = z.infer<typeof ScrapLotSchema>;
export type UpdateLotStatusSchemaType = z.infer<typeof UpdateLotStatusSchema>;
export type LotConsumptionEntrySchemaType = z.infer<typeof LotConsumptionEntrySchema>;
export type ConsumeMaterialWithLotsSchemaType = z.infer<typeof ConsumeMaterialWithLotsSchema>;
export type BatchMaterialLotsConsumptionSchemaType = z.infer<typeof BatchMaterialLotsConsumptionSchema>;
export type ReceiveGoodsWithLotsSchemaType = z.infer<typeof ReceiveGoodsWithLotsSchema>;
export type MaterialLotsQuerySchemaType = z.infer<typeof MaterialLotsQuerySchema>;
export type LotTransactionsQuerySchemaType = z.infer<typeof LotTransactionsQuerySchema>;
export type FifoLotsQuerySchemaType = z.infer<typeof FifoLotsQuerySchema>;
