
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

  const { data, error } = await supabase.rpc("increment_counter", {
    p_org_id: orgId,
    p_key: key,
  });
  if (error) throw new Error(`counter increment failed: ${error.message}`);

  const seq = String(data as number).padStart(5, "0");
  return `${phase}-${yyww()}-${seq}`;
}
