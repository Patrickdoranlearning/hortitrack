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
  batches: Array<{ id: string; label: string; status: string; quantity: number }>;
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
  priceListId: string | null;
  priceListName: string | null;
  isActive: boolean;
  notes: string | null;
};

