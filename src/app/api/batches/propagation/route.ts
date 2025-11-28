import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/server/db/supabaseAdmin';
import { getOrgForUserByEmail } from '@/server/org/getOrgForUser';
import { PropagationInput } from '@/lib/schemas/production';
import { generateBatchNumber } from '@/lib/batchNumbers';

export async function POST(req: NextRequest) {
  try {
    // 1) AuthN
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const email = user.email;

    // 2) Org
    const orgId = await getOrgForUserByEmail(email);

    // 3) Validate input
    const json = await req.json();
    const parsed = PropagationInput.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.format() }, { status: 400 });
    }
    const input = parsed.data;

    // 4) Pull size to compute units (cell_multiple)
    const { data: size, error: sizeErr } = await supabaseAdmin
      .from('plant_sizes')
      .select('id, cell_multiple')
      .eq('id', input.size_id)
      .single();
    if (sizeErr) throw new Error(`size lookup failed: ${sizeErr.message}`);
    const multiple = size?.cell_multiple ?? 1; // global table has this column
    const units = input.containers * multiple;

    // 5) Batch number generation (expand+upsert org_counters then read sequence)
    const { yy, ww, key } = await generateBatchNumber(orgId);
    // increment org_counters atomically via RPC or upsert+update
    const { error: upsertCtrErr } = await supabaseAdmin
      .from('org_counters')
      .upsert({ org_id: orgId, key, value: 0 }, { onConflict: 'org_id,key' });
    if (upsertCtrErr && upsertCtrErr.code !== '23505') { // ignore conflict
      throw new Error(`counter upsert failed: ${upsertCtrErr.message}`);
    }
    const { data: ctr, error: bumpErr } = await supabaseAdmin
      .rpc('org_counter_bump', { p_org_id: orgId, p_key: key }); // optional RPC if you’ve created it
    // Fallback: if no RPC, do a manual update returning value in serializable txn (future improvement)

    const seq = (Array.isArray(ctr) ? ctr[0]?.value : ctr?.value) ?? 1;
    const batch_number = `1-${yy}${ww}-${String(seq).padStart(5, '0')}`;

    // 6) Insert batch
    const { data: batch, error: batchErr } = await supabaseAdmin
      .from('batches')
      .insert({
        org_id: orgId,
        batch_number,
        phase: 'propagation',      // default in schema too
        status: 'Growing',         // default in schema
        plant_variety_id: input.plant_variety_id,
        size_id: input.size_id,
        location_id: input.location_id,
        quantity: units,           // current
        initial_quantity: units,   // snapshot
        unit: 'plants',
        planted_at: (input.planted_at as Date).toISOString().slice(0, 10),
        supplier_id: input.supplier_id ?? null,
        supplier_batch_number: '', // per schema default
      })
      .select('id, batch_number, plant_variety_id')
      .single();

    if (batchErr) throw new Error(`batch insert failed: ${batchErr.message}`);

    // 7) Internal Plant Passport on creation (A-D fields per spec)
    // A Family comes from variety; B Producer Code IE2727; C Supplier Batch No = our Batch Number; D Country IE
    const { data: variety, error: varErr } = await supabaseAdmin
      .from('plant_varieties')
      .select('family, name')
      .eq('id', input.plant_variety_id)
      .single();
    if (varErr) console.warn('[propagation] variety lookup failed for passport:', varErr.message);

    const { error: passErr } = await supabaseAdmin
      .from('batch_passports')
      .insert({
        org_id: orgId,
        batch_id: batch.id,
        passport_type: 'internal',
        botanical_name: variety?.name ?? null,       // optional
        operator_reg_no: 'IE2727',
        traceability_code: batch.batch_number,       // supplier batch no = our batch number
        origin_country: 'IE',
        issuer_name: 'Doran Nurseries',
      });
    if (passErr) console.error('[propagation] passport insert failed:', passErr.message);

    // 8) Event log (PROPAGATION)
    const { error: evtErr } = await supabaseAdmin
      .from('batch_events')
      .insert({
        org_id: orgId,
        batch_id: batch.id,
        type: 'PROPAGATION',
        by_user_id: user.id,
        payload: { containers: input.containers, cell_multiple: multiple, units },
      });
    if (evtErr) console.error('[propagation] event insert failed:', evtErr.message);

    return NextResponse.json({ ok: true, batch_id: batch.id, batch_number });
  } catch (e: any) {
    console.error('[propagation] POST failed:', { message: e?.message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
