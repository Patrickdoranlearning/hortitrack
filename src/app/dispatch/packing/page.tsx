import { redirect } from 'next/navigation';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { getUserAndOrg } from '@/server/auth/org';
import { getSupabaseServerApp } from '@/server/db/supabaseServerApp';
import PackingStationClient from './PackingStationClient';

interface PageProps {
  searchParams: Promise<{ batch?: string; order?: string }>;
}

export default async function PackingStationPage({ searchParams }: PageProps) {
  const { batch: batchId, order: orderId } = await searchParams;
  
  let orgId: string;
  
  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
  } catch {
    redirect('/login?next=/dispatch/packing');
  }
  
  const supabase = await getSupabaseServerApp();
  
  // If coming from bulk picking with specific order
  if (batchId && orderId) {
    // Fetch the specific order from the bulk batch
    const { data: batchOrder } = await supabase
      .from('bulk_pick_batch_orders')
      .select(`
        id,
        bulk_batch_id,
        order_id,
        packing_status,
        bulk_batch:bulk_pick_batches(
          id,
          batch_number,
          bulk_pick_items(
            id,
            sku_id,
            total_qty,
            picked_qty,
            status,
            sku:skus(
              id,
              sku_code,
              plant_variety:plant_varieties(name),
              plant_size:plant_sizes(name)
            )
          )
        ),
        order:orders(
          id,
          order_number,
          notes,
          customer:customers(name, phone),
          order_items(
            id,
            qty,
            sku:skus(
              id,
              sku_code,
              plant_variety:plant_varieties(name),
              plant_size:plant_sizes(name)
            )
          )
        )
      `)
      .eq('bulk_batch_id', batchId)
      .eq('order_id', orderId)
      .single();
    
    if (batchOrder) {
      const orderItems = (batchOrder.order as any)?.order_items || [];
      const bulkItems = (batchOrder.bulk_batch as any)?.bulk_pick_items || [];
      
      // Map order items with available quantities from bulk pick
      const packingItems = orderItems.map((item: any) => {
        const bulkItem = bulkItems.find((bi: any) => bi.sku_id === item.sku?.id);
        return {
          id: item.id,
          skuId: item.sku?.id,
          productName: item.sku?.plant_variety?.name || 'Unknown',
          size: item.sku?.plant_size?.name || '',
          orderedQty: item.qty,
          availableQty: bulkItem?.picked_qty || 0,
          packedQty: 0,
          status: 'pending' as const,
        };
      });
      
      const orderData = {
        id: (batchOrder.order as any)?.id,
        orderNumber: (batchOrder.order as any)?.order_number,
        customerName: (batchOrder.order as any)?.customer?.name || 'Unknown',
        notes: (batchOrder.order as any)?.notes,
        batchId,
        batchNumber: (batchOrder.bulk_batch as any)?.batch_number,
        items: packingItems,
      };
      
      return (
        <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
          <PackingStationClient
            mode="bulk"
            order={orderData}
          />
        </PageFrame>
      );
    }
  }
  
  // Otherwise show list of orders ready for packing
  const { data: ordersForPacking } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      status,
      notes,
      customer:customers(name),
      order_items(count),
      pick_lists(id, status),
      order_packing(id, status)
    `)
    .eq('org_id', orgId)
    .in('status', ['picking', 'ready_for_dispatch'])
    .order('created_at', { ascending: false })
    .limit(50);
  
  // Filter to orders that have completed picking
  const packableOrders = (ordersForPacking || [])
    .filter((o: any) => {
      const pickList = o.pick_lists?.[0];
      const packing = o.order_packing?.[0];
      return (
        pickList?.status === 'completed' &&
        (!packing || packing.status !== 'completed')
      );
    })
    .map((o: any) => ({
      id: o.id,
      orderNumber: o.order_number,
      customerName: o.customer?.name || 'Unknown',
      itemCount: o.order_items?.[0]?.count || 0,
      pickListId: o.pick_lists?.[0]?.id,
    }));
  
  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="dispatch">
      <div className="space-y-6">
        <ModulePageHeader
          title="Packing Station"
          description="Pack orders onto trolleys for dispatch"
        />
        <PackingStationClient
          mode="queue"
          packableOrders={packableOrders}
        />
      </div>
    </PageFrame>
  );
}

