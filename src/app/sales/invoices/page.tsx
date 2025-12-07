import { createClient } from '@/lib/supabase/server';
import { PageFrame } from '@/ui/templates/PageFrame';
import { ModulePageHeader } from '@/ui/layout/ModulePageHeader';
import InvoicesClient from './InvoicesClient';

export default async function SalesInvoicesPage() {
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from('invoices')
    .select(`
      *,
      customer:customers(name, email)
    `)
    .order('created_at', { ascending: false });

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="sales">
      <div className="space-y-6">
        <ModulePageHeader
          title="Invoices"
          description="Manage invoices and credit notes"
        />

        <InvoicesClient initialInvoices={invoices || []} />
      </div>
    </PageFrame>
  );
}
