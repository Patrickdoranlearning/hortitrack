import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/server/db/supabaseAdmin';
import { getOrgForUserByEmail } from '@/server/orgs/getOrgForUser';

type Table = 'nursery_locations' | 'suppliers' | 'plant_varieties' | 'plant_sizes';

export async function GET(req: NextRequest, { params }: { params: { table: Table } }) {
  try {
    const table = params.table;
    // Verify Firebase token (Authorization: Bearer <idToken>)
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const email = user.email;

    // org-scoped only where needed
    let orgId: string | null = null;
    if (table === 'nursery_locations' || table === 'suppliers') {
      try {
        orgId = await getOrgForUserByEmail(email);
      } catch (e: any) {
        const msg = e?.message === 'NO_ACTIVE_ORG'
          ? 'No active org for user. Set profiles.active_org_id.'
          : e?.message || 'Org resolution failed';
        return NextResponse.json({ error: msg }, { status: 403 });
      }
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
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return NextResponse.json({ rows: data ?? [] }, { status: 200 });
    }

    if (table === 'plant_sizes') {
      const { data, error } = await supabaseAdmin
        .from('plant_sizes')
        .select('id,name,container_type,cell_multiple')
        .order('name', { ascending: true });
      if (error) throw new Error(error.message);
      return NextResponse.json({ rows: data ?? [] }, { status: 200 });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('[collections] GET failed:', { message: e?.message });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
