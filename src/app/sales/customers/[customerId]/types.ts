import type { CustomerSummary } from "../types";

// Order summary for customer detail page
export type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  requestedDeliveryDate: string | null;
  subtotalExVat: number;
  vatAmount: number;
  totalIncVat: number;
  itemCount: number;
};

// Favourite product aggregated from order history
export type FavouriteProduct = {
  skuId: string;
  productName: string;
  varietyName: string | null;
  sizeName: string | null;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  lastOrderDate: string;
};

// Last order week info
export type LastOrderWeek = {
  week: number;
  year: number;
} | null;

// Combined data for the customer detail page
export type CustomerDetailData = {
  customer: CustomerSummary;
  orders: CustomerOrder[];
  favouriteProducts: FavouriteProduct[];
  lastOrderWeek: LastOrderWeek;
  stats: CustomerStats;
};

// Customer statistics
export type CustomerStats = {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
};

// Extended customer statistics for insights
export type ExtendedCustomerStats = CustomerStats & {
  averageDaysBetweenOrders: number | null;
  ordersLast12Months: number;
  ordersByMonth: Array<{ month: string; count: number }>;
  daysSinceLastOrder: number | null;
  healthStatus: 'active' | 'at_risk' | 'churning' | 'new';
};

// Customer interaction record
export type CustomerInteraction = {
  id: string;
  type: 'call' | 'email' | 'visit' | 'whatsapp' | 'other';
  notes: string | null;
  outcome: string | null;
  createdAt: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
};

// Customer follow-up record
export type CustomerFollowUp = {
  id: string;
  customerId: string;
  sourceInteractionId: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  dueDate: string;
  title: string;
  description: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  completedAt: string | null;
  completedByName: string | null;
  createdAt: string;
};

// Customer milestone record
export type MilestoneType = 'anniversary' | 'first_order' | 'contract_renewal' | 'seasonal_peak' | 'custom';

export type CustomerMilestone = {
  id: string;
  customerId: string;
  milestoneType: MilestoneType;
  title: string;
  description: string | null;
  eventDate: string;
  recurring: boolean;
  createdAt: string;
};

// =============================================================================
// STORE-LEVEL TYPES (for store drill-down feature)
// =============================================================================

// Store with aggregated order metrics from v_store_order_metrics view
export type StoreWithMetrics = {
  addressId: string;
  customerId: string;
  label: string;
  storeName: string | null;
  city: string | null;
  county: string | null;
  orderCount: number;
  totalRevenue: number;
  avgOrderValue: number;
  lastOrderAt: string | null;
};

// Order for a specific store (filtered by ship_to_address_id)
export type StoreOrder = {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  requestedDeliveryDate: string | null;
  subtotalExVat: number;
  vatAmount: number;
  totalIncVat: number;
  itemCount: number;
};

// Top product for a store (aggregated from order_items)
export type StoreTopProduct = {
  skuId: string;
  productName: string;
  varietyName: string | null;
  sizeName: string | null;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  lastOrderDate: string;
};

// Store preferences (stored as JSONB in customer_addresses.preferences)
export type StorePreferences = {
  deliveryNotes?: string;
  preferredDeliveryDay?: string;
  preferredTrolleyType?: string;
  orderFrequencyTarget?: number; // days between orders
  specialInstructions?: string;
};

// Store order frequency data for chart
export type StoreOrderFrequency = {
  ordersByMonth: Array<{ month: string; count: number }>;
  ordersLast12Months: number;
  averageDaysBetweenOrders: number | null;
};

// Extended store type with preferences
export type StoreWithMetricsAndPreferences = StoreWithMetrics & {
  preferences: StorePreferences;
};
