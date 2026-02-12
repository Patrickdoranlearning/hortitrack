import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerApp } from "@/server/db/supabaseServerApp";
import { getUserAndOrg } from "@/server/auth/org";
import { logger, getErrorMessage } from "@/server/utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SizeCategoryCreateBody {
  name: string;
  displayOrder?: number;
  color?: string;
  plantSizeIds?: string[];
}

interface SizeCategoryUpdateBody {
  id: string;
  name?: string;
  displayOrder?: number;
  color?: string;
  plantSizeIds?: string[];
}

interface SizeCategoryDeleteBody {
  id: string;
}

// ---------------------------------------------------------------------------
// GET /api/picking/size-categories
// List all size categories with their associated plant sizes.
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const { data, error } = await supabase
      .from("picking_size_categories")
      .select(
        `
        *,
        picking_size_category_sizes(
          id,
          plant_size_id,
          plant_size:plant_sizes(id, name)
        )
      `
      )
      .eq("org_id", orgId)
      .order("display_order", { ascending: true });

    if (error) {
      logger.picking.error("Error fetching size categories", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ categories: data ?? [] });
  } catch (error: unknown) {
    logger.picking.error("Size categories GET failed", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/picking/size-categories
// Create a new size category, optionally linking plant sizes.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();
    const body: SizeCategoryCreateBody = await req.json();

    const { name, displayOrder, color, plantSizeIds } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    // Insert the category
    const { data: category, error: categoryError } = await supabase
      .from("picking_size_categories")
      .insert({
        org_id: orgId,
        name: name.trim(),
        display_order: displayOrder ?? 0,
        color: color ?? null,
      })
      .select()
      .single();

    if (categoryError) {
      logger.picking.error("Error creating size category", categoryError);
      return NextResponse.json(
        { error: categoryError.message },
        { status: 500 }
      );
    }

    // Link plant sizes if provided
    if (plantSizeIds && plantSizeIds.length > 0) {
      const junctionRows = plantSizeIds.map((plantSizeId: string) => ({
        category_id: category.id,
        plant_size_id: plantSizeId,
      }));

      const { error: junctionError } = await supabase
        .from("picking_size_category_sizes")
        .insert(junctionRows);

      if (junctionError) {
        logger.picking.error(
          "Error linking plant sizes to category",
          junctionError
        );
        // Non-fatal: the category was created. Return it with a warning.
        return NextResponse.json(
          {
            category,
            warning: "Category created but some plant sizes could not be linked",
          },
          { status: 201 }
        );
      }
    }

    // Re-fetch the category with its linked sizes for a complete response
    const { data: fullCategory, error: fetchError } = await supabase
      .from("picking_size_categories")
      .select(
        `
        *,
        picking_size_category_sizes(
          id,
          plant_size_id,
          plant_size:plant_sizes(id, name)
        )
      `
      )
      .eq("id", category.id)
      .single();

    if (fetchError) {
      logger.picking.error("Error re-fetching created category", fetchError);
      // Return the basic category if the re-fetch fails
      return NextResponse.json({ category }, { status: 201 });
    }

    return NextResponse.json({ category: fullCategory }, { status: 201 });
  } catch (error: unknown) {
    logger.picking.error("Size categories POST failed", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/picking/size-categories
// Update an existing size category. If plantSizeIds is provided, replace all
// junction rows (delete + re-insert).
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();
    const body: SizeCategoryUpdateBody = await req.json();

    const { id, name, displayOrder, color, plantSizeIds } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    // Build the update payload -- only include fields that were provided
    const updatePayload: Record<string, unknown> = {};
    if (name !== undefined) updatePayload.name = name.trim();
    if (displayOrder !== undefined) updatePayload.display_order = displayOrder;
    if (color !== undefined) updatePayload.color = color;

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from("picking_size_categories")
        .update(updatePayload)
        .eq("id", id)
        .eq("org_id", orgId);

      if (updateError) {
        logger.picking.error("Error updating size category", updateError);
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }
    }

    // Replace plant size links if provided
    if (plantSizeIds !== undefined) {
      // Delete existing junction rows for this category
      const { error: deleteJunctionError } = await supabase
        .from("picking_size_category_sizes")
        .delete()
        .eq("category_id", id);

      if (deleteJunctionError) {
        logger.picking.error(
          "Error removing existing size links",
          deleteJunctionError
        );
        return NextResponse.json(
          { error: deleteJunctionError.message },
          { status: 500 }
        );
      }

      // Re-insert if there are new sizes to link
      if (plantSizeIds.length > 0) {
        const junctionRows = plantSizeIds.map((plantSizeId: string) => ({
          category_id: id,
          plant_size_id: plantSizeId,
        }));

        const { error: insertJunctionError } = await supabase
          .from("picking_size_category_sizes")
          .insert(junctionRows);

        if (insertJunctionError) {
          logger.picking.error(
            "Error inserting new size links",
            insertJunctionError
          );
          return NextResponse.json(
            { error: insertJunctionError.message },
            { status: 500 }
          );
        }
      }
    }

    // Re-fetch the updated category with its linked sizes
    const { data: updatedCategory, error: fetchError } = await supabase
      .from("picking_size_categories")
      .select(
        `
        *,
        picking_size_category_sizes(
          id,
          plant_size_id,
          plant_size:plant_sizes(id, name)
        )
      `
      )
      .eq("id", id)
      .eq("org_id", orgId)
      .single();

    if (fetchError) {
      logger.picking.error("Error re-fetching updated category", fetchError);
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ category: updatedCategory });
  } catch (error: unknown) {
    logger.picking.error("Size categories PATCH failed", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/picking/size-categories
// Delete a size category. CASCADE on the foreign key will remove junction rows.
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();
    const body: SizeCategoryDeleteBody = await req.json();

    const { id } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("picking_size_categories")
      .delete()
      .eq("id", id)
      .eq("org_id", orgId);

    if (error) {
      logger.picking.error("Error deleting size category", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.picking.error("Size categories DELETE failed", error);
    return NextResponse.json(
      { error: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
