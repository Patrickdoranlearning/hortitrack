import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabaseServerApp";
import { getUserAndOrg } from "@/server/auth/org";
import { logger, getErrorMessage } from "@/server/utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SpecializationEntry {
  categoryId: string;
  proficiency: number;
}

interface BulkUpdateBody {
  userId: string;
  specializations: SpecializationEntry[];
}

const VALID_PROFICIENCIES = [1, 2, 3] as const;

// ---------------------------------------------------------------------------
// POST /api/picking/specializations/bulk - Bulk update specializations for one user
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();
    const body: unknown = await req.json();

    const { userId, specializations } = body as BulkUpdateBody;

    // ---- Validate inputs ----

    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        { error: "userId is required and must be a string" },
        { status: 400 }
      );
    }

    if (!Array.isArray(specializations)) {
      return NextResponse.json(
        { error: "specializations must be an array" },
        { status: 400 }
      );
    }

    // Validate every entry in the array
    for (let i = 0; i < specializations.length; i++) {
      const entry = specializations[i];

      if (!entry || typeof entry !== "object") {
        return NextResponse.json(
          { error: `specializations[${i}] must be an object` },
          { status: 400 }
        );
      }

      if (!entry.categoryId || typeof entry.categoryId !== "string") {
        return NextResponse.json(
          { error: `specializations[${i}].categoryId is required and must be a string` },
          { status: 400 }
        );
      }

      if (
        entry.proficiency == null ||
        !VALID_PROFICIENCIES.includes(entry.proficiency as typeof VALID_PROFICIENCIES[number])
      ) {
        return NextResponse.json(
          { error: `specializations[${i}].proficiency must be 1, 2, or 3` },
          { status: 400 }
        );
      }
    }

    // ---- Step 1: Delete all existing specializations for this user in this org ----

    const { error: deleteError } = await supabase
      .from("picker_specializations")
      .delete()
      .eq("org_id", orgId)
      .eq("user_id", userId);

    if (deleteError) {
      logger.picking.error(
        "Error deleting existing specializations during bulk update",
        deleteError
      );
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // ---- Step 2: Insert all new specializations (if any) ----

    if (specializations.length > 0) {
      const rows = specializations.map((entry) => ({
        org_id: orgId,
        user_id: userId,
        category_id: entry.categoryId,
        proficiency: entry.proficiency,
      }));

      const { error: insertError } = await supabase
        .from("picker_specializations")
        .insert(rows);

      if (insertError) {
        logger.picking.error(
          "Error inserting specializations during bulk update",
          insertError
        );
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }
    }

    logger.picking.info("Bulk specialization update completed", {
      userId,
      orgId,
      count: specializations.length,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.picking.error("Specializations bulk POST failed", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
