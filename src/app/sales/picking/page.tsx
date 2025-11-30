
import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import PickingListClient from './PickingListClient';
import { PickOrder } from '@/lib/sales/types';

export default async function SalesPickingPage() {
    const supabase = await createClient();

    const { data: pickOrders } = await supabase
        .from('pick_orders')
        .select('*, order_items(order_id)')
        .order('created_at', { ascending: false });

    return (
        <PageFrame companyName="Doran Nurseries" moduleKey="sales">
            <div className="space-y-6">
                <ModulePageHeader
                    title="Picking"
                    description="Manage picking tasks"
                />

                <PickingListClient pickOrders={pickOrders || []} />
            </div>
        </PageFrame>
    );
}
