import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabaseServerApp";
import { getUserAndOrg } from "@/server/auth/org";
import { logger, getErrorMessage } from "@/server/utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SpecializationBody {
  userId: string;
  categoryId: string;
  proficiency: number;
}

interface DeleteBody {
  userId: string;
  categoryId: string;
}

const VALID_PROFICIENCIES = [1, 2, 3] as const;

// ---------------------------------------------------------------------------
// GET /api/picking/specializations - List all specializations for the org
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const { data, error } = await supabase
      .from("picker_specializations")
      .select(
        `
        *,
        profile:profiles(id, full_name, display_name, email),
        category:picking_size_categories(id, name, color)
      `
      )
      .eq("org_id", orgId);

    if (error) {
      logger.picking.error("Error fetching picker specializations", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ specializations: data ?? [] });
  } catch (error) {
    logger.picking.error("Specializations GET failed", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/picking/specializations - Create or update a specialization (upsert)
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();
    const body: unknown = await req.json();

    // Validate body shape
    const { userId, categoryId, proficiency } = body as SpecializationBody;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "userId is required and must be a string" },
        { status: 400 }
      );
    }

    if (!categoryId || typeof categoryId !== "string") {
      return NextResponse.json(
        { error: "categoryId is required and must be a string" },
        { status: 400 }
      );
    }

    if (
      proficiency == null ||
      !VALID_PROFICIENCIES.includes(proficiency as typeof VALID_PROFICIENCIES[number])
    ) {
      return NextResponse.json(
        { error: "proficiency must be 1, 2, or 3" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("picker_specializations")
      .upsert(
        {
          org_id: orgId,
          user_id: userId,
          category_id: categoryId,
          proficiency,
        },
        { onConflict: "org_id,user_id,category_id" }
      )
      .select(
        `
        *,
        profile:profiles(id, full_name, display_name, email),
        category:picking_size_categories(id, name, color)
      `
      )
      .single();

    if (error) {
      logger.picking.error("Error upserting picker specialization", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ specialization: data });
  } catch (error) {
    logger.picking.error("Specializations POST failed", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/picking/specializations - Remove a specialization
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();
    const body: unknown = await req.json();

    const { userId, categoryId } = body as DeleteBody;

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "userId is required and must be a string" },
        { status: 400 }
      );
    }

    if (!categoryId || typeof categoryId !== "string") {
      return NextResponse.json(
        { error: "categoryId is required and must be a string" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("picker_specializations")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .eq("category_id", categoryId);

    if (error) {
      logger.picking.error("Error deleting picker specialization", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.picking.error("Specializations DELETE failed", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
