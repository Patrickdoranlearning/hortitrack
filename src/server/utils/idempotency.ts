import { createClient } from "@/lib/supabase/server";

/**
 * Ensures idempotent execution of an operation by key.
 * Uses database-level upsert with conflict handling to prevent race conditions.
 *
 * If the key already exists, returns the cached response.
 * If the key doesn't exist, executes the operation and caches the result.
 *
 * Race condition fix: Uses INSERT ... ON CONFLICT DO NOTHING + check to ensure
 * only one concurrent request wins the insert.
 */
export async function withIdempotency(
  key: string | null | undefined,
  exec: () => Promise<{ status: number; body: unknown }>
): Promise<{ status: number; body: unknown }> {
  if (!key) return exec();

  const supabase = await createClient();

  // 1. Try to reserve the key with a pending status
  // Using INSERT ... ON CONFLICT DO NOTHING ensures atomic reservation
  const { error: insertError } = await supabase
    .from("idempotency_keys")
    .insert({
      key,
      status_code: 0, // Pending status
      response_body: null,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  // 2. Check if we won the race (inserted) or lost (conflict)
  // If we got a conflict error (23505), another request owns this key
  if (insertError) {
    // Key already exists - fetch the existing response
    const { data: existing } = await supabase
      .from("idempotency_keys")
      .select("status_code, response_body")
      .eq("key", key)
      .single();

    if (existing) {
      // If status_code is 0, another request is still processing
      // Wait and retry a few times
      if (existing.status_code === 0) {
        // Wait for the other request to finish (poll with backoff)
        for (let i = 0; i < 5; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
          const { data: updated } = await supabase
            .from("idempotency_keys")
            .select("status_code, response_body")
            .eq("key", key)
            .single();

          if (updated && updated.status_code !== 0) {
            return { status: updated.status_code, body: updated.response_body };
          }
        }
        // If still pending after retries, let the request proceed (fallback)
        // The other request may have failed
      } else {
        return { status: existing.status_code, body: existing.response_body };
      }
    }
    // If no existing record found (shouldn't happen), fall through to execute
  }

  // 3. We own the key - execute the operation
  let result: { status: number; body: unknown };
  try {
    result = await exec();
  } catch (error) {
    // On error, remove the pending key so it can be retried
    await supabase.from("idempotency_keys").delete().eq("key", key);
    throw error;
  }

  // 4. Update the key with the actual result
  await supabase
    .from("idempotency_keys")
    .update({
      status_code: result.status,
      response_body: result.body,
    })
    .eq("key", key);

  return result;
}
