import { supabaseAdmin } from '../db/supabaseAdmin';

export async function getOrgForUserByEmail(email: string) {
  // profiles.email -> profiles.active_org_id (schema)
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('active_org_id')
    .eq('email', email)
    .maybeSingle();

  if (error) throw new Error(`[org] profiles lookup failed: ${error.message}`);
  if (!data?.active_org_id) throw new Error('NO_ACTIVE_ORG');
  return data.active_org_id as string;
}
