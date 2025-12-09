import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseServerApp } from "@/server/db/supabase";

/**
 * Upload a media file and optionally attach it to an entity (batch, variety, product)
 * 
 * POST /api/media/upload
 * FormData:
 *   - file: File (image)
 *   - entityType?: 'batch' | 'variety' | 'product'
 *   - entityId?: string (uuid)
 *   - badgeType?: 'live_crop' | 'reference' | 'size_guide'
 *   - caption?: string
 *   - isHero?: 'true' | 'false'
 *   - displayOrder?: number
 */
export async function POST(req: NextRequest) {
  try {
    const { user, orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: jpeg, png, gif, webp" },
        { status: 400 }
      );
    }

    // Generate storage path
    const timestamp = Date.now();
    const ext = file.name.split(".").pop() || "jpg";
    const storagePath = `${orgId}/media/${timestamp}.${ext}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[media/upload] storage error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("media")
      .getPublicUrl(storagePath);

    const filePath = urlData.publicUrl;

    // Create media_library record
    const { data: mediaRecord, error: mediaError } = await supabase
      .from("media_library")
      .insert({
        org_id: orgId,
        file_path: filePath,
        storage_path: storagePath,
        media_type: "image",
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (mediaError || !mediaRecord) {
      console.error("[media/upload] media_library insert error:", mediaError);
      // Clean up uploaded file
      await supabase.storage.from("media").remove([storagePath]);
      return NextResponse.json(
        { error: "Failed to create media record" },
        { status: 500 }
      );
    }

    // Optionally attach to an entity
    const entityType = formData.get("entityType") as string | null;
    const entityId = formData.get("entityId") as string | null;

    if (entityType && entityId) {
      const validEntityTypes = ["batch", "variety", "product"];
      if (!validEntityTypes.includes(entityType)) {
        return NextResponse.json(
          { error: "Invalid entity type" },
          { status: 400 }
        );
      }

      const badgeType = formData.get("badgeType") as string | null;
      const caption = formData.get("caption") as string | null;
      const isHero = formData.get("isHero") === "true";
      const displayOrder = parseInt(formData.get("displayOrder") as string) || 0;

      const { error: attachError } = await supabase
        .from("media_attachments")
        .insert({
          org_id: orgId,
          media_id: mediaRecord.id,
          entity_type: entityType,
          entity_id: entityId,
          badge_type: badgeType,
          caption: caption,
          is_hero: isHero,
          display_order: displayOrder,
        });

      if (attachError) {
        console.error("[media/upload] attachment error:", attachError);
        // Don't fail the whole request, media is still uploaded
      }
    }

    return NextResponse.json({
      mediaId: mediaRecord.id,
      filePath: mediaRecord.file_path,
      storagePath: mediaRecord.storage_path,
    });
  } catch (err) {
    console.error("[media/upload] unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error during upload" },
      { status: 500 }
    );
  }
}

