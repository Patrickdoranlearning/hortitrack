
import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import InvoiceCard from '@/components/sales/InvoiceCard';
import { Invoice } from '@/lib/sales/types';

export default async function SalesInvoicesPage() {
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="sales">
      <div className="space-y-6">
        <ModulePageHeader
          title="Invoices"
          description="Manage invoices and credit notes"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {invoices?.map((invoice) => (
            <InvoiceCard key={invoice.id} invoice={invoice as Invoice} />
          ))}
        </div>
      </div>
    </PageFrame>
  );
}
