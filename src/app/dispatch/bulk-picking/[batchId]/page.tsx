import { notFound, redirect } from 'next/navigation';
import { PageFrame } from '@/ui/templates';
import { getUserAndOrg } from '@/server/auth/org';
import { getSupabaseServerApp } from '@/server/db/supabaseServerApp';
import BulkPickingWorkflowClient from './BulkPickingWorkflowClient';

interface PageProps {
  params: Promise<{ batchId: string }>;
}

export default async function BulkPickingBatchPage({ params }: PageProps) {
  const { batchId } = await params;
  
  let orgId: string;
  
  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
  } catch (error) {
    redirect('/login?next=/dispatch/bulk-picking');
  }
  
  const supabase = await getSupabaseServerApp();
  
  // Fetch batch with all details
  const { data: batch, error } = await supabase
    .from('bulk_pick_batches')
    .select(`
      *,
      bulk_pick_batch_orders(
        id,
        order_id,
        pick_list_id,
        packing_status,
        packed_at,
        order:orders(
          id,
          order_number,
          requested_delivery_date,
          notes,
          customer:customers(name, phone)
        )
      ),
      bulk_pick_items(
        id,
        sku_id,
        total_qty,
        picked_qty,
        status,
        picked_batch_id,
        substitute_batch_id,
        substitution_reason,
        location_hint,
        assigned_to,
        size_category_id,
        sku:skus(
          id,
          sku_code,
          plant_variety:plant_varieties(name),
          plant_size:plant_sizes(name)
        ),
        assigned_profile:profiles!bulk_pick_items_assigned_to_fkey(id, full_name, display_name),
        size_category:picking_size_categories(id, name, color)
      )
    `)
    .eq('id', batchId)
    .eq('org_id', orgId)
    .single();
  
  if (error || !batch) {
    notFound();
  }
  
  // Transform data
  const transformedBatch = {
    id: batch.id,
    batchNumber: batch.batch_number,
    batchDate: batch.batch_date,
    status: batch.status,
    startedAt: batch.started_at,
    completedAt: batch.completed_at,
    notes: batch.notes,
    orders: (batch.bulk_pick_batch_orders || []).map((bo: any) => ({
      id: bo.id,
      orderId: bo.order_id,
      pickListId: bo.pick_list_id,
      packingStatus: bo.packing_status,
      packedAt: bo.packed_at,
      orderNumber: bo.order?.order_number,
      customerName: bo.order?.customer?.name,
      customerPhone: bo.order?.customer?.phone,
      deliveryDate: bo.order?.requested_delivery_date,
      notes: bo.order?.notes,
    })),
    items: (batch.bulk_pick_items || []).map((item: any) => ({
      id: item.id,
      skuId: item.sku_id,
      skuCode: item.sku?.sku_code,
      productName: item.sku?.plant_variety?.name || 'Unknown',
      size: item.sku?.plant_size?.name || '',
      totalQty: item.total_qty,
      pickedQty: item.picked_qty,
      status: item.status,
      pickedBatchId: item.picked_batch_id,
      substituteBatchId: item.substitute_batch_id,
      substitutionReason: item.substitution_reason,
      locationHint: item.location_hint,
      assignedTo: item.assigned_to,
      assignedName: item.assigned_profile?.full_name || item.assigned_profile?.display_name || null,
      sizeCategoryId: item.size_category_id,
      sizeCategoryName: item.size_category?.name || null,
      sizeCategoryColor: item.size_category?.color || null,
    })),
  };
  
  return (
    <PageFrame moduleKey="dispatch">
      <BulkPickingWorkflowClient batch={transformedBatch} />
    </PageFrame>
  );
}

