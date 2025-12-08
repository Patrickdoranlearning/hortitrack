import { redirect } from 'next/navigation';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { getUserAndOrg } from '@/server/auth/org';
import BulkPickingClient from './BulkPickingClient';
import { getSupabaseServerApp } from '@/server/db/supabaseServerApp';

export default async function BulkPickingPage() {
  let orgId: string;
  
  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
  } catch {
    redirect('/login?next=/dispatch/bulk-picking');
  }
  
  const supabase = await getSupabaseServerApp();
  
  // Fetch existing bulk pick batches
  const { data: batches } = await supabase
    .from('bulk_pick_batches')
    .select(`
      *,
      bulk_pick_batch_orders(count),
      bulk_pick_items(count)
    `)
    .eq('org_id', orgId)
    .in('status', ['pending', 'in_progress', 'picked', 'packing'])
    .order('batch_date', { ascending: false })
    .limit(20);
  
  // Fetch orders available for bulk picking (confirmed orders with pick lists, not in any bulk batch)
  const { data: availableOrders } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      requested_delivery_date,
      status,
      customer:customers(name),
      pick_lists(id, status),
      order_items(count)
    `)
    .eq('org_id', orgId)
    .eq('status', 'confirmed')
    .order('requested_delivery_date', { ascending: true })
    .limit(100);
  
  // Filter out orders already in bulk batches
  const { data: batchedOrderIds } = await supabase
    .from('bulk_pick_batch_orders')
    .select('order_id');
  
  const batchedIds = new Set((batchedOrderIds || []).map((o: any) => o.order_id));
  
  const ordersForBulk = (availableOrders || [])
    .filter((o: any) => !batchedIds.has(o.id))
    .map((o: any) => ({
      id: o.id,
      orderNumber: o.order_number,
      customerName: o.customer?.name || 'Unknown',
      deliveryDate: o.requested_delivery_date,
      status: o.status,
      pickListId: o.pick_lists?.[0]?.id,
      pickListStatus: o.pick_lists?.[0]?.status,
      itemCount: o.order_items?.[0]?.count || 0,
    }));
  
  // Group orders by delivery date
  const ordersByDate = ordersForBulk.reduce((acc: Record<string, typeof ordersForBulk>, order) => {
    const date = order.deliveryDate || 'No Date';
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(order);
    return acc;
  }, {});
  
  const transformedBatches = (batches || []).map((b: any) => ({
    id: b.id,
    batchNumber: b.batch_number,
    batchDate: b.batch_date,
    status: b.status,
    startedAt: b.started_at,
    completedAt: b.completed_at,
    orderCount: b.bulk_pick_batch_orders?.[0]?.count || 0,
    itemCount: b.bulk_pick_items?.[0]?.count || 0,
  }));
  
  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
      <div className="space-y-6">
        <ModulePageHeader
          title="Bulk Picking"
          description="Group orders by delivery date for efficient bulk picking"
        />
        <BulkPickingClient
          existingBatches={transformedBatches}
          ordersByDate={ordersByDate}
        />
      </div>
    </PageFrame>
  );
}

