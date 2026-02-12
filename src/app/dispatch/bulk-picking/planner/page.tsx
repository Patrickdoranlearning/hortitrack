import { redirect } from 'next/navigation';
import { PageFrame } from '@/ui/templates';
import { ModulePageHeader } from '@/ui/templates';
import { getUserAndOrg } from '@/server/auth/org';
import { getSupabaseServerApp } from '@/server/db/supabaseServerApp';
import { format } from 'date-fns';
import PlannerClient from './PlannerClient';

// ---------------------------------------------------------------------------
// Types (server-side, transformed before passing to client)
// ---------------------------------------------------------------------------

export interface PlannerBatch {
  id: string;
  batchNumber: string;
  batchDate: string;
  status: string;
  orderCount: number;
  itemCount: number;
  totalUnits: number;
  pickedUnits: number;
}

export interface PlannerPickItem {
  id: string;
  batchId: string;
  skuId: string;
  skuCode: string;
  productName: string;
  size: string;
  totalQty: number;
  pickedQty: number;
  status: string;
  locationHint: string | null;
  assignedTo: string | null;
  assignedName: string | null;
  sizeCategoryId: string | null;
  sizeCategoryName: string | null;
  sizeCategoryColor: string | null;
}

export interface PlannerPicker {
  id: string;
  displayName: string;
  specializations: Array<{
    categoryId: string;
    categoryName: string;
    categoryColor: string | null;
    proficiency: number;
  }>;
}

export interface PlannerSizeCategory {
  id: string;
  name: string;
  color: string | null;
  displayOrder: number;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PlannerPage() {
  let orgId: string;
  let supabase: Awaited<ReturnType<typeof getSupabaseServerApp>>;

  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
    supabase = result.supabase;
  } catch {
    redirect('/login?next=/dispatch/bulk-picking/planner');
  }

  // We also want the server-app client for joins that bypass RLS edge cases
  const serverSupabase = await getSupabaseServerApp();

  const today = format(new Date(), 'yyyy-MM-dd');

  // -----------------------------------------------------------------------
  // 1. Fetch today's active batches
  // -----------------------------------------------------------------------
  const { data: rawBatches } = await supabase
    .from('bulk_pick_batches')
    .select(`
      id,
      batch_number,
      batch_date,
      status,
      bulk_pick_batch_orders(count),
      bulk_pick_items(
        id,
        total_qty,
        picked_qty
      )
    `)
    .eq('org_id', orgId)
    .eq('batch_date', today)
    .in('status', ['pending', 'in_progress', 'picked', 'packing'])
    .order('created_at', { ascending: true });

  const batches: PlannerBatch[] = (rawBatches || []).map((b: Record<string, unknown>) => {
    const items = (b.bulk_pick_items || []) as Array<{
      id: string;
      total_qty: number;
      picked_qty: number;
    }>;
    const totalUnits = items.reduce((sum, i) => sum + i.total_qty, 0);
    const pickedUnits = items.reduce((sum, i) => sum + i.picked_qty, 0);
    const orderAgg = b.bulk_pick_batch_orders as Array<{ count: number }> | undefined;
    return {
      id: b.id as string,
      batchNumber: b.batch_number as string,
      batchDate: b.batch_date as string,
      status: b.status as string,
      orderCount: orderAgg?.[0]?.count || 0,
      itemCount: items.length,
      totalUnits,
      pickedUnits,
    };
  });

  // Gather all batch IDs to fetch items
  const batchIds = batches.map((b) => b.id);

  // -----------------------------------------------------------------------
  // 2. Fetch all bulk_pick_items for those batches with joins
  // -----------------------------------------------------------------------
  let allItems: PlannerPickItem[] = [];

  if (batchIds.length > 0) {
    const { data: rawItems } = await serverSupabase
      .from('bulk_pick_items')
      .select(`
        id,
        sku_id,
        total_qty,
        picked_qty,
        status,
        location_hint,
        assigned_to,
        size_category_id,
        bulk_batch_id,
        sku:skus(
          id,
          sku_code,
          plant_variety:plant_varieties(name),
          plant_size:plant_sizes(name)
        ),
        assigned_profile:profiles!bulk_pick_items_assigned_to_fkey(id, full_name, display_name),
        size_category:picking_size_categories(id, name, color)
      `)
      .in('bulk_batch_id', batchIds);

    allItems = (rawItems || []).map((item: Record<string, unknown>) => {
      const sku = item.sku as Record<string, unknown> | null;
      const profile = item.assigned_profile as Record<string, unknown> | null;
      const category = item.size_category as Record<string, unknown> | null;
      const plantVariety = sku?.plant_variety as Record<string, unknown> | null;
      const plantSize = sku?.plant_size as Record<string, unknown> | null;

      return {
        id: item.id as string,
        batchId: item.bulk_batch_id as string,
        skuId: item.sku_id as string,
        skuCode: (sku?.sku_code as string) || '',
        productName: (plantVariety?.name as string) || 'Unknown',
        size: (plantSize?.name as string) || '',
        totalQty: item.total_qty as number,
        pickedQty: item.picked_qty as number,
        status: item.status as string,
        locationHint: item.location_hint as string | null,
        assignedTo: item.assigned_to as string | null,
        assignedName: profile
          ? (profile.display_name as string) || (profile.full_name as string) || null
          : null,
        sizeCategoryId: item.size_category_id as string | null,
        sizeCategoryName: category ? (category.name as string) : null,
        sizeCategoryColor: category ? (category.color as string | null) : null,
      };
    });
  }

  // -----------------------------------------------------------------------
  // 3. Fetch pickers: profiles that have picker_specializations for this org
  //    OR org members (fallback for when specializations are empty)
  // -----------------------------------------------------------------------
  const { data: rawSpecs } = await supabase
    .from('picker_specializations')
    .select(`
      user_id,
      category_id,
      proficiency,
      user:profiles!picker_specializations_user_id_fkey(id, full_name, display_name),
      category:picking_size_categories(id, name, color)
    `)
    .eq('org_id', orgId);

  // Build picker map from specializations
  const pickerMap = new Map<string, PlannerPicker>();

  for (const spec of rawSpecs || []) {
    const typedSpec = spec as Record<string, unknown>;
    const user = typedSpec.user as Record<string, unknown> | null;
    const category = typedSpec.category as Record<string, unknown> | null;
    const userId = typedSpec.user_id as string;

    if (!user) continue;

    if (!pickerMap.has(userId)) {
      pickerMap.set(userId, {
        id: userId,
        displayName:
          (user.display_name as string) || (user.full_name as string) || 'Unknown',
        specializations: [],
      });
    }

    if (category) {
      pickerMap.get(userId)!.specializations.push({
        categoryId: typedSpec.category_id as string,
        categoryName: category.name as string,
        categoryColor: category.color as string | null,
        proficiency: typedSpec.proficiency as number,
      });
    }
  }

  // Fallback: if no specializations, load all org members as potential pickers
  if (pickerMap.size === 0) {
    const { data: orgMembers } = await serverSupabase
      .from('org_memberships')
      .select(`
        user_id,
        profile:profiles!org_memberships_user_id_fkey(id, full_name, display_name)
      `)
      .eq('org_id', orgId);

    for (const member of orgMembers || []) {
      const typedMember = member as Record<string, unknown>;
      const profile = typedMember.profile as Record<string, unknown> | null;
      const userId = typedMember.user_id as string;

      if (!profile) continue;

      pickerMap.set(userId, {
        id: userId,
        displayName:
          (profile.display_name as string) || (profile.full_name as string) || 'Unknown',
        specializations: [],
      });
    }
  }

  const pickers = Array.from(pickerMap.values());

  // -----------------------------------------------------------------------
  // 4. Fetch size categories
  // -----------------------------------------------------------------------
  const { data: rawCategories } = await supabase
    .from('picking_size_categories')
    .select('id, name, color, display_order')
    .eq('org_id', orgId)
    .order('display_order', { ascending: true });

  const sizeCategories: PlannerSizeCategory[] = (rawCategories || []).map(
    (c: Record<string, unknown>) => ({
      id: c.id as string,
      name: c.name as string,
      color: c.color as string | null,
      displayOrder: c.display_order as number,
    })
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <PageFrame moduleKey="dispatch">
      <div className="space-y-6">
        <ModulePageHeader
          title="Morning Planner"
          description="Assign pickers to bulk picking batches for the day"
        />
        <PlannerClient
          batches={batches}
          items={allItems}
          pickers={pickers}
          sizeCategories={sizeCategories}
          todayDate={today}
        />
      </div>
    </PageFrame>
  );
}
