'use server';

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from 'next/cache';
import type { ActionResult } from "@/lib/errors";
import { logError } from "@/lib/log";

export async function updateActiveOrgAction(orgId: string): Promise<ActionResult<null>> {
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
        logError("updateActiveOrgAction: failed to update profile", { error: error.message, userId: user.id, orgId });
        return { success: false, error: error.message };
    }

    revalidatePath('/', 'layout'); // Revalidate everything to reflect new org
    return { success: true, data: null };
}
