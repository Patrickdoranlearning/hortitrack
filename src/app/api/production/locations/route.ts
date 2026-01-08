export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ok, fail } from '@/server/utils/envelope';

type BatchRow = {
  id: string;
  batch_number: string;
  plant_variety_id: string;
  size_id: string;
  location_id: string;
  quantity: number;
  initial_quantity: number;
  status: string;
  phase: string;
  planted_at: string | null;
  planting_date: string | null;
  plant_varieties: {
    id: string;
    name: string;
    family?: string;
    genus?: string;
    category?: string;
  } | null;
  plant_sizes: {
    id: string;
    name: string;
  } | null;
};

type LocationRow = {
  id: string;
  name: string;
  nursery_site: string | null;
  type: string | null;
  covered: boolean;
  area: number | null;
  site_id: string | null;
  org_id: string;
  created_at: string;
  updated_at: string;
};

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return fail(401, 'UNAUTHORIZED', 'Not authenticated');
    }

    // Get active org
    let activeOrgId: string | null = null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_org_id')
      .eq('id', user.id)
      .single();
    if (profile?.active_org_id) {
      activeOrgId = profile.active_org_id;
    } else {
      const { data: membership } = await supabase
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      if (membership) activeOrgId = membership.org_id;
    }

    if (!activeOrgId) {
      return fail(400, 'NO_ORG', 'No active organization found');
    }

    // Fetch all locations for the org
    const { data: locations, error: locError } = await supabase
      .from('nursery_locations')
      .select('*')
      .eq('org_id', activeOrgId)
      .order('name');

    if (locError) {
      return fail(500, 'DB_ERROR', 'Failed to fetch locations');
    }

    if (!locations || locations.length === 0) {
      return ok([]);
    }

    // Fetch all active batches with their varieties and sizes
    const { data: batches, error: batchError } = await supabase
      .from('batches')
      .select(
        `
        id,
        batch_number,
        plant_variety_id,
        size_id,
        location_id,
        quantity,
        initial_quantity,
        status,
        phase,
        planted_at,
        plant_varieties (
          id,
          name,
          family,
          genus,
          category
        ),
        plant_sizes (
          id,
          name
        )
      `
      )
      .eq('org_id', activeOrgId)
      .not('status', 'eq', 'Archived')
      .gt('quantity', 0);

    if (batchError) {
      return fail(500, 'DB_ERROR', 'Failed to fetch batches');
    }

    // Group batches by location
    const batchesByLocation: Record<string, BatchRow[]> = {};
    (batches ?? []).forEach((batch) => {
      const locationId = batch.location_id;
      if (locationId) {
        if (!batchesByLocation[locationId]) {
          batchesByLocation[locationId] = [];
        }
        batchesByLocation[locationId].push(batch as BatchRow);
      }
    });

    // Build response with locations and their batches
    const result = (locations as LocationRow[]).map((loc) => {
      const locBatches = batchesByLocation[loc.id] || [];
      const totalQuantity = locBatches.reduce((sum, b) => sum + (b.quantity || 0), 0);

      return {
        id: loc.id,
        name: loc.name,
        nurserySite: loc.nursery_site ?? 'Main',
        type: loc.type,
        covered: loc.covered,
        area: loc.area,
        siteId: loc.site_id,
        orgId: loc.org_id,
        createdAt: loc.created_at,
        updatedAt: loc.updated_at,
        batchCount: locBatches.length,
        totalQuantity,
        batches: locBatches.map((b) => ({
          id: b.id,
          batchNumber: b.batch_number,
          plantVarietyId: b.plant_variety_id,
          plantVariety: b.plant_varieties?.name,
          plantFamily: b.plant_varieties?.family,
          plantGenus: b.plant_varieties?.genus,
          category: b.plant_varieties?.category,
          sizeId: b.size_id,
          size: b.plant_sizes?.name,
          locationId: b.location_id,
          location: loc.name,
          quantity: b.quantity,
          initialQuantity: b.initial_quantity,
          status: b.status,
          phase: b.phase,
          plantedAt: b.planted_at,
          plantingDate: (b as any).planting_date ?? b.planted_at,
        })),
      };
    });

    return ok(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    return fail(500, 'SERVER_ERROR', message);
  }
}

