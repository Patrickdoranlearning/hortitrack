
import { getSupabaseServerApp } from '@/server/db/supabase';
import { PageFrame } from '@/ui/templates/PageFrame';
import { SalesOrderWizard } from '@/components/sales/wizard/SalesOrderWizard';
import { getProductsWithBatches } from '@/server/sales/products-with-batches';
import { getOrgFees } from '@/app/sales/settings/fees/actions';
import { redirect } from 'next/navigation';

async function getCustomers(orgId: string) {
  const supabase = await getSupabaseServerApp();

  // Fetch customers with addresses
  const { data: customers, error } = await supabase
    .from('customers')
    .select(`
      id,
      name,
      org_id,
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
    console.error('Error fetching customers:', error);
    return [];
  }

  const filtered = (customers || []).filter(c => c.org_id === orgId);

  return filtered.map(c => ({
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

export default async function CreateOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ copyOrderId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = await getSupabaseServerApp();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Get user's active organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_org_id')
    .eq('id', user.id)
    .maybeSingle();

  let orgId = profile?.active_org_id;

  // Fallback: try to get from org_memberships
  if (!orgId) {
    const { data: membership } = await supabase
      .from('org_memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    orgId = membership?.org_id;
  }

  if (!orgId) {
    return (
      <PageFrame companyName="Doran Nurseries" moduleKey="sales">
        <div className="p-8">
          <h1 className="text-2xl font-bold text-destructive">No Active Organization</h1>
          <p className="mt-2 text-muted-foreground">
            Please select an organization before creating orders.
          </p>
        </div>
      </PageFrame>
    );
  }

  const [customers, products, fees] = await Promise.all([
    getCustomers(orgId),
    getProductsWithBatches(orgId),
    getOrgFees(),
  ]);

  console.log('Customers found:', customers?.length || 0);
  console.log('Products found:', products?.length || 0);
  console.log('Fees found:', fees?.length || 0);

  if (!customers || customers.length === 0) {
    return (
      <PageFrame companyName="Doran Nurseries" moduleKey="sales">
        <div className="p-8">
          <h1 className="text-2xl font-bold">No Customers Found</h1>
          <p className="mt-2 text-muted-foreground">
            Please add customers before creating orders, or check your organization access.
          </p>
        </div>
      </PageFrame>
    );
  }

  if (!products || products.length === 0) {
    return (
      <PageFrame companyName="Doran Nurseries" moduleKey="sales">
        <div className="p-8">
          <h1 className="text-2xl font-bold">No Products Available</h1>
          <p className="mt-2 text-muted-foreground">
            No products with available stock found. You may need to:
          </p>
          <ul className="mt-2 list-disc list-inside text-muted-foreground">
            <li>Create products in your catalog</li>
            <li>Link products to batches using product_batches table</li>
            <li>Ensure batches have status "Ready for Sale" or "Looking Good"</li>
            <li>Verify batches have quantity &gt; 0</li>
          </ul>
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="sales">
      <div className="py-6">
        <SalesOrderWizard
          customers={customers}
          products={products}
          copyOrderId={resolvedSearchParams?.copyOrderId}
          fees={fees}
        />
      </div>
    </PageFrame>
  );
}
