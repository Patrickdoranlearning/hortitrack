import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { B2BPortalLayout } from '@/components/b2b/B2BPortalLayout';
import { B2BInvoicesClient } from './B2BInvoicesClient';
import { createClient } from '@/lib/supabase/server';

export default async function B2BInvoicesPage() {
  const authContext = await requireCustomerAuth();
  const supabase = await createClient();

  // Fetch customer invoices
  const { data: invoices } = await supabase
    .from('invoices')
    .select(`
      id,
      invoice_number,
      status,
      issue_date,
      due_date,
      subtotal_ex_vat,
      vat_amount,
      total_inc_vat,
      amount_credited,
      balance_due,
      notes,
      created_at
    `)
    .eq('customer_id', authContext.customerId)
    .order('issue_date', { ascending: false });

  return (
    <B2BPortalLayout authContext={authContext}>
      <B2BInvoicesClient invoices={invoices || []} />
    </B2BPortalLayout>
  );
}
