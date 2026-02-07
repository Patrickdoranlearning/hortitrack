import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type LocationPreset = {
  name: string;
  nurserySite: string;
};

const PRESETS: Record<"incoming" | "production" | "delivery", LocationPreset> = {
  incoming: {
    name: "Transit – Incoming",
    nurserySite: "Virtual",
  },
  production: {
    name: "Production Backlog",
    nurserySite: "Virtual",
  },
  delivery: {
    name: "Delivery Backlog",
    nurserySite: "Virtual",
  },
};

export type VirtualLocationPreset = keyof typeof PRESETS;

export async function ensureVirtualLocation(
  supabase: SupabaseClient<Database>,
  orgId: string,
  presetKey: VirtualLocationPreset
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
      is_virtual: true,
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Failed to create virtual location");
  }

  return data.id;
}







