import "server-only";
import { getSupabaseForRequest } from "@/server/db/supabaseServer";
import { getUserIdAndOrgId } from "@/server/auth/getUser"; // Assuming this helper exists or needs to be created

/**
 * Batch IDs: <site>-<yyww>-<seq5>
 * Example: "3-2534-00001"  => site=3, year=2025, week=34, seq=1
 */
export type GenerateBatchIdOptions = {
  siteCode?: string;   // e.g. "1", "2", "3". Defaults to "1" if omitted.
  when?: Date;         // override current date for testing
};

function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Thursday in current week decides the year.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { isoYear: d.getUTCFullYear(), isoWeek: weekNo };
}

export async function generateNextBatchId(opts: GenerateBatchIdOptions = {}) {
  const supabase = await getSupabaseForRequest();
  const { orgId } = await getUserIdAndOrgId(); // Get orgId from current user's session

  if (!orgId) {
    throw new Error("User must be associated with an organization to generate batch IDs.");
  }

  const site = String(opts.siteCode ?? "1");
  const now = opts.when ?? new Date();
  const { isoYear, isoWeek: ww } = isoWeek(now);
  const yy = String(isoYear).slice(2);
  const yww = `${yy}${String(ww).padStart(2, "0")}`;
  const counterKey = `batch-${site}-${yww}`;

  try {
    // Call the Supabase RPC function to atomically increment the counter
    const { data: newSeq, error } = await supabase.rpc('increment_counter', {
      p_org_id: orgId,
      p_key: counterKey,
    });

    if (error) {
      console.error("Error incrementing org counter:", error);
      throw new Error(`Failed to generate batch ID: ${error.message}`);
    }

    if (typeof newSeq !== 'number') {
        throw new Error("Invalid response from counter function.");
    }

    return { id: `${site}-${yww}-${String(newSeq).padStart(5, "0")}` };

  } catch (e) {
    console.error("Failed to generate batch id via Supabase RPC:", e);
    throw e; // Re-throw the error after logging
  }
}

export type BatchPhase = "PROPAGATION" | "PLUGS" | "POTTING" | "POTTING";
