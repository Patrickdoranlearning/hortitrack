import { requireCustomerAuth } from '@/lib/auth/b2b-guard';
import { B2BPortalLayout } from '@/components/b2b/B2BPortalLayout';
import { B2BResourcesClient } from './B2BResourcesClient';
import { createClient } from '@/lib/supabase/server';

export default async function B2BResourcesPage() {
  const authContext = await requireCustomerAuth();
  const supabase = await createClient();

  // Fetch active resources for this org
  const { data: resources } = await supabase
    .from('customer_resources')
    .select('*')
    .eq('org_id', authContext.customer.org_id)
    .eq('is_active', true)
    .order('category, sort_order');

  // Group resources by category
  const groupedResources = (resources || []).reduce((acc, resource) => {
    const category = resource.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(resource);
    return acc;
  }, {} as Record<string, typeof resources>);

  return (
    <B2BPortalLayout authContext={authContext}>
      <B2BResourcesClient resources={groupedResources} />
    </B2BPortalLayout>
  );
}
