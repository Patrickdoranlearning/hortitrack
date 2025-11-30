
import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import CreateOrderForm from '@/components/sales/CreateOrderForm';

export default async function CreateOrderPage() {
  const supabase = await createClient();

  // Fetch customers for the dropdown
  const { data: customers } = await supabase
    .from('customers')
    .select('id, name')
    .order('name');

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="sales">
      <div className="space-y-6 max-w-4xl mx-auto">
        <ModulePageHeader
          title="Create New Order"
          description="Enter order details for a customer"
        />

        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <CreateOrderForm customers={customers || []} />
        </div>
      </div>
    </PageFrame>
  );
}
