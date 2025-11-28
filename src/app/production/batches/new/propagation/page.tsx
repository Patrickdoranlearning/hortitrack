import { supabaseAdmin } from "@/server/db/supabaseAdmin";
import PropagationClient from "./PropagationClient";
import type { NurseryLocation, PlantSize, Variety } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PropagationPage() {
  const { data: locations } = await supabaseAdmin.from("nursery_locations").select("*").order("name");
  const { data: sizes } = await supabaseAdmin.from("plant_sizes").select("*").order("name");
  const { data: varieties } = await supabaseAdmin.from("plant_varieties").select("*").order("name");

  return (
    <PropagationClient
      nurseryLocations={(locations || []) as NurseryLocation[]}
      plantSizes={(sizes || []) as PlantSize[]}
      varieties={(varieties || []) as Variety[]}
    />
  );
}
