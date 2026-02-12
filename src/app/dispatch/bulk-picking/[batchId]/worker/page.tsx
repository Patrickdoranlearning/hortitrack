import { notFound, redirect } from 'next/navigation';
import { getUserAndOrg } from '@/server/auth/org';
import { getSupabaseServerApp } from '@/server/db/supabaseServerApp';
import WorkerViewClient from './WorkerViewClient';

interface PageProps {
  params: Promise<{ batchId: string }>;
}

export default async function WorkerViewPage({ params }: PageProps) {
  const { batchId } = await params;

  let orgId: string;
  let userId: string;

  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
    userId = result.user.id;
  } catch {
    redirect('/login?next=/dispatch/bulk-picking');
  }

  const supabase = await getSupabaseServerApp();

  // Fetch the batch details
  const { data: batch, error: batchError } = await supabase
    .from('bulk_pick_batches')
    .select('id, batch_number, batch_date, status')
    .eq('id', batchId)
    .eq('org_id', orgId)
    .single();

  if (batchError || !batch) {
    notFound();
  }

  // Fetch only items assigned to the current user
  const { data: items, error: itemsError } = await supabase
    .from('bulk_pick_items')
    .select(`
      id,
      sku_id,
      total_qty,
      picked_qty,
      status,
      location_hint,
      size_category_id,
      sku:skus(
        id,
        sku_code,
        plant_variety:plant_varieties(name),
        plant_size:plant_sizes(name)
      ),
      size_category:picking_size_categories(id, name, color)
    `)
    .eq('bulk_batch_id', batchId)
    .eq('assigned_to', userId);

  if (itemsError) {
    notFound();
  }

  // Fetch the picker's profile name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, display_name')
    .eq('id', userId)
    .single();

  const pickerName = profile?.full_name || profile?.display_name || 'Unknown Picker';

  // Collect unique category names
  const categorySet = new Set<string>();
  (items || []).forEach((item: Record<string, unknown>) => {
    const category = item.size_category as { name?: string } | null;
    if (category?.name) {
      categorySet.add(category.name);
    }
  });

  // Transform and sort items: by location_hint then by product name
  const transformedItems = (items || [])
    .map((item: Record<string, unknown>) => {
      const sku = item.sku as { sku_code?: string; plant_variety?: { name?: string }; plant_size?: { name?: string } } | null;
      const sizeCategory = item.size_category as { id?: string; name?: string; color?: string } | null;

      return {
        id: item.id as string,
        skuId: item.sku_id as string,
        skuCode: sku?.sku_code || '',
        productName: sku?.plant_variety?.name || 'Unknown',
        size: sku?.plant_size?.name || '',
        totalQty: item.total_qty as number,
        pickedQty: item.picked_qty as number,
        status: item.status as 'pending' | 'picked' | 'short' | 'substituted',
        locationHint: (item.location_hint as string) || null,
        sizeCategoryName: sizeCategory?.name || null,
        sizeCategoryColor: sizeCategory?.color || null,
      };
    })
    .sort((a, b) => {
      // Sort by location_hint first (nulls last), then by product name
      const locA = a.locationHint || '\uffff';
      const locB = b.locationHint || '\uffff';
      const locCompare = locA.localeCompare(locB);
      if (locCompare !== 0) return locCompare;
      return a.productName.localeCompare(b.productName);
    });

  const workerData = {
    batchId: batch.id as string,
    batchNumber: batch.batch_number as string,
    batchDate: batch.batch_date as string,
    batchStatus: batch.status as string,
    pickerName,
    categories: Array.from(categorySet),
    items: transformedItems,
  };

  return <WorkerViewClient data={workerData} />;
}
