import { supabaseAdmin } from "@/server/db/supabaseAdmin";
import PropagationClient from "./PropagationClient";
import type { NurseryLocation, PlantSize, Variety } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PropagationPage() {
  const { data: locations } = await supabaseAdmin.from("locations").select("*").order("name");
  const { data: sizes } = await supabaseAdmin.from("sizes").select("*").order("size");
  const { data: varieties } = await supabaseAdmin.from("varieties").select("*").order("name");

  return (
    <PropagationClient
      nurseryLocations={(locations || []) as NurseryLocation[]}
      plantSizes={(sizes || []) as PlantSize[]}
      varieties={(varieties || []) as Variety[]}
    />
  );
}
