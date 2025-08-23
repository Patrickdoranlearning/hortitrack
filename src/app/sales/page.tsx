
import { getCustomers } from "@/server/sales/queries.server";
import SalesPageClient from "./SalesPageClient";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const customers = await getCustomers();
  return <SalesPageClient initialCustomers={customers} />;
}
