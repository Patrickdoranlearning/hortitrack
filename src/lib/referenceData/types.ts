// FULL FILE: src/lib/referenceData/types.ts
export type PlantVariety = {
  id: string;
  name: string;
  family: string | null;
  genus: string | null;
  species: string | null;
  Category: string | null; // enum in DB
  colour: string | null;
  rating: number | null;
};

export type PlantSize = { id: string; name: string; cell_multiple: number | null; container_type: string };
export type NurseryLocation = { id: string; name: string; nursery_site: string };
export type Supplier = { id: string; name: string; producer_code: string | null; country_code: string };

export type ReferenceData = {
  varieties: PlantVariety[];
  sizes: PlantSize[];
  locations: NurseryLocation[];
  suppliers: Supplier[];
};
