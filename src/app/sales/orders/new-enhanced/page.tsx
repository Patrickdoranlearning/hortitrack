import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import EnhancedCreateOrderForm from '@/components/sales/EnhancedCreateOrderForm';
import { getProductsWithBatches } from '@/server/sales/products-with-batches';
import { logError } from '@/lib/log';

async function getCustomers(orgId: string) {
  const supabase = await createClient();

  const { data: customers, error } = await supabase
    .from('customers')
    .select(`
      id,
      name,
      store,
      currency,
      country_code,
      customer_addresses (
        id,
        label,
        store_name,
        line1,
        line2,
        city,
        county,
        eircode,
        country_code,
        is_default_shipping,
        is_default_billing
      )
    `)
    .eq('org_id', orgId)
    .order('name');

  if (error) {
    logError('Error fetching customers', { error: error?.message || String(error) });
    return [];
  }

  // Map to expected format
  return (customers || []).map(c => ({
    id: c.id,
    name: c.name,
    store: c.store,
    currency: c.currency ?? 'EUR',
    countryCode: c.country_code ?? 'IE',
    addresses: (c.customer_addresses ?? []).map((a: {
      id: string;
      label: string;
      store_name: string | null;
      line1: string;
      line2: string | null;
      city: string | null;
      county: string | null;
      eircode: string | null;
      country_code: string;
      is_default_shipping: boolean;
      is_default_billing: boolean;
    }) => ({
      id: a.id,
      label: a.label,
      storeName: a.store_name,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      county: a.county,
      eircode: a.eircode,
      countryCode: a.country_code,
      isDefaultShipping: a.is_default_shipping,
      isDefaultBilling: a.is_default_billing,
    })),
  }));
}

export default async function NewEnhancedOrderPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get user's active organization
  const { data: profile } = await supabase
    .from('users')
    .select('active_org_id')
    .eq('id', user.id)
    .single();

  const orgId = profile?.active_org_id;
  if (!orgId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-destructive">No Active Organization</h1>
        <p className="mt-2 text-muted-foreground">
          Please select an organization before creating orders.
        </p>
      </div>
    );
  }

  const [customers, products] = await Promise.all([
    getCustomers(orgId),
    getProductsWithBatches(orgId),
  ]);

  if (customers.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">No Customers Found</h1>
        <p className="mt-2 text-muted-foreground">
          Please add customers before creating orders.
        </p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">No Products Available</h1>
        <p className="mt-2 text-muted-foreground">
          No products with available stock found. Please check your inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <EnhancedCreateOrderForm
        customers={customers}
        products={products}
      />
    </div>
  );
}
