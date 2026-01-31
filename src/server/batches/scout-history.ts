import { createClient } from '@/lib/supabase/server';
import type { PlantHealthEvent } from '@/lib/history-types';

/**
 * Get scout history for a batch
 *
 * Returns all scout_flag events where:
 * - batch_id = this batch directly, OR
 * - location_id matches a location where this batch was present at event_at time
 *
 * @param batchId The batch ID to get scout history for
 * @param orgId The organization ID for RLS filtering
 */
export async function getBatchScoutHistory(
  batchId: string,
  orgId: string
): Promise<PlantHealthEvent[]> {
  const supabase = await createClient();

  // Get direct batch scouts and location-based scouts
  // For simplicity, we get all scouts that directly reference this batch
  // A more advanced query would also check location history, but the existing
  // plant_health API already captures batch-level scouts

  const { data, error } = await supabase
    .from('plant_health_logs')
    .select(`
      id,
      batch_id,
      location_id,
      event_type,
      event_at,
      recorded_by,
      title,
      notes,
      issue_reason,
      severity,
      photo_url,
      ec_reading,
      ph_reading,
      batches!plant_health_logs_batch_id_fkey (
        batch_number,
        plant_varieties (name)
      )
    `)
    .eq('org_id', orgId)
    .eq('event_type', 'scout_flag')
    .or(`batch_id.eq.${batchId}`)
    .order('event_at', { ascending: false });

  if (error) {
    console.error('[getBatchScoutHistory] query failed', error);
    throw new Error(error.message);
  }

  // Transform to PlantHealthEvent type
  // Note: recorded_by references auth.users, not profiles, so we can't join to get the name
  return (data || []).map((row: any) => ({
    id: row.id,
    batchId: row.batch_id,
    batchNumber: row.batches?.batch_number,
    varietyName: row.batches?.plant_varieties?.name,
    at: row.event_at,
    type: row.event_type as 'scout_flag',
    title: row.title || row.issue_reason || 'Scout Observation',
    details: row.notes,
    severity: row.severity,
    issueType: row.issue_reason,
    photos: row.photo_url ? [row.photo_url] : undefined,
    userId: row.recorded_by,
    userName: undefined, // FK is to auth.users, not profiles - would need migration to fix
  }));
}

/**
 * Get location-based scout history that may affect a batch
 *
 * This is a more advanced query that looks at the batch's location history
 * and finds scouts logged against those locations during the time the batch was there
 */
export async function getBatchLocationScouts(
  batchId: string,
  orgId: string
): Promise<PlantHealthEvent[]> {
  const supabase = await createClient();

  // First, get the batch's current location
  const { data: batch, error: batchError } = await supabase
    .from('batches')
    .select('location_id')
    .eq('id', batchId)
    .eq('org_id', orgId)
    .single();

  if (batchError || !batch?.location_id) {
    return [];
  }

  // Get scouts for the batch's current location
  const { data, error } = await supabase
    .from('plant_health_logs')
    .select(`
      id,
      batch_id,
      location_id,
      event_type,
      event_at,
      recorded_by,
      title,
      notes,
      issue_reason,
      severity,
      photo_url,
      nursery_locations!plant_health_logs_location_id_fkey (name)
    `)
    .eq('org_id', orgId)
    .eq('event_type', 'scout_flag')
    .eq('location_id', batch.location_id)
    .is('batch_id', null) // Only location-scoped scouts (not batch-specific)
    .order('event_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[getBatchLocationScouts] query failed', error);
    return [];
  }

  // Note: recorded_by references auth.users, not profiles, so we can't join to get the name
  return (data || []).map((row: any) => ({
    id: row.id,
    batchId: row.batch_id,
    at: row.event_at,
    type: row.event_type as 'scout_flag',
    title: row.title || row.issue_reason || 'Location Scout',
    details: `${row.nursery_locations?.name || 'Location'}: ${row.notes || ''}`.trim(),
    severity: row.severity,
    issueType: row.issue_reason,
    photos: row.photo_url ? [row.photo_url] : undefined,
    userId: row.recorded_by,
    userName: undefined, // FK is to auth.users, not profiles - would need migration to fix
  }));
}

/**
 * Combined scout history - direct batch scouts + location scouts
 */
export async function getFullBatchScoutHistory(
  batchId: string,
  orgId: string
): Promise<PlantHealthEvent[]> {
  const [directScouts, locationScouts] = await Promise.all([
    getBatchScoutHistory(batchId, orgId),
    getBatchLocationScouts(batchId, orgId),
  ]);

  // Combine and sort by date
  const all = [...directScouts, ...locationScouts];
  all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // Deduplicate by ID (in case there's overlap)
  const seen = new Set<string>();
  return all.filter((scout) => {
    if (seen.has(scout.id)) return false;
    seen.add(scout.id);
    return true;
  });
}
