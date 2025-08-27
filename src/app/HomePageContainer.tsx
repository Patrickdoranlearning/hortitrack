import HomePageView from '@/app/HomePageView';
import { supabaseServer } from '@/server/supabase/client';
import type {
  NurseryLocation,
  PlantSize,
  Supplier,
  Variety,
  Batch,
} from '@/lib/types';
import { snakeToCamel } from '@/lib/utils'; // Import snakeToCamel

async function getCollectionData<T>(
  supabase: any,
  collectionName: string
): Promise<T[]> {
  try {
    const { data, error } = await supabase.from(collectionName).select('*');
    if (error) throw error;
    return (snakeToCamel(data) as T[]) || []; // Apply snakeToCamel here
  } catch (error: any) {
    console.error(`Error fetching ${collectionName}:`, error?.message ?? error);
    return [];
  }
}

function dedupeByName<T extends { id?: string; name?: string; size?: string }>(
  arr: T[]
): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const key = (item.name ?? item.size ?? '').trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      return true;
    }
    return false;
  });
}

export default async function HomePageContainer() {
  const supabase = await supabaseServer();
  const { data: batchesData, error: batchesError } = await supabase
    .from('batches')
    .select('*');

  let batches: Batch[] = [];
  if (batchesError) {
    console.error("Error fetching batches in HomePageContainer:", batchesError.message);
  } else {
    batches = snakeToCamel(batchesData) as Batch[]; // Apply snakeToCamel here
    console.log("Batches fetched in HomePageContainer (camelCase):", batches);
  }

  const varieties = await getCollectionData<Variety>(
    supabase,
    'plant_varieties'
  );
  const nurseryLocations = await getCollectionData<NurseryLocation>(
    supabase,
    'nursery_locations'
  );
  const plantSizes = await getCollectionData<PlantSize>(supabase, 'plant_sizes');
  const suppliers = await getCollectionData<Supplier>(supabase, 'suppliers');

  const uniqueSuppliers = dedupeByName(suppliers);
  const uniquePlantSizes = dedupeByName(plantSizes);
  const uniqueNurseryLocations = dedupeByName(nurseryLocations);

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
      initialBatches={batches || []}
      initialVarieties={varieties}
      initialNurseryLocations={uniqueNurseryLocations}
      initialPlantSizes={uniquePlantSizes}
      initialSuppliers={uniqueSuppliers}
      plantFamilies={plantFamilies}
      categories={categories}
      actions={{}}
    />
  );
}