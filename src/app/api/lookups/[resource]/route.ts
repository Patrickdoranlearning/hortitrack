import { NextRequest, NextResponse } from 'next/server';
import { firebaseAdminAuth } from '@/server/auth/firebaseAdmin';
import { supabaseAdmin } from '@/server/db/supabaseAdmin';
import { getOrgForUserByEmail } from '@/server/orgs/getOrgForUser';

type Resource = 'locations' | 'suppliers' | 'varieties' | 'sizes';

export async function GET(req: NextRequest, { params }: { params: { resource: Resource } }) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await firebaseAdminAuth.verifyIdToken(token);
    const email = decoded.email;
    if (!email) return NextResponse.json({ error: 'Missing email on token' }, { status: 401 });

    const resource = params.resource;

    // org-scoped where required
    let orgId: string | null = null;
    if (resource === 'locations' || resource === 'suppliers') {
      try {
        orgId = await getOrgForUserByEmail(email);
      } catch (e: any) {
        const msg = e?.message === 'NO_ACTIVE_ORG'
          ? 'No active org for user. Please set profiles.active_org_id.'
          : e?.message || 'Org resolution failed';
        return NextResponse.json({ error: msg }, { status: 403 });
      }
    }

    if (resource === 'locations') {
      const { data, error } = await supabaseAdmin
        .from('nursery_locations')
        .select('id,name')
        .eq('org_id', orgId! )
        .order('name', { ascending: true });

      if (error) throw new Error(error.message);
      return NextResponse.json({ options: data ?? [] });
    }

    if (resource === 'suppliers') {
      const { data, error } = await supabaseAdmin
        .from('suppliers')
        .select('id,name,producer_code,country_code')
        .eq('org_id', orgId! )
        .order('name', { ascending: true });

      if (error) throw new Error(error.message);
      return NextResponse.json({ options: data ?? [] });
    }

    if (resource === 'varieties') {
      const { data, error } = await supabaseAdmin
        .from('plant_varieties')
        .select('id,name,family,genus,species')
        .order('name', { ascending: true });

      if (error) throw new Error(error.message);
      return NextResponse.json({ options: data ?? [] });
    }

    if (resource === 'sizes') {
      const { data, error } = await supabaseAdmin
        .from('plant_sizes')
        .select('id,name,container_type,cell_multiple')
        .order('name', { ascending: true });

      if (error) throw new Error(error.message);
      return NextResponse.json({ options: data ?? [] });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  } catch (e: any) {
    console.error('[lookups] GET failed:', { message: e?.message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
