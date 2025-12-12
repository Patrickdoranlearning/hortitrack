import { Button } from '@/components/ui/button';
import Link from 'next/link';
import * as React from 'react';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { PageFrame } from '@/ui/templates/PageFrame';
import { createClient } from '@/lib/supabase/server';
import { startOfWeek, endOfWeek, addWeeks, formatISO, format } from 'date-fns';
import { 
  ClipboardList, 
  ShoppingBag, 
  FileText, 
  TrendingUp, 
  Clock, 
  Target,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SalesAdminInbox, type AdminTask } from '@/components/sales/dashboard/SalesAdminInbox';

export default async function SalesOperationsPage() {
  const supabase = await createClient();
  const now = new Date();

  // Current Week Range
  const startCurrent = startOfWeek(now, { weekStartsOn: 1 });
  const endCurrent = endOfWeek(now, { weekStartsOn: 1 });

  // Next Week Range
  const startNext = startOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });
  const endNext = endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 });

  // Fetch admin inbox tasks from the view
  const { data: tasksData } = await supabase
    .from('v_sales_admin_inbox')
    .select('*')
    .order('priority', { ascending: false })
    .order('task_date', { ascending: true });

  const tasks = (tasksData || []) as AdminTask[];

  // Fetch Current Week Orders
  const { data: currentOrders } = await supabase
    .from('orders')
    .select('total_inc_vat')
    .gte('created_at', formatISO(startCurrent))
    .lte('created_at', formatISO(endCurrent));

  // Fetch Next Week Orders
  const { data: nextOrders } = await supabase
    .from('orders')
    .select('total_inc_vat')
    .gte('requested_delivery_date', formatISO(startNext))
    .lte('requested_delivery_date', formatISO(endNext));

  const currentWeekRevenue = currentOrders?.reduce((sum, order) => sum + (order.total_inc_vat || 0), 0) || 0;
  const nextWeekRevenue = nextOrders?.reduce((sum, order) => sum + (order.total_inc_vat || 0), 0) || 0;

  // Count tasks by type
  const webshopCount = tasks.filter(t => t.task_type === 'webshop_approval').length;
  const invoiceCount = tasks.filter(t => t.task_type === 'dispatch_prep' || t.task_type === 'invoice_pending').length;
  const draftCount = tasks.filter(t => t.task_type === 'stale_draft').length;

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="sales">
      <div className="space-y-6 max-w-5xl mx-auto">
        <ModulePageHeader
          title="Sales Operations"
          description="Manage orders, approvals, and invoicing."
          actionsSlot={
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/sales/targets">
                  <Target className="mr-2 h-4 w-4" />
                  Sales Targets
                </Link>
              </Button>
              <Button asChild>
                <Link href="/sales/orders/new">
                  <Plus className="mr-2 h-4 w-4" />
                  New Order
                </Link>
              </Button>
            </div>
          }
        />

        {/* Quick Navigation */}
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="secondary" size="sm" className="gap-2">
            <Link href="/sales/orders">
              <ShoppingBag className="h-4 w-4" />
              All Orders
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/dispatch/picking">
              <ClipboardList className="h-4 w-4" />
              Picking Queue
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/sales/invoices">
              <FileText className="h-4 w-4" />
              Invoices
            </Link>
          </Button>
        </div>

        {/* Summary Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inbox Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tasks.length}</div>
              <p className="text-xs text-muted-foreground">
                {webshopCount} webshop, {invoiceCount} invoices, {draftCount} drafts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Week</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentOrders?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                €{currentWeekRevenue.toFixed(0)} revenue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Next Week</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{nextOrders?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                €{nextWeekRevenue.toFixed(0)} expected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Invoices Pending</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tasks.filter(t => (t.task_type === 'dispatch_prep' || t.task_type === 'invoice_pending') && t.priority >= 2).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Need invoices generated
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Inbox */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            Inbox
            {tasks.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({tasks.length} tasks)
              </span>
            )}
          </h2>
          <SalesAdminInbox tasks={tasks} />
        </div>
      </div>
    </PageFrame>
  );
}
