import { z } from "zod";

// --- Enums (matching DB types) ---
export const ProductionPhase = z.enum(['propagation', 'growing', 'finished']);
export const ProductionStatus = z.enum(['Propagation', 'Plugs/Liners', 'Potted', 'Ready for Sale', 'Looking Good', 'Archived']);
export const CreditStatus = z.enum(['draft', 'issued', 'paid', 'void']);
export const DeliveryStatus = z.enum(['unscheduled', 'scheduled', 'departed', 'delivered', 'cancelled']);
export const InvoiceStatus = z.enum(['draft', 'issued', 'paid', 'void', 'overdue']);
export const SubstitutionStatus = z.enum(['requested', 'approved', 'rejected', 'applied']);
export const OrderStatus = z.enum(['draft', 'confirmed', 'processing', 'ready_for_dispatch', 'dispatched', 'delivered', 'cancelled']);
export const OrgRole = z.enum(['owner', 'admin', 'grower', 'sales', 'viewer']);
export const FeedbackSeverity = z.enum(['info', 'warning', 'critical']);
export const ResolutionStatus = z.enum(['open', 'in_progress', 'resolved', 'wont_fix']);
export const SizeContainerType = z.enum(['pot', 'tray', 'bareroot']);
export const VehicleType = z.enum(['van', 'truck', 'trailer']);

// --- Organizations ---
export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  countryCode: z.string().default('IE'),
  producerCode: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Organization = z.infer<typeof OrganizationSchema>;

// --- Sites ---
export const SiteSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
});
export type Site = z.infer<typeof SiteSchema>;

// --- Locations ---
export const NurseryLocationSchema = z.object({
  id: z.string().optional(),
  orgId: z.string(),
  siteId: z.string().optional(),
  name: z.string().min(1, "Location name is required"),
  nurserySite: z.string(), // Kept for compatibility/display
  covered: z.boolean().default(false),
  type: z.string().optional(),
  area: z.number().optional(),
  capacity: z.number().int().nonnegative().optional(),
});
export type NurseryLocation = z.infer<typeof NurseryLocationSchema>;

// --- Plant Sizes ---
export const PlantSizeSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Size name is required"),
  containerType: SizeContainerType.default('pot'),
  cellMultiple: z.number().int().min(1).default(1),
  shelfQuantity: z.number().int().nonnegative().optional(),
  area: z.number().nonnegative().optional(),
  cellDiameterMm: z.number().optional(),
  cellVolumeL: z.number().optional(),
  cellWidthMm: z.number().optional(),
  cellLengthMm: z.number().optional(),
  cellShape: z.enum(['round', 'square']).optional(),
});
export type PlantSize = z.infer<typeof PlantSizeSchema>;

// --- Plant Varieties ---
export const VarietySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  family: z.string().optional(),
  genus: z.string().optional(),
  species: z.string().optional(),
  category: z.string().optional(),
  colour: z.string().optional(),
  commonName: z.string().optional(),
  grouping: z.string().optional(),
  floweringPeriod: z.string().optional(),
  flowerColour: z.string().optional(),
  evergreen: z.boolean().optional(),
  plantBreedersRights: z.boolean().optional(),
  rating: z.number().min(1).max(6).optional(),
});
export type Variety = z.infer<typeof VarietySchema>;

// --- Suppliers ---
export const SupplierSchema = z.object({
  id: z.string().optional(),
  orgId: z.string(),
  name: z.string().min(1, 'Supplier name is required'),
  producerCode: z.string().optional(),
  countryCode: z.string().default('IE'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  eircode: z.string().optional(),
  supplierType: z.string().optional(),
});
export type Supplier = z.infer<typeof SupplierSchema>;

// --- Price Lists ---
export const PriceListSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  currency: z.string().default('EUR'),
  isDefault: z.boolean().default(false),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
});
export type PriceList = z.infer<typeof PriceListSchema>;

// --- Customers ---
export const CustomerSchema = z.object({
  id: z.string().optional(),
  orgId: z.string(),
  code: z.string().optional(),
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  vatNumber: z.string().optional(),
  notes: z.string().optional(),
  defaultPriceListId: z.string().optional(),
  store: z.string().optional(),
  accountsEmail: z.string().email().optional(),
  pricingTier: z.string().optional(),
});
export type Customer = z.infer<typeof CustomerSchema>;

export const CustomerAddressSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  label: z.string(),
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  eircode: z.string().optional(),
  countryCode: z.string().default('IE'),
  isDefaultShipping: z.boolean().default(false),
  isDefaultBilling: z.boolean().default(false),
});
export type CustomerAddress = z.infer<typeof CustomerAddressSchema>;

// --- Batches ---
export const BatchSchema = z.object({
  id: z.string().optional(),
  orgId: z.string(),
  batchNumber: z.string(),
  phase: ProductionPhase.default('propagation'),
  supplierId: z.string().optional(),
  plantVarietyId: z.string(),
  sizeId: z.string(),
  locationId: z.string(),
  status: ProductionStatus.default('Propagation'),
  quantity: z.number().int().nonnegative().default(0),
  initialQuantity: z.number().int().nonnegative().optional(),
  quantityProduced: z.number().int().optional(),
  unit: z.string().default('plants'),
  plantedAt: z.string().optional(), // date
  readyAt: z.string().optional(), // date
  dispatchedAt: z.string().optional(), // date
  archivedAt: z.string().optional(), // timestamp
  qrCode: z.string().optional(),
  qrImageUrl: z.string().optional(),
  passportOverrideA: z.string().optional(),
  passportOverrideB: z.string().optional(),
  passportOverrideC: z.string().optional(),
  passportOverrideD: z.string().optional(),
  logHistory: z.array(z.any()).default([]), // Keeping as any for now to avoid circular dep issues or complex migration
  supplierBatchNumber: z.string().default(''),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),

  // Expanded fields for UI convenience (joined data)
  plantVariety: z.any().optional(), // Joined Variety object
  size: z.any().optional(), // Joined Size object
  location: z.any().optional(), // Joined Location object
});
export type Batch = z.infer<typeof BatchSchema>;

// --- Batch Logs ---
export const BatchLogSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  batchId: z.string(),
  type: z.string(),
  note: z.string().optional(),
  qtyChange: z.number().int().optional(),
  actorId: z.string().optional(),
  occurredAt: z.string(),
  createdAt: z.string(),
});
export type BatchLog = z.infer<typeof BatchLogSchema>;

// --- SKUs ---
export const SkuSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  code: z.string(),
  plantVarietyId: z.string(),
  sizeId: z.string(),
  description: z.string().optional(),
  barcode: z.string().optional(),
  defaultVatRate: z.number().default(13.5),
});
export type Sku = z.infer<typeof SkuSchema>;

// --- Orders ---
export const OrderSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  orderNumber: z.string(),
  customerId: z.string(),
  shipToAddressId: z.string().optional(),
  status: OrderStatus.default('draft'),
  paymentStatus: z.string().optional(),
  requestedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  subtotalExVat: z.number().default(0),
  vatAmount: z.number().default(0),
  totalIncVat: z.number().default(0),
  trolleysEstimated: z.number().int().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),

  // UI Helpers
  customerName: z.string().optional(),
});
export type Order = z.infer<typeof OrderSchema>;

export const OrderItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  skuId: z.string(),
  description: z.string().optional(),
  quantity: z.number().int().nonnegative(),
  unitPriceExVat: z.number().nonnegative(),
  vatRate: z.number().nonnegative(),
  discountPct: z.number().min(0).max(100).default(0),
  lineTotalExVat: z.number().default(0),
  lineVatAmount: z.number().default(0),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

// --- Profiles ---
export const ProfileSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  email: z.string().optional(),
  activeOrgId: z.string().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

// --- Org Memberships ---
export const OrgMembershipSchema = z.object({
  orgId: z.string(),
  userId: z.string(),
  role: OrgRole.default('viewer'),
});
export type OrgMembership = z.infer<typeof OrgMembershipSchema>;

// --- Hauliers ---
export const HaulierSchema = z.object({
  id: z.string().optional(),
  orgId: z.string(),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type Haulier = z.infer<typeof HaulierSchema>;
