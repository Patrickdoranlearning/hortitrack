import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export type FlagKey = "isTopPerformer" | "quarantined" | "priority"; // extend as needed

export type FlagEvent = {
  kind: "flag";
  key: FlagKey;
  value: boolean | string | number;
  actor?: { id?: string; email?: string } | null;
  at: string; // ISO string from DB
  reason?: string | null;
  notes?: string | null;
};

export async function getFlags(batchId: string) {
  const supabase = await createClient();
  
  // Fetch generic flag events
  const { data, error } = await supabase
    .from("batch_events")
    .select("*")
    .eq("batch_id", batchId)
    .eq("type", "FLAG_CHANGE")
    .order("created_at", { ascending: true });

  if (error) {
    logError("Error fetching flags", { error: error.message });
    throw new Error("Failed to fetch flags");
  }

  const flags: Record<string, boolean | string | number> = {};
  const history: FlagEvent[] = [];

  for (const ev of data ?? []) {
    const payload = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload;
    if (payload?.key) {
      flags[payload.key] = payload.value;
      history.push({
        kind: "flag",
        key: payload.key as FlagKey,
        value: payload.value,
        actor: payload.actor,
        at: ev.created_at ?? new Date().toISOString(),
        reason: payload.reason,
        notes: payload.notes,
      });
    }
  }
  return { flags, history };
}

export async function setFlag(batchId: string, key: FlagKey, value: boolean | string | number, opts?: {
  actor?: { id?: string; email?: string } | null;
  reason?: string | null;
  notes?: string | null;
}) {
  const supabase = await createClient();

  // We need org_id to insert into batch_events. 
  // Fetch it from the batch.
  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .select("org_id")
    .eq("id", batchId)
    .single();
    
  if (batchError || !batch) {
    throw new Error("Batch not found or access denied");
  }

  const payload = {
    key,
    value,
    reason: opts?.reason,
    notes: opts?.notes,
    actor: opts?.actor,
  };

  const { error } = await supabase.from("batch_events").insert({
    org_id: batch.org_id,
    batch_id: batchId,
    type: "FLAG_CHANGE",
    by_user_id: opts?.actor?.id ?? null,
    payload: JSON.stringify(payload),
    created_at: new Date().toISOString(),
  });

  if (error) {
    logError("Error setting flag", { error: error.message });
    throw error;
  }
}
