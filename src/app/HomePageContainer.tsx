import HomePageView from '@/app/HomePageView';
import { getSupabaseForRequest } from '@/server/db/supabaseServer'; // Updated import - now used for getBatchesAction in case of direct import here
import type {
  Batch,
} from '@/lib/types';
import { snakeToCamel } from '@/lib/utils'; 
import { getBatchesAction } from '@/app/actions'; 

export default async function HomePageContainer() {
  const { data: rawBatches, error: batchesActionError } = await getBatchesAction();

  if (batchesActionError) {
    console.error("[HomePageContainer] Error from getBatchesAction:", batchesActionError);
    throw new Error(`Failed to load initial batches: ${batchesActionError.error}`);
  }
  
  const batches: Batch[] = (rawBatches as Batch[]) || [];

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
