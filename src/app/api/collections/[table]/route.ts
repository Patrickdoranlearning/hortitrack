import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/server/db/supabaseAdmin';
import { getOrgForUserByEmail } from '@/server/org/getOrgForUser';
import { z } from "zod";
import { logger } from "@/server/utils/logger";

const TableParam = z.enum(['nursery_locations', 'suppliers', 'plant_varieties', 'plant_sizes']);
type Table = z.infer<typeof TableParam>;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  try {
    const { table: rawTable } = await params;
    const parsedTable = TableParam.safeParse(rawTable);
    if (!parsedTable.success) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const table: Table = parsedTable.data;
    // Verify Firebase token (Authorization: Bearer <idToken>)
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const email = user.email;

    // All tables require org scoping for proper tenant isolation
    let orgId: string | null = null;
    try {
      orgId = await getOrgForUserByEmail(email);
    } catch (e: any) {
      const msg = e?.message === 'NO_ACTIVE_ORG'
        ? 'No active org for user. Set profiles.active_org_id.'
        : e?.message || 'Org resolution failed';
      return NextResponse.json({ error: msg }, { status: 403 });
    }

    if (table === 'nursery_locations') {
      const { data, error } = await supabaseAdmin
        .from('nursery_locations')
        .select('id,name')
        .eq('org_id', orgId!)
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return NextResponse.json({ rows: data ?? [] }, { status: 200 });
    }

    if (table === 'suppliers') {
      const { data, error } = await supabaseAdmin
        .from('suppliers')
        .select('id,name,producer_code,country_code')
        .eq('org_id', orgId!)
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return NextResponse.json({ rows: data ?? [] }, { status: 200 });
    }

    if (table === 'plant_varieties') {
      const { data, error } = await supabaseAdmin
        .from('plant_varieties')
        .select('id,name,family,genus,species')
        .eq('org_id', orgId!)
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return NextResponse.json({ rows: data ?? [] }, { status: 200 });
    }

    if (table === 'plant_sizes') {
      const { data, error } = await supabaseAdmin
        .from('plant_sizes')
        .select('id,name,container_type,cell_multiple')
        .eq('org_id', orgId!)
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return NextResponse.json({ rows: data ?? [] }, { status: 200 });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    logger.api.error("GET /api/collections failed", e);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
