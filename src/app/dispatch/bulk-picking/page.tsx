import { redirect } from 'next/navigation';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { getUserAndOrg } from '@/server/auth/org';
import BulkPickingClient from './BulkPickingClient';

export default async function BulkPickingPage() {
  let orgId: string;
  let supabase;

  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
    supabase = result.supabase;
  } catch {
    redirect('/login?next=/dispatch/bulk-picking');
  }
  
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

  // Fetch order items with SKU details for product grouping view
  const availableOrderIds = ordersForBulk.map((o) => o.id);
  let productGroups: Array<{
    skuId: string;
    productName: string;
    size: string;
    sizeCategoryName: string | null;
    sizeCategoryColor: string | null;
    totalUnits: number;
    orderCount: number;
    orderIds: string[];
  }> = [];

  if (availableOrderIds.length > 0) {
    const { data: orderItemsData } = await supabase
      .from('order_items')
      .select(`
        id,
        quantity,
        order_id,
        sku:skus(
          id,
          sku_code,
          plant_variety:plant_varieties(name),
          plant_size:plant_sizes(
            id,
            name,
            picking_size_category_sizes(
              category:picking_size_categories(name, color)
            )
          )
        )
      `)
      .in('order_id', availableOrderIds);

    // Aggregate by SKU
    const skuMap = new Map<string, {
      skuId: string;
      productName: string;
      size: string;
      sizeCategoryName: string | null;
      sizeCategoryColor: string | null;
      totalUnits: number;
      orderIds: Set<string>;
    }>();

    for (const item of orderItemsData || []) {
      const sku = (item as any).sku;
      if (!sku) continue;
      const skuId = sku.id;
      const existing = skuMap.get(skuId);
      const categoryMapping = sku.plant_size?.picking_size_category_sizes?.[0]?.category;

      if (existing) {
        existing.totalUnits += item.quantity;
        existing.orderIds.add(item.order_id);
      } else {
        skuMap.set(skuId, {
          skuId,
          productName: sku.plant_variety?.name || 'Unknown',
          size: sku.plant_size?.name || '',
          sizeCategoryName: categoryMapping?.name || null,
          sizeCategoryColor: categoryMapping?.color || null,
          totalUnits: item.quantity,
          orderIds: new Set([item.order_id]),
        });
      }
    }

    productGroups = Array.from(skuMap.values())
      .map(g => ({ ...g, orderCount: g.orderIds.size, orderIds: Array.from(g.orderIds) }))
      .sort((a, b) => b.totalUnits - a.totalUnits);
  }

  // Fetch size categories for grouping
  const { data: sizeCategories } = await supabase
    .from('picking_size_categories')
    .select('id, name, color, display_order')
    .eq('org_id', orgId)
    .order('display_order', { ascending: true });
  
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
    <PageFrame moduleKey="dispatch">
      <div className="space-y-6">
        <ModulePageHeader
          title="Bulk Picking"
          description="Group orders by delivery date for efficient bulk picking"
        />
        <BulkPickingClient
          existingBatches={transformedBatches}
          ordersByDate={ordersByDate}
          productGroups={productGroups}
          sizeCategories={(sizeCategories || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            color: c.color,
          }))}
        />
      </div>
    </PageFrame>
  );
}

