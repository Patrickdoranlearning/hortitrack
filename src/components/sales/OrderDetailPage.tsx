'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, FileText, Package, ClipboardList, History, Truck } from 'lucide-react';
import OrderSummaryCard from './OrderSummaryCard';
import OrderItemsTable from './OrderItemsTable';
import OrderInvoicePanel from './OrderInvoicePanel';
import OrderHistoryPanel from './OrderHistoryPanel';
import OrderStatusBadge from './OrderStatusBadge';

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
  subtotal_ex_vat: number;
  vat_amount: number;
  total_inc_vat: number;
  trolleys_estimated: number | null;
  created_at: string;
  updated_at: string;
  customer: OrderCustomer | null;
  order_items: OrderItem[];
  invoices: OrderInvoice[];
  pick_lists: OrderPickList[];
  order_events: OrderEvent[];
}

interface OrderDetailPageProps {
  order: OrderDetails;
}

export default function OrderDetailPage({ order }: OrderDetailPageProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');

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

  // Show dispatch documents button for orders that are ready for dispatch or later
  const showDispatchDocs = ['ready_for_dispatch', 'dispatched', 'delivered'].includes(order.status);

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
            </div>
            <p className="text-muted-foreground">
              {order.customer?.name || 'Unknown Customer'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Tabs - Simplified: Overview, Items, Invoice, History */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <Package className="h-4 w-4 hidden sm:inline" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="items" className="gap-2">
            <ClipboardList className="h-4 w-4 hidden sm:inline" />
            Items
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
            <OrderSummaryCard order={order} onStatusChange={() => router.refresh()} />
          </TabsContent>

          <TabsContent value="items" className="mt-0">
            <OrderItemsTable 
              orderId={order.id}
              items={order.order_items} 
              status={order.status}
              onItemsChange={() => router.refresh()}
            />
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
              onInvoiceGenerated={() => router.refresh()}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <OrderHistoryPanel events={order.order_events} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
