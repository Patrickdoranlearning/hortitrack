import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { B2BPortalLayout } from '@/components/b2b/B2BPortalLayout';
import { B2BInvoicesClient } from './B2BInvoicesClient';
import { createClient } from '@/lib/supabase/server';

export default async function B2BInvoicesPage() {
  const authContext = await requireCustomerAuth();
  const supabase = await createClient();

  // For store-level users, first get their accessible order IDs
  let accessibleOrderIds: string[] | null = null;
  if (authContext.isAddressRestricted && authContext.addressId) {
    const { data: accessibleOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('customer_id', authContext.customerId)
      .eq('ship_to_address_id', authContext.addressId)
      .eq('created_by_user_id', authContext.user.id);

    accessibleOrderIds = accessibleOrders?.map(o => o.id) || [];

    // If no accessible orders, return empty invoices
    if (accessibleOrderIds.length === 0) {
      return (
        <B2BPortalLayout authContext={authContext}>
          <B2BInvoicesClient invoices={[]} />
        </B2BPortalLayout>
      );
    }
  }

  // Build invoices query
  let invoicesQuery = supabase
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
      created_at,
      order_id,
      orders (
        order_number
      )
    `)
    .eq('customer_id', authContext.customerId)
    .order('issue_date', { ascending: false });

  // Apply store-level filtering via order_ids
  if (accessibleOrderIds !== null) {
    invoicesQuery = invoicesQuery.in('order_id', accessibleOrderIds);
  }

  const { data: invoices } = await invoicesQuery;

  return (
    <B2BPortalLayout authContext={authContext}>
      <B2BInvoicesClient invoices={invoices || []} />
    </B2BPortalLayout>
  );
}
