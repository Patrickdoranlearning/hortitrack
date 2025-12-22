import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type LocationPreset = {
  name: string;
  nurserySite: string;
};

const PRESETS: Record<"incoming" | "planning", LocationPreset> = {
  incoming: {
    name: "Transit – Incoming",
    nurserySite: "Virtual Transit",
  },
  planning: {
    name: "Planning Backlog",
    nurserySite: "Virtual Planning",
  },
};

export async function ensureVirtualLocation(
  supabase: SupabaseClient<Database>,
  orgId: string,
  presetKey: "incoming" | "planning"
): Promise<string> {
  const preset = PRESETS[presetKey];
  const existing = await supabase
    .from("nursery_locations")
    .select("id")
    .eq("org_id", orgId)
    .eq("name", preset.name)
    .maybeSingle();

  if (existing.data?.id) {
    return existing.data.id;
  }

  const { data, error } = await supabase
    .from("nursery_locations")
    .insert({
      org_id: orgId,
      name: preset.name,
      nursery_site: preset.nurserySite,
      covered: false,
      area: 0,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Failed to create virtual location");
  }

  return data.id;
}




