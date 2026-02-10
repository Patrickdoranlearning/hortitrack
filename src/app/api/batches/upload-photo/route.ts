import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

function bad(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

/**
 * POST /api/batches/upload-photo
 *
 * Upload a sales photo for a batch and update the batch's sales_photo_url field.
 * Used by the Saleability Wizard.
 *
 * FormData:
 * - file: The image file
 * - batchId: The batch ID to update
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return bad(401, "UNAUTHORIZED", "Must be logged in");

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const batchId = form.get("batchId") as string | null;

    if (!file) return bad(400, "MISSING_FILE", "File is required");
    if (!batchId) return bad(400, "MISSING_BATCH_ID", "batchId is required");
    if (file.size > MAX_BYTES) return bad(400, "FILE_TOO_LARGE", "Max file size is 8MB");

    // Verify batch exists and user has access
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .select("id, org_id")
      .eq("id", batchId)
      .single();

    if (batchError || !batch) {
      return bad(404, "BATCH_NOT_FOUND", "Batch not found");
    }

    // Upload to Supabase Storage
    const ext = (file.type?.split("/")?.[1] ?? "jpg").replace(/[^a-z0-9]/gi, "");
    const fileName = `${batchId}/sales-${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("batch-photos")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      logger.api.error("Storage upload failed for batch photo", uploadError, { batchId });
      return bad(500, "UPLOAD_FAILED", uploadError.message);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("batch-photos").getPublicUrl(fileName);

    // Update batch with new sales photo URL
    const { error: updateError } = await supabase
      .from("batches")
      .update({
        sales_photo_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId);

    if (updateError) {
      logger.api.error("Batch photo URL update failed", updateError, { batchId });
      return bad(500, "UPDATE_FAILED", updateError.message);
    }

    // Log the photo upload as a batch event (non-critical)
    await supabase
      .from("batch_events")
      .insert({
        batch_id: batchId,
        org_id: batch.org_id,
        type: "SALES_PHOTO_UPLOAD",
        by_user_id: user.id,
        payload: {
          url: publicUrl,
          storage_path: fileName,
        },
      })
      .catch(() => {
        logger.api.warn("Failed to log photo upload event", { batchId });
      });

    return NextResponse.json(
      {
        ok: true,
        data: {
          url: publicUrl,
          storagePath: fileName,
        },
      },
      { status: 200 }
    );
  } catch (e: any) {
    logger.api.error("Batch photo upload failed", e);
    return bad(500, "UPLOAD_FAIL", e?.message ?? "Upload failed");
  }
}
