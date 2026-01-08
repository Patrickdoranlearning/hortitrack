import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from '@/ui/templates';
import CustomerManagementClient from "./CustomerManagementClient";
import { fetchCustomerManagementData, mapCustomers } from "./customer-data";
import type { CustomerManagementPayload } from "./types";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { orgId, supabase } = await getUserAndOrg();
  const data = await fetchCustomerManagementData(supabase, orgId);

  const payload: CustomerManagementPayload = {
    customers: mapCustomers(data.customerRows),
    priceLists: data.priceLists.map((row) => ({
      id: row.id,
      name: row.name,
      currency: row.currency ?? "EUR",
      isDefault: row.is_default ?? false,
    })),
    products: data.products.map((p) => ({
      id: p.id,
      name: p.name,
      skuCode: p.sku_code,
    })),
  };

  return (
    <PageFrame moduleKey="sales">
      <CustomerManagementClient {...payload} />
    </PageFrame>
  );
}
