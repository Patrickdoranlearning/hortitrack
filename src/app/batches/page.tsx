// src/app/batches/page.tsx (Server Component)
import { adminDb } from '@/server/db/admin';
import { declassify } from '@/server/utils/declassify';
import BatchesClient from './BatchesClient'; // <-- 'use client' component

export const dynamic = 'force-dynamic';

export default async function Page() {
  const snap = await adminDb.collection('batches').orderBy('createdAt', 'desc').get();

  const initialBatches = snap.docs.map((d) => {
    const data = d.data();
    return declassify({ id: d.id, ...data });
  });

  return <BatchesClient initialBatches={initialBatches} />;
}
