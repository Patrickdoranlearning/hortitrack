// Format: <Phase>-<YYWW>-<seq5> e.g. 1-2525-00001 (Phase 1 = propagation)
export async function generateBatchNumber(orgId: string, now = new Date()) {
  // Week and year
  const yy = String(now.getFullYear()).slice(-2);
  const week = getISOWeek(now); // implement or use a tiny helper
  const ww = String(week).padStart(2, '0');

  // We’ll use org_counters (key='batch_1_YYWW') to get per-week sequence
  const key = `batch_1_${yy}${ww}`;

  // Note: done server-side inside the route to keep transaction-ish logic co-located
  return { yy, ww, key };
}

function getISOWeek(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((date as any)- (yearStart as any)) / 86400000 + 1)/7);
  return weekNo;
}
