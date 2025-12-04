import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import EnhancedCreateOrderForm from '@/components/sales/EnhancedCreateOrderForm';
import { getProductsWithBatches } from '@/server/sales/products-with-batches';

async function getCustomers(orgId: string) {
  const supabase = await createClient();

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, name')
    .eq('org_id', orgId)
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }

  return customers || [];
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
