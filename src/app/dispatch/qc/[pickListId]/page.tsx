import { getUserAndOrg } from '@/server/auth/org';
import { PageFrame } from '@/ui/templates';
import { notFound } from 'next/navigation';
import QCReviewClient from './QCReviewClient';
import { Card, CardContent } from '@/components/ui/card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface QCReviewPageProps {
  params: Promise<{ pickListId: string }>;
}

export interface QCPickItem {
  id: string;
  orderItemId: string;
  targetQty: number;
  pickedQty: number;
  status: string;
  description: string | null;
  varietyName: string | null;
  sizeName: string | null;
  batchNumber: string | null;
  locationName: string | null;
}

export interface QCOrderDetails {
  pickListId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string | null;
  deliveryDate: string | null;
  notes: string | null;
  pickerName: string | null;
  pickCompletedAt: string | null;
  items: QCPickItem[];
}

export default async function QCReviewPage({ params }: QCReviewPageProps) {
  const { pickListId } = await params;

  let orgId: string;
  let userId: string;
  let supabase;

  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
    userId = result.user.id;
    supabase = result.supabase;
  } catch (e) {
    return (
      <PageFrame moduleKey="dispatch">
        <Card className="p-6 text-center">
          <p className="text-muted-foreground">Please log in to access QC review.</p>
        </Card>
      </PageFrame>
    );
  }

  // Fetch pick list with order and items
  const { data: pickList, error } = await supabase
    .from('pick_lists')
    .select(`
      id,
      status,
      completed_at,
      completed_by,
      notes,
      order:orders(
        id,
        order_number,
        requested_delivery_date,
        notes,
        customer:customers(name, phone)
      )
    `)
    .eq('id', pickListId)
    .eq('org_id', orgId)
    .single();

  if (error || !pickList) {
    console.error('Pick list not found:', error);
    notFound();
  }

  // Fetch pick items with enhanced details
  const { data: pickItems } = await supabase
    .from('pick_items')
    .select(`
      id,
      order_item_id,
      target_qty,
      picked_qty,
      status,
      notes,
      order_item:order_items(
        description,
        sku:skus(
          plant_varieties(name),
          plant_sizes(name)
        )
      ),
      picked_batch:picked_batch_id(
        batch_number,
        nursery_locations(name)
      )
    `)
    .eq('pick_list_id', pickListId);

  // Get picker name
  let pickerName: string | null = null;
  if (pickList.completed_by) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', pickList.completed_by)
      .single();
    
    if (profile) {
      pickerName = profile.display_name || profile.email || null;
    }
  }

  // Transform data
  const order = pickList.order as any;
  const customer = order?.customer;

  const items: QCPickItem[] = (pickItems || []).map((pi: any) => {
    const orderItem = pi.order_item;
    const sku = orderItem?.sku;
    const pickedBatch = pi.picked_batch;

    return {
      id: pi.id,
      orderItemId: pi.order_item_id,
      targetQty: pi.target_qty,
      pickedQty: pi.picked_qty,
      status: pi.status,
      description: orderItem?.description || null,
      varietyName: sku?.plant_varieties?.name || null,
      sizeName: sku?.plant_sizes?.name || null,
      batchNumber: pickedBatch?.batch_number || null,
      locationName: pickedBatch?.nursery_locations?.name || null,
    };
  });

  const orderDetails: QCOrderDetails = {
    pickListId: pickList.id,
    orderId: order?.id,
    orderNumber: order?.order_number || 'Unknown',
    customerName: customer?.name || 'Unknown Customer',
    customerPhone: customer?.phone || null,
    deliveryDate: order?.requested_delivery_date || null,
    notes: order?.notes || pickList.notes || null,
    pickerName,
    pickCompletedAt: pickList.completed_at,
    items,
  };

  return (
    <PageFrame moduleKey="dispatch">
      <QCReviewClient order={orderDetails} userId={userId} />
    </PageFrame>
  );
}




