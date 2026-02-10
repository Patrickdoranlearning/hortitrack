import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";

// Limits
const SALES_CAP = 6;
const PURCHASE_GROWER_CAP = 3;
const MAX_BYTES = 8 * 1024 * 1024;

function bad(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  try {
    const supabase = await createClient();
    const { data: photos, error } = await supabase
      .from("batch_photos")
      .select("*")
      .eq("batch_id", batchId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, data: { photos } }, { status: 200 });
  } catch (e: any) {
    return bad(500, "LIST_FAIL", e?.message ?? "Failed to list photos");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  try {
    const supabase = await createClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return bad(401, "UNAUTHORIZED", "Must be logged in");

    // Basic role check (can be enhanced with RLS or custom claims)
    const role = (req.headers.get("x-role") ?? "").toUpperCase();

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const type = String(form.get("type") ?? "GROWER").toUpperCase() as "GROWER" | "SALES";

    if (!file) throw new Error("Missing file");
    if (!["GROWER", "SALES"].includes(type)) throw new Error("type must be GROWER|SALES");
    if (file.size > MAX_BYTES) throw new Error("Max 8MB");

    // Fetch batch to check constraints
    const { data: batch, error: batchError } = await supabase
      .from("batches") // Assuming 'batches' table exists
      .select("*")
      .eq("id", batchId)
      .single();

    if (batchError || !batch) throw new Error("Batch not found");

    const isPurchase = (batch.source_type ?? "Propagation") === "Purchase"; // Snake_case for DB

    // Enforce caps
    const { count, error: countError } = await supabase
      .from("batch_photos")
      .select("*", { count: 'exact', head: true })
      .eq("batch_id", batchId)
      .eq("type", type);

    if (countError) throw countError;
    const currentCount = count ?? 0;

    if (type === "SALES" && currentCount >= SALES_CAP) {
      throw new Error("Reached Sales photo limit");
    }
    if (type === "GROWER" && isPurchase && currentCount >= PURCHASE_GROWER_CAP) {
      throw new Error("Reached Check-in photo limit (3)");
    }

    // Upload to Supabase Storage
    const ext = (file.type?.split("/")?.[1] ?? "bin").replace(/[^a-z0-9]/gi, "");
    const filePath = `${batchId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from("photos") // Assuming 'photos' bucket exists
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(filePath);

    // Insert into batch_photos table (include org_id for RLS)
    const { data: photoDoc, error: dbError } = await supabase
      .from("batch_photos")
      .insert({
        org_id: batch.org_id,
        batch_id: batchId,
        url: publicUrl,
        type,
        storage_path: filePath,
        created_by: user.id,
        created_by_role: role
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // Log the photo upload as a batch event (non-critical)
    try {
      await supabase.from("batch_events").insert({
        batch_id: batchId,
        org_id: batch.org_id,
        type: "PHOTO_UPLOAD",
        by_user_id: user.id,
        payload: {
          photo_id: photoDoc.id,
          photo_type: type,
          url: publicUrl,
        },
      });
    } catch {
      // Non-critical: don't fail the upload if event logging fails
    }

    return NextResponse.json({ ok: true, data: photoDoc }, { status: 201 });

  } catch (e: any) {
    logger.api.error("Batch photo upload failed", e);
    const message = e.message || "Upload failed";
    let status = 500;
    if (/not found/i.test(message)) status = 404;
    if (/limit/i.test(message) || /permissions/i.test(message) || /must be/i.test(message)) status = 400;

    return bad(status, "UPLOAD_FAIL", message);
  }
}
