
import { adminDb } from '@/server/db/admin';
import { declassify } from '@/server/utils/declassify';
import SalesPageClient from './SalesPageClient';
import type { SalesOrderDoc } from '@/lib/sales/types';
import type { Supplier } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SalesPage() {
  const [ordersSnap, customersSnap] = await Promise.all([
    adminDb.collection('sales_orders').orderBy('createdAt', 'desc').get(),
    adminDb.collection('customers').orderBy('name').get(),
  ]);

  const initialOrders = ordersSnap.docs.map((d) =>
    declassify({ id: d.id, ...d.data() })
  ) as SalesOrderDoc[];

  const initialCustomers = customersSnap.docs.map((d) =>
    declassify({ id: d.id, ...d.data() })
  ) as Supplier[];

  return (
    <SalesPageClient
      initialOrders={initialOrders}
      initialCustomers={initialCustomers}
    />
  );
}
