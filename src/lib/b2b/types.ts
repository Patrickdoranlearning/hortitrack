import { z } from 'zod';

export type DeliveryPreferences = {
  preferredTrolleyType?: 'tag6' | 'dc' | 'danish' | 'dutch';
  labelRequirements?: 'yellow_tag' | 'no_tag' | 'any';
  specialInstructions?: string;
};

/**
 * Product catalog item for B2B customer portal
 * Filtered by customer's price list with batch and pricing information
 */
export type CustomerCatalogProduct = {
  productId: string;
  productName: string;
  description: string | null;
  skuId: string;
  skuCode: string | null;
  varietyId: string | null;
  varietyName: string | null;
  varietyAliases?: string[] | null;
  family: string | null; // Plant family (e.g., Lamiaceae for Lavender)
  sizeId: string | null;
  sizeName: string | null;
  category: string | null;
  containerType: string | null;
  heroImageUrl: string | null;
  galleryImages?: Array<{ url: string; badge?: string }> | null;
  isActive: boolean;
  // Available batches for this product
  availableBatches: Array<{
    id: string;
    batchNumber: string;
    varietyId: string | null; // Plant variety ID for order constraints
    varietyName: string | null; // For different cultivars (e.g., Hidcote, Munstead)
    family: string | null; // Plant family
    availableQty: number;
  }>;
  totalAvailableQty: number; // For low stock indicator
  // Pricing from customer's price list
  priceListId: string | null;
  unitPriceExVat: number | null;
  currency: string | null;
  vatRate: number; // Default VAT rate from SKU
  // Customer-specific alias (if exists)
  aliasId: string | null;
  aliasName: string | null;
  customerSkuCode: string | null;
  suggestedRrp: number | null; // From product_aliases.rrp
};

/**
 * Batch allocation for a cart item
 */
export type BatchAllocation = {
  batchId: string;
  batchNumber: string;
  qty: number;
};

/**
 * Shopping cart item for B2B order creation
 */
export type CartItem = {
  productId: string;
  skuId: string;
  productName: string;
  varietyName: string | null;
  sizeName: string | null;
  quantity: number;
  unitPriceExVat: number;
  vatRate: number;
  requiredVarietyId?: string;
  requiredVarietyName?: string | null;
  requiredBatchId?: string;
  // Optional batch selection - supports single or multiple batches
  batchId?: string;
  batchNumber?: string;
  // Multi-batch allocations (takes precedence over single batchId if present)
  batchAllocations?: BatchAllocation[];
  // Customer-set pricing
  rrp?: number;
  multibuyPrice2?: number;
  multibuyQty2?: number;
  multibuyPrice3?: number;
  multibuyQty3?: number;
};

/**
 * Validation schema for creating B2B orders
 */
export const B2BOrderSchema = z.object({
  customerId: z.string().uuid(),
  deliveryAddressId: z.string().uuid(),
  deliveryDate: z.string().optional(),
  notes: z.string().optional(),
  cart: z.array(z.object({
    productId: z.string().uuid(),
    skuId: z.string().uuid(),
    quantity: z.number().int().positive(),
    unitPriceExVat: z.number().nonnegative(),
    vatRate: z.number().min(0).max(100),
    batchId: z.string().uuid().optional(),
    batchAllocations: z.array(z.object({
      batchId: z.string().uuid(),
      batchNumber: z.string(),
      qty: z.number().int().positive(),
    })).optional(),
    rrp: z.number().nonnegative().optional(),
    multibuyPrice2: z.number().nonnegative().optional(),
    multibuyQty2: z.number().int().positive().optional(),
    multibuyPrice3: z.number().nonnegative().optional(),
    multibuyQty3: z.number().int().positive().optional(),
  })).min(1),
});

export type B2BOrderInput = z.infer<typeof B2BOrderSchema>;

/**
 * Order summary for B2B order history
 */
export type B2BOrderSummary = {
  id: string;
  orderNumber: string;
  status: string;
  customerId: string;
  deliveryAddressLabel: string | null;
  storeName: string | null;
  requestedDeliveryDate: string | null;
  subtotalExVat: number;
  vatAmount: number;
  totalIncVat: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Line items for detail view
  items?: Array<{
    id: string;
    productName: string;
    description: string | null;
    quantity: number;
    unitPriceExVat: number;
    vatRate: number;
    lineTotalExVat: number;
    lineVatAmount: number;
    rrp: number | null;
    multibuyPrice2: number | null;
    multibuyQty2: number | null;
  }>;
};

/**
 * Customer resource (document, video, etc.)
 */
export type CustomerResource = {
  id: string;
  title: string;
  description: string | null;
  resourceType: 'pdf' | 'document' | 'spreadsheet' | 'image' | 'video' | 'link';
  fileUrl: string | null;
  category: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  sortOrder: number;
  createdAt: string;
};

/**
 * Customer favorite product
 */
export type CustomerFavoriteProduct = {
  id: string;
  productId: string;
  product: Pick<CustomerCatalogProduct, 'productId' | 'productName' | 'varietyName' | 'sizeName' | 'heroImageUrl' | 'unitPriceExVat'>;
  sortOrder: number;
  createdAt: string;
};

/**
 * Batch information for variety-level display
 */
export type VarietyBatchInfo = {
  id: string;
  batchNumber: string;
  availableQty: number;
  growingStatus: string | null;
  salesStatus: string | null;
  qcStatus: string | null;
  notes: string | null;
  plantedAt: string | null;
  locationName: string | null;
};

/**
 * Variety-level aggregate information for accordion display
 * Groups batches by variety and calculates availability
 */
export type VarietyInfo = {
  varietyId: string;
  varietyName: string;
  family: string | null;
  totalAvailableQty: number;
  status: 'plenty' | 'low' | 'out';  // Stock level indicator
  batchCount: number;
  batches: VarietyBatchInfo[];
};

/**
 * Enhanced catalog product with variety-level breakdown
 * Used by accordion component for multi-level selection
 */
export type CustomerCatalogProductWithVarieties = CustomerCatalogProduct & {
  varieties: VarietyInfo[];
};

/**
 * Variety allocation state for accordion component
 * Tracks user's quantity allocation per variety
 */
export type VarietyAllocation = {
  varietyId: string;
  varietyName: string;
  quantity: number;
  batchAllocations?: BatchAllocation[];
  hasBatchSelection: boolean;
};
