import { NextRequest, NextResponse } from "next/server";
import { getUserIdAndOrgId } from "@/server/auth/getUser";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { supabaseAdmin } from "@/server/db/supabaseAdmin";

export async function GET() {
  try {
    const { userId, orgId } = await getUserIdAndOrgId();

    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await getSupabaseServerApp();

    // Check if user is admin or owner
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all members of the organization using admin client to bypass RLS
    const { data: memberships, error: membershipsError } = await supabaseAdmin
      .from("org_memberships")
      .select("user_id, role, created_at, profiles(id, full_name, display_name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });

    // Get emails from auth.users for each member
    const memberIds = memberships?.map(m => m.user_id) || [];
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
    const emailMap = new Map(
      authUsers?.users?.map(u => [u.id, u.email]) || []
    );

    // Merge email into the response
    const membersWithEmail = memberships?.map(m => ({
      ...m,
      profiles: {
        ...m.profiles,
        email: emailMap.get(m.user_id) || null
      }
    })) || [];

    if (membershipsError) {
      // Check for the specific schema cache error and provide a user-friendly message
      if (membershipsError.code === "PGRST200") {
        console.error("Schema cache error fetching members:", membershipsError);
        return NextResponse.json(
          {
            error:
              "Database schema might be out of sync. Please try again in a few moments.",
          },
          { status: 500 }
        );
      }
      console.error("Error fetching members:", membershipsError);
      return NextResponse.json(
        { error: "Failed to fetch members" },
        { status: 500 }
      );
    }

    return NextResponse.json({ members: membersWithEmail });
  } catch (error) {
    console.error("Error in GET /api/org/members:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Generate a secure random password
function generatePassword(length = 12): string {
  const lowercase = 'abcdefghijkmnpqrstuvwxyz'; // removed l, o for clarity
  const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // removed I, O for clarity
  const numbers = '23456789'; // removed 0, 1 for clarity
  const all = lowercase + uppercase + numbers;
  
  let password = '';
  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await getUserIdAndOrgId();

    if (!userId || !orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await getSupabaseServerApp();

    // Check if user is admin or owner
    const { data: membership } = await supabase
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role || "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { email, role, fullName } = body;

    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    if (!fullName) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }

    // Validate role
    const validRoles = ["owner", "admin", "grower", "sales", "viewer"];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (existingUser) {
      // Check if they're already in this org
      const { data: existingMembership } = await supabase
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (existingMembership) {
        return NextResponse.json(
          { error: "This user is already a member of your organization" },
          { status: 400 }
        );
      }

      // Ensure profile exists for the existing user (required by FK constraint)
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: existingUser.id,
          email: existingUser.email,
          full_name: existingUser.user_metadata?.full_name || fullName || email.split('@')[0],
        }, {
          onConflict: "id",
        });

      if (profileError) {
        console.error("Error ensuring profile for existing user:", profileError);
        return NextResponse.json(
          { error: "Failed to prepare user profile" },
          { status: 500 }
        );
      }

      // Add existing user to this org - use admin client to bypass RLS
      const { error: membershipError } = await supabaseAdmin
        .from("org_memberships")
        .insert({
          org_id: orgId,
          user_id: existingUser.id,
          role: role,
        });

      if (membershipError) {
        console.error("Error adding existing user to org:", membershipError);
        return NextResponse.json(
          { error: "Failed to add user to organization" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `${email} has been added to your organization`,
        existingUser: true,
      });
    }

    // Generate a temporary password
    const tempPassword = generatePassword(12);

    // Create new user with password
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email so they can log in immediately
      user_metadata: {
        full_name: fullName,
        default_org_id: orgId,
        default_org_role: role,
      },
    });

    if (createError) {
      console.error("Error creating user:", createError);
      return NextResponse.json(
        { error: createError.message || "Failed to create user" },
        { status: 500 }
      );
    }

    if (!newUser.user) {
      return NextResponse.json(
        { error: "Failed to create user - no user returned" },
        { status: 500 }
      );
    }

    // Create profile FIRST (required by FK constraint on org_memberships)
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: newUser.user.id,
        email: email,
        full_name: fullName,
        active_org_id: orgId,
      }, {
        onConflict: "id",
      });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Delete the auth user since we couldn't create profile
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json(
        { error: "Failed to create user profile. Please try again." },
        { status: 500 }
      );
    }

    // Create org membership - use admin client to bypass RLS
    const { error: membershipError } = await supabaseAdmin
      .from("org_memberships")
      .insert({
        org_id: orgId,
        user_id: newUser.user.id,
        role: role,
      });

    if (membershipError) {
      console.error("Error creating org membership:", membershipError);
      // Delete the auth user since we couldn't add them to the org
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      return NextResponse.json(
        { error: "Failed to add user to organization. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User account created for ${fullName}`,
      credentials: {
        email,
        password: tempPassword,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/org/members:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
