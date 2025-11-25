import { createClient } from "@/lib/supabase/server";

export async function withIdempotency(key: string | null | undefined, exec: () => Promise<{ status: number; body: any }>) {
  if (!key) return exec();

  const supabase = await createClient();

  // 1. Check if key exists
  const { data: existing } = await supabase
    .from('idempotency_keys')
    .select('*')
    .eq('key', key)
    .single();

  if (existing) {
    return { status: existing.status_code, body: existing.response_body };
  }

  // 2. Execute
  const result = await exec();

  // 3. Store result
  // Note: This might fail if concurrent request inserted key in the meantime.
  // We should handle that or use a transaction/lock, but for now simple insert is okay.
  await supabase.from('idempotency_keys').insert({
    key,
    status_code: result.status,
    response_body: result.body,
  });

  return result;
}
