
import { getSupabaseServerApp } from '@/server/db/supabase';
import { PageFrame } from '@/ui/templates/PageFrame';
import EnhancedCreateOrderForm from '@/components/sales/EnhancedCreateOrderForm';
import { getProductsWithBatches } from '@/server/sales/products-with-batches';
import { redirect } from 'next/navigation';

async function getCustomers(orgId: string) {
  const supabase = await getSupabaseServerApp();

  // Fetch only this org's customers
  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, name, org_id')
    .eq('org_id', orgId)
    .order('name');

  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }

  const filtered = (customers || []).filter(c => c.org_id === orgId);

  return filtered.map(c => ({ id: c.id, name: c.name }));
}

export default async function CreateOrderPage() {
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

  const [customers, products] = await Promise.all([
    getCustomers(orgId),
    getProductsWithBatches(orgId),
  ]);

  console.log('Customers found:', customers?.length || 0);
  console.log('Products found:', products?.length || 0);

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
        <EnhancedCreateOrderForm
          customers={customers}
          products={products}
        />
      </div>
    </PageFrame>
  );
}
