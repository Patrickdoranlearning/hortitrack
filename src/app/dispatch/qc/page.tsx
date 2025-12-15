import { getUserAndOrg } from '@/server/auth/org';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import { createClient } from '@/lib/supabase/server';
import QCQueueClient from './QCQueueClient';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardCheck } from 'lucide-react';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface QCQueueItem {
  id: string;
  orderNumber: string;
  customerName: string;
  itemCount: number;
  totalQty: number;
  pickCompletedAt: string | null;
  pickerName: string | null;
  status: string;
}

export default async function QCQueuePage() {
  let orgId: string;
  
  try {
    const result = await getUserAndOrg();
    orgId = result.orgId;
  } catch (e) {
    return (
      <PageFrame moduleKey="dispatch">
        <div className="space-y-6">
          <ModulePageHeader
            title="QC Review"
            description="Review and verify picked orders before dispatch"
          />
          <Card className="p-6 text-center">
            <p className="text-muted-foreground">Please log in to access QC review.</p>
          </Card>
        </div>
      </PageFrame>
    );
  }

  const supabase = await createClient();

  // Fetch pick lists that are completed and awaiting QC
  // Status 'completed' means picking is done, needs QC
  // We also include 'qc_pending' once the migration is applied
  // First, try with both statuses; if that fails, fall back to just 'completed'
  let pickLists: any[] | null = null;
  let error: any = null;

  // Try query with both statuses (after migration is applied)
  const result = await supabase
    .from('pick_lists')
    .select(`
      id,
      status,
      completed_at,
      completed_by,
      order:orders(
        id,
        order_number,
        customer:customers(name)
      ),
      pick_items(
        id,
        target_qty,
        picked_qty
      )
    `)
    .eq('org_id', orgId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: true });

  pickLists = result.data;
  error = result.error;

  // If qc_pending status exists (migration applied), also fetch those
  if (!error) {
    const qcPendingResult = await supabase
      .from('pick_lists')
      .select(`
        id,
        status,
        completed_at,
        completed_by,
        order:orders(
          id,
          order_number,
          customer:customers(name)
        ),
        pick_items(
          id,
          target_qty,
          picked_qty
        )
      `)
      .eq('org_id', orgId)
      .eq('status', 'qc_pending')
      .order('completed_at', { ascending: true });

    // Only add qc_pending results if the query succeeded (status exists)
    if (!qcPendingResult.error && qcPendingResult.data) {
      pickLists = [...(pickLists || []), ...qcPendingResult.data];
    }
  }

  if (error) {
    console.error('Error fetching QC queue:', error.message, error.code, error.details);
  }

  // Fetch completed_by user names
  const completedByIds = (pickLists || [])
    .map(pl => pl.completed_by)
    .filter(Boolean) as string[];
  
  let userMap: Record<string, string> = {};
  if (completedByIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, email')
      .in('id', completedByIds);
    
    if (profiles) {
      userMap = profiles.reduce((acc, p) => {
        acc[p.id] = p.display_name || p.email || 'Unknown';
        return acc;
      }, {} as Record<string, string>);
    }
  }

  // Transform data for the client component
  const qcItems: QCQueueItem[] = (pickLists || []).map((pl: any) => {
    const order = pl.order;
    const items = pl.pick_items || [];
    const totalQty = items.reduce((sum: number, i: any) => sum + (i.picked_qty || 0), 0);

    return {
      id: pl.id,
      orderNumber: order?.order_number || 'Unknown',
      customerName: order?.customer?.name || 'Unknown Customer',
      itemCount: items.length,
      totalQty,
      pickCompletedAt: pl.completed_at,
      pickerName: pl.completed_by ? userMap[pl.completed_by] || 'Unknown' : null,
      status: pl.status,
    };
  });

  return (
    <PageFrame moduleKey="dispatch">
      <div className="space-y-6">
        <ModulePageHeader
          title="QC Review Queue"
          description="Review and verify picked orders before dispatch"
        />

        {qcItems.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg mb-2">No Orders Awaiting QC</h3>
              <p className="text-muted-foreground">
                All picked orders have been reviewed. Check back when more orders are ready.
              </p>
            </CardContent>
          </Card>
        ) : (
          <QCQueueClient items={qcItems} />
        )}
      </div>
    </PageFrame>
  );
}

