'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { emitMutation } from '@/lib/events/mutation-events';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Printer, FileText, Package, ClipboardList, History, Truck, Tag, Layers } from 'lucide-react';
import { formatCurrency, type CurrencyCode } from '@/lib/format-currency';
import OrderSummaryCard from './OrderSummaryCard';
import OrderItemsTable from './OrderItemsTable';
import OrderInvoicePanel from './OrderInvoicePanel';
import OrderHistoryPanel from './OrderHistoryPanel';
import OrderStatusBadge from './OrderStatusBadge';
import SaleLabelPrintWizard, { type SaleItemData } from './SaleLabelPrintWizard';
import { AllocationTimeline } from '@/components/orders/AllocationTimeline';

export interface OrderCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  county: string | null;
  eircode: string | null;
  requires_pre_pricing?: boolean;
}

export interface OrderItem {
  id: string;
  order_id: string;
  sku_id: string;
  product_id: string | null;
  description: string | null;
  quantity: number;
  unit_price_ex_vat: number;
  vat_rate: number;
  discount_pct: number;
  line_total_ex_vat: number;
  line_vat_amount: number;
  rrp?: number | null;
  required_variety_name?: string | null;
  product?: {
    name: string | null;
  } | null;
  sku?: {
    code: string | null;
    plant_varieties?: { name: string | null } | null;
    plant_sizes?: { name: string | null } | null;
  } | null;
}

export interface OrderInvoice {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_inc_vat: number;
  balance_due: number;
}

export interface OrderPickList {
  id: string;
  status: string;
  sequence: number;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  trolleys_used: number | null;
}

export interface OrderEvent {
  id: string;
  event_type: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
  profile?: {
    display_name: string | null;
    email: string | null;
  } | null;
}

export interface OrderFee {
  id: string;
  fee_type: string;
  name: string;
  quantity: number;
  unit_amount: number;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
}

export interface OrderDetails {
  id: string;
  org_id: string;
  order_number: string;
  customer_id: string;
  ship_to_address_id: string | null;
  status: string;
  payment_status: string | null;
  requested_delivery_date: string | null;
  notes: string | null;
  currency: string;
  subtotal_ex_vat: number;
  vat_amount: number;
  total_inc_vat: number;
  trolleys_estimated: number | null;
  created_at: string;
  updated_at: string;
  customer: OrderCustomer | null;
  order_items: OrderItem[];
  order_fees: OrderFee[];
  invoices: OrderInvoice[];
  pick_lists: OrderPickList[];
  order_events: OrderEvent[];
}

interface OrderDetailPageProps {
  order: OrderDetails;
}

export default function OrderDetailPage({ order }: OrderDetailPageProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [priceLabelWizardOpen, setPriceLabelWizardOpen] = useState(false);
  const [currentLabelItem, setCurrentLabelItem] = useState<SaleItemData | null>(null);
  const handleOrderMutation = () => emitMutation({ resource: 'orders', action: 'update', id: order.id });

  const handlePrintDocket = () => {
    window.open(`/sales/orders/${order.id}/docket`, '_blank');
  };

  const handlePrintInvoice = () => {
    if (order.invoices.length > 0) {
      window.open(`/sales/orders/${order.id}/invoice`, '_blank');
    }
  };

  const handlePrintDispatchDocuments = () => {
    window.open(`/sales/orders/${order.id}/dispatch-documents`, '_blank');
  };

  // Handle printing price labels for an item
  const handlePrintPriceLabel = (item: OrderItem) => {
    // Use RRP if available, otherwise fall back to unit price with VAT
    const price = item.rrp ?? (item.unit_price_ex_vat * (1 + (item.vat_rate || 0.23)));
    const currency = (order.currency === 'GBP' ? 'GBP' : 'EUR') as CurrencyCode;
    const priceText = formatCurrency(price, currency);

    const productName = item.sku?.plant_varieties?.name || item.description || 'Product';
    const size = item.sku?.plant_sizes?.name || '';

    setCurrentLabelItem({
      productTitle: productName,
      size,
      priceText,
      barcode: item.sku?.code || item.sku_id,
      quantity: item.quantity,
    });
    setPriceLabelWizardOpen(true);
  };

  // Show dispatch documents button for orders that are ready for dispatch or later
  const showDispatchDocs = ['ready', 'packed', 'dispatched', 'delivered'].includes(order.status);

  // Check if customer requires pre-pricing
  const requiresPrePricing = order.customer?.requires_pre_pricing ?? false;

  // Check if any items have RRP set
  const hasRrpItems = order.order_items.some(item => item.rrp != null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/sales/orders">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Order #{order.order_number}</h1>
              <OrderStatusBadge status={order.status} />
              {requiresPrePricing && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-300">
                  <Tag className="h-3 w-3 mr-1" />
                  Pre-Pricing Required
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {order.customer?.name || 'Unknown Customer'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(requiresPrePricing || hasRrpItems) && order.order_items.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
              onClick={() => handlePrintPriceLabel(order.order_items[0])}
            >
              <Tag className="h-4 w-4 mr-2" />
              Print Price Labels
            </Button>
          )}
          {showDispatchDocs && (
            <Button size="sm" onClick={handlePrintDispatchDocuments} className="bg-green-600 hover:bg-green-700">
              <Truck className="h-4 w-4 mr-2" />
              Print Dispatch Docs
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrintDocket}>
            <Printer className="h-4 w-4 mr-2" />
            Delivery Docket
          </Button>
          {order.invoices.length > 0 && (
            <Button variant="outline" size="sm" onClick={handlePrintInvoice}>
              <FileText className="h-4 w-4 mr-2" />
              View Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Tabs - Overview, Items, Allocations, Invoice, History */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <Package className="h-4 w-4 hidden sm:inline" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="items" className="gap-2">
            <ClipboardList className="h-4 w-4 hidden sm:inline" />
            Items
          </TabsTrigger>
          <TabsTrigger value="allocations" className="gap-2">
            <Layers className="h-4 w-4 hidden sm:inline" />
            Allocations
          </TabsTrigger>
          <TabsTrigger value="invoice" className="gap-2">
            <FileText className="h-4 w-4 hidden sm:inline" />
            Invoice
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4 hidden sm:inline" />
            History
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview" className="mt-0">
            <OrderSummaryCard order={order} onStatusChange={handleOrderMutation} />
          </TabsContent>

          <TabsContent value="items" className="mt-0">
            <OrderItemsTable
              orderId={order.id}
              items={order.order_items}
              status={order.status}
              onItemsChange={handleOrderMutation}
              currency={(order.currency === 'GBP' ? 'GBP' : 'EUR') as CurrencyCode}
              fees={order.order_fees}
              requiresPrePricing={requiresPrePricing}
            />
          </TabsContent>

          <TabsContent value="allocations" className="mt-0">
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Track stock allocations for this order. Tier 1 allocations reserve product-level stock;
                  Tier 2 allocations reserve specific batches.
                </p>
              </div>
              <AllocationTimeline
                orderId={order.id}
                title="Allocation Events"
                collapsible={false}
                initialLimit={20}
              />
            </div>
          </TabsContent>

          <TabsContent value="invoice" className="mt-0">
            <OrderInvoicePanel 
              orderId={order.id}
              customerId={order.customer_id}
              customerName={order.customer?.name || 'Unknown Customer'}
              orderItems={order.order_items}
              invoices={order.invoices}
              orderStatus={order.status}
              subtotal={order.subtotal_ex_vat}
              vat={order.vat_amount}
              total={order.total_inc_vat}
              onInvoiceGenerated={handleOrderMutation}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <OrderHistoryPanel events={order.order_events} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Price Label Print Wizard */}
      {currentLabelItem && (
        <SaleLabelPrintWizard
          open={priceLabelWizardOpen}
          onOpenChange={setPriceLabelWizardOpen}
          item={currentLabelItem}
        />
      )}
    </div>
  );
}
