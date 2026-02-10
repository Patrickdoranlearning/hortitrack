import { redirect } from 'next/navigation';
import HomePageView from '@/app/HomePageView';
import type { Batch } from '@/lib/types';
import { getBatchesAction } from '@/app/actions';

export default async function HomePageContainer() {
  const { success, data, error } = await getBatchesAction();

  if (!success) {
    // If auth-related error, redirect to login
    if (error?.includes('Unauthenticated') || error?.includes('No active org')) {
      redirect('/login');
    }
    // For other errors, show empty state instead of crashing
    return (
      <HomePageView
        initialBatches={[]}
        plantFamilies={['all']}
        categories={['all']}
        actions={{}}
      />
    );
  }
  
  const batches: Batch[] = Array.isArray(data) ? data : [];

  const plantFamilies = [
    'all',
    ...Array.from(
      new Set((batches || []).map((b: Batch) => b.plantFamily).filter(Boolean))
    ),
  ];
  const categories = [
    'all',
    ...Array.from(
      new Set((batches || []).map((b: Batch) => b.category).filter(Boolean))
    ),
  ];

  return (
    <HomePageView
      initialBatches={batches}
      plantFamilies={plantFamilies}
      categories={categories}
      actions={{}}
    />
  );
}
