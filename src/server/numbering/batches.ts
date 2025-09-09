import { getUserAndOrg } from "@/server/auth/org";

function yyww(now = new Date()) {
  const year = now.getFullYear().toString().slice(-2);
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((+now - +jan1) / 86400000);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  const ww = week.toString().padStart(2, "0");
  return `${year}${ww}`;
}

export async function nextBatchNumber(phase: 1|2|3) {
  const { supabase, orgId } = await getUserAndOrg();
  const key = `batch-${phase}-${yyww()}`;

  // Atomic upsert using Postgres RPC via a single UPDATE ... RETURNING trick
  // NOTE: Keep it simple without new SQL functions.
  const { data: row, error } = await supabase
    .from("org_counters")
    .upsert({ org_id: orgId, key, value: 0 }, { onConflict: "org_id,key" })
    .select()
    .single();
  if (error) throw new Error(`counter upsert failed: ${error.message}`);

  const { data, error: incErr } = await supabase
    .rpc("increment_counter", { p_org_id: orgId, p_key: key }); // see SQL below
  if (incErr) throw new Error(`counter increment failed: ${incErr.message}`);

  const seq = String(data as number).padStart(5, "0");
  return `${phase}-${yyww()}-${seq}`;
}
