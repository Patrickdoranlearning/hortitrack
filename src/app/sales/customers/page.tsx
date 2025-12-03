import { getUserAndOrg } from "@/server/auth/org";
import { PageFrame } from "@/ui/templates/PageFrame";
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
  };

  return (
    <PageFrame companyName="Doran Nurseries" moduleKey="sales">
      <CustomerManagementClient {...payload} />
    </PageFrame>
  );
}
