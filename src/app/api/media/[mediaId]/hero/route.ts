import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseServerApp } from "@/server/db/supabase";

type RouteParams = {
  params: Promise<{ mediaId: string }>;
};

/**
 * POST /api/media/[mediaId]/hero - Set a media item as the hero image for its entity
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { mediaId } = await params;
    const { orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    // Get the attachment to find entity info
    const { data: attachment, error: fetchError } = await supabase
      .from("media_attachments")
      .select("id, org_id, entity_type, entity_id")
      .eq("media_id", mediaId)
      .single();

    if (fetchError || !attachment) {
      return NextResponse.json(
        { error: "Media attachment not found" },
        { status: 404 }
      );
    }

    if (attachment.org_id !== orgId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Reset all hero flags for this entity
    await supabase
      .from("media_attachments")
      .update({ is_hero: false })
      .eq("org_id", orgId)
      .eq("entity_type", attachment.entity_type)
      .eq("entity_id", attachment.entity_id);

    // Set this one as hero
    const { error: updateError } = await supabase
      .from("media_attachments")
      .update({ is_hero: true })
      .eq("id", attachment.id);

    if (updateError) {
      console.error("[media/hero] update error:", updateError);
      return NextResponse.json(
        { error: "Failed to set hero image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[media/hero] error:", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 }
    );
  }
}



