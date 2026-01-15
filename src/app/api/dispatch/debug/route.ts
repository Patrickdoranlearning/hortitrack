import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserAndOrg } from '@/server/auth/org';

/**
 * GET /api/dispatch/debug
 * Diagnostic endpoint to check picker assignments
 * Returns current user info and recent pick_lists with their assignments
 */
export async function GET(req: NextRequest) {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Get recent pick lists with assignments
    const { data: pickLists, error: pickListsError } = await supabase
      .from('pick_lists')
      .select(`
        id,
        order_id,
        assigned_user_id,
        status,
        created_at,
        updated_at,
        orders(order_number, status)
      `)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (pickListsError) {
      console.error('[Dispatch Debug] Error fetching pick lists:', pickListsError);
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch pick lists' },
        { status: 500 }
      );
    }

    // Get profiles for assigned user IDs
    const assignedUserIds = [...new Set(
      (pickLists || [])
        .map(pl => pl.assigned_user_id)
        .filter(Boolean)
    )];

    let profilesMap: Record<string, string> = {};
    if (assignedUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, email')
        .in('id', assignedUserIds);

      (profiles || []).forEach((p: any) => {
        profilesMap[p.id] = p.display_name || p.email || 'Unknown';
      });
    }

    // Enrich pick lists with picker names
    const enrichedPickLists = (pickLists || []).map(pl => ({
      ...pl,
      assigned_picker_name: pl.assigned_user_id ? profilesMap[pl.assigned_user_id] || 'Unknown' : null,
      is_assigned_to_current_user: pl.assigned_user_id === user.id,
    }));

    // Filter to show only those assigned to current user
    const myPickLists = enrichedPickLists.filter(pl => pl.assigned_user_id === user.id);
    const myActivePickLists = myPickLists.filter(pl => ['pending', 'in_progress'].includes(pl.status));

    return NextResponse.json({
      ok: true,
      currentUser: {
        id: user.id,
        email: user.email,
      },
      orgId,
      summary: {
        totalPickLists: enrichedPickLists.length,
        assignedToCurrentUser: myPickLists.length,
        activeAssignedToCurrentUser: myActivePickLists.length,
      },
      myActivePickLists,
      allRecentPickLists: enrichedPickLists,
    });
  } catch (error: any) {
    console.error('[Dispatch Debug] Error:', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
