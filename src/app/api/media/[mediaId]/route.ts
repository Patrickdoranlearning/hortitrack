import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseServerApp } from "@/server/db/supabase";

const MEDIA_BUCKET = "batch-photos";

type RouteParams = {
  params: Promise<{ mediaId: string }>;
};

/**
 * DELETE /api/media/[mediaId] - Delete a media item and its attachments
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { mediaId } = await params;
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    // Get the media record to verify ownership and get storage path
    const { data: media, error: fetchError } = await supabase
      .from("media_library")
      .select("id, org_id, storage_path")
      .eq("id", mediaId)
      .single();

    if (fetchError || !media) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    if (media.org_id !== orgId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Delete from storage if path exists
    if (media.storage_path) {
      const { error: storageError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .remove([media.storage_path]);

      if (storageError) {
        console.error("[media/delete] storage error:", storageError);
        // Continue anyway - might be already deleted
      }
    }

    // Delete attachments (cascade should handle this, but be explicit)
    await supabase
      .from("media_attachments")
      .delete()
      .eq("media_id", mediaId);

    // Delete media record
    const { error: deleteError } = await supabase
      .from("media_library")
      .delete()
      .eq("id", mediaId);

    if (deleteError) {
      console.error("[media/delete] delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete media" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[media/delete] error:", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}



