export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserFromRequest } from '@/server/security/auth';
import { logger } from "@/server/utils/logger";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { locationId } = await params;
    if (!locationId) {
      return NextResponse.json({ error: 'Location ID required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get active batches at this location
    const { data: batches, error } = await supabase
      .from('batches')
      .select(`
        id,
        batch_number,
        quantity,
        status,
        plant_varieties (
          id,
          name,
          family
        )
      `)
      .eq('location_id', locationId)
      .not('status', 'in', '("Archived","Shipped")')
      .order('batch_number');

    if (error) {
      logger.api.error("Location batches query failed", error);
      return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
    }

    // Normalize the response
    const normalizedBatches = (batches || []).map((b: any) => ({
      id: b.id,
      batchNumber: b.batch_number,
      quantity: b.quantity,
      status: b.status,
      variety: b.plant_varieties?.name,
      family: b.plant_varieties?.family,
      varietyId: b.plant_varieties?.id,
    }));

    return NextResponse.json({ batches: normalizedBatches });
  } catch (error) {
    logger.api.error("Location batches fetch failed", error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

