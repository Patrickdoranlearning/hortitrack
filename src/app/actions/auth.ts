'use server';

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from 'next/cache';

export async function updateActiveOrgAction(orgId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: 'Not authenticated' };
    }

    // Verify membership
    const { data: membership } = await supabase
        .from('org_memberships')
        .select('org_id')
        .eq('user_id', user.id)
        .eq('org_id', orgId)
        .single();

    if (!membership) {
        return { success: false, error: 'Not a member of this organization' };
    }

    // Update profile
    const { error } = await supabase
        .from('profiles')
        .update({ active_org_id: orgId })
        .eq('id', user.id);

    if (error) {
        return { success: false, error: error.message };
    }

    revalidatePath('/', 'layout'); // Revalidate everything to reflect new org
    return { success: true };
}
