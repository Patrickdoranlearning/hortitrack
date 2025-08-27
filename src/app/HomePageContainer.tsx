import HomePageView from '@/app/HomePageView';
import { supabaseServer } from '@/server/supabase/client'; // This might not be directly used here anymore, but keeping for reference if needed
import type {
  Batch,
} from '@/lib/types';
import { snakeToCamel } from '@/lib/utils'; // Used for transforming fetched data
import { getBatchesAction } from '@/app/actions'; // Import the Supabase-backed action

// Removed getCollectionData function
// Removed dedupeByName function

export default async function HomePageContainer() {
  // Fetch batches using the action, which now includes joins and transformations
  const { data: rawBatches, error: batchesActionError } = await getBatchesAction();

  if (batchesActionError) {
    console.error("[HomePageContainer] Error from getBatchesAction:", batchesActionError);
    // Handle error appropriately, maybe return an empty array or throw
    throw new Error(`Failed to load initial batches: ${batchesActionError.error}`);
  }
  
  const batches: Batch[] = (rawBatches as Batch[]) || [];

  // Derived data for filters, now based on the joined batches
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
      // Removed initialVarieties, initialNurseryLocations, initialPlantSizes, initialSuppliers props
      plantFamilies={plantFamilies}
      categories={categories}
      actions={{}}
    />
  );
}
