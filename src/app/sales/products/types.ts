export type ProductSummary = {
  id: string;
  name: string;
  skuId: string;
  description: string | null;
  defaultStatus: string | null;
  heroImageUrl: string | null;
  isActive: boolean;
  skuVarietyId?: string | null;
  skuSizeId?: string | null;
  sku: { id: string; code: string; label: string; displayName?: string | null } | null;
  aliases: ProductAlias[];
  batches: Array<{
    id: string;
    batchId: string;
    availableQuantityOverride: number | null;
    batch: {
      id: string;
      batchNumber: string;
      quantity: number;
      status: string;
      behavior: string | null;
      varietyName: string | null;
      sizeName: string | null;
    } | null;
  }>;
  prices: Array<{
    id: string;
    priceListId: string;
    priceListName: string;
    unitPriceExVat: number;
    currency: string;
    minQty: number;
    validFrom: string | null;
    validTo: string | null;
  }>;
};

export type BatchMapping = {
  id: string;
  batchNumber: string;
  varietyName: string | null;
  sizeName: string | null;
  quantity: number;
  status: string;
  plantVarietyId: string | null;
  sizeId: string | null;
  linkedProducts: Array<{
    productId: string;
    productName: string;
    productBatchId: string;
  }>;
};

export type ProductManagementPayload = {
  products: ProductSummary[];
  skus: ProductSkuOption[];
  batches: Array<{
    id: string;
    label: string;
    status: string;
    quantity: number;
    varietyId?: string | null;
    varietyName?: string | null;
    sizeId?: string | null;
    sizeName?: string | null;
  }>;
  priceLists: Array<{ id: string; name: string; currency: string; isDefault: boolean }>;
  customers: Array<{ id: string; name: string; defaultPriceListId: string | null }>;
  priceListCustomers: Array<{
    id: string;
    priceListId: string;
    customerId: string;
    priceListName: string;
    customerName: string;
    validFrom: string | null;
    validTo: string | null;
  }>;
  plantVarieties?: Array<{ id: string; name: string }>;
  plantSizes?: Array<{ id: string; name: string }>;
};

export type ProductSkuOption = {
  id: string;
  code: string;
  label: string;
  plantVarietyId: string | null;
  sizeId: string | null;
  defaultVatRate?: number | null;
  displayName?: string | null;
};

export type ProductAlias = {
  id: string;
  aliasName: string;
  customerId: string | null;
  customerName: string | null;
  customerSkuCode: string | null;
  customerBarcode: string | null;
  unitPriceExVat: number | null;
  rrp: number | null; // Recommended retail price - what customer charges end consumers
  priceListId: string | null;
  priceListName: string | null;
  isActive: boolean;
  notes: string | null;
};

export type MappingRule = {
  id: string;
  productId: string;
  name: string;
  matchFamily: string | null;
  matchGenus: string | null;
  matchCategory: string | null;
  matchSizeId: string | null;
  matchLocationId: string | null;
  minAgeWeeks: number | null;
  maxAgeWeeks: number | null;
  matchStatusIds: string[] | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined data
  product?: { id: string; name: string } | null;
  size?: { id: string; name: string } | null;
  location?: { id: string; name: string } | null;
};

export type MappingRulePreviewMatch = {
  id: string;
  batchNumber: string;
  quantity: number;
  status: string;
  varietyName: string;
  sizeName: string;
  locationName: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Product Varieties (many-to-many: products ↔ varieties)
// ─────────────────────────────────────────────────────────────────────────────

export type ProductVariety = {
  id: string;
  productId: string;
  varietyId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined data
  variety?: {
    id: string;
    name: string;
    family: string | null;
    genus: string | null;
    category: string | null;
  } | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Product Groups
// ─────────────────────────────────────────────────────────────────────────────

export type ProductGroup = {
  id: string;
  name: string;
  description: string | null;
  defaultBarcode: string | null;
  // Rule-based matching (arrays for multi-select)
  matchCategories: string[] | null;
  matchFamilies: string[] | null;
  matchGenera: string[] | null;
  matchSizeIds: string[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Computed
  memberCount?: number;
};

export type ProductGroupMember = {
  id: string;
  groupId: string;
  productId: string;
  inclusionType: 'auto' | 'manual_include' | 'manual_exclude';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined data
  product?: {
    id: string;
    name: string;
  } | null;
};

export type ProductGroupAlias = {
  id: string;
  groupId: string;
  customerId: string | null;
  aliasName: string;
  customerSkuCode: string | null;
  customerBarcode: string | null;
  unitPriceExVat: number | null;
  rrp: number | null;
  priceListId: string | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined data
  customer?: { id: string; name: string } | null;
  priceList?: { id: string; name: string } | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Order Item Preferences (fulfillment breakdown)
// ─────────────────────────────────────────────────────────────────────────────

export type OrderItemPreference = {
  id: string;
  orderItemId: string;
  productId: string | null;
  varietyId: string | null;
  requestedQty: number;
  fulfilledQty: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined data
  product?: { id: string; name: string } | null;
  variety?: { id: string; name: string } | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Extended Product Summary with varieties
// ─────────────────────────────────────────────────────────────────────────────

export type ProductWithVarieties = ProductSummary & {
  varieties: ProductVariety[];
};

// ─────────────────────────────────────────────────────────────────────────────
// Product Group with computed members
// ─────────────────────────────────────────────────────────────────────────────

export type ProductGroupWithMembers = ProductGroup & {
  members: Array<{
    productId: string;
    productName: string;
    inclusionSource: 'rule' | 'manual_include';
  }>;
  aliases: ProductGroupAlias[];
};

