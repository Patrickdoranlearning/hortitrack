
import { listOrders, getCustomers } from "@/server/sales/queries";
import SalesPageClient from "./SalesPageClient";

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const orders = await listOrders();
  const customers = await getCustomers();
  return <SalesPageClient initialOrders={orders} initialCustomers={customers} />;
}
