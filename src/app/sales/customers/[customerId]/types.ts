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
