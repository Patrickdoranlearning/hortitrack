import { NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";

/**
 * POST /api/dispatch/trolleys/signed-docket
 * Upload a signed docket (signature + optional photo) for trolley non-return
 *
 * FormData:
 * - signature: File (PNG image of signature)
 * - photo: File (optional, JPEG photo of paper docket)
 * - customerId: string
 * - signerName: string
 * - trolleys: number
 * - shelves: number
 * - notes: string
 * - deliveryRunId: string (optional)
 */
export async function POST(request: Request) {
  try {
    const { orgId, user, supabase } = await getUserAndOrg();

    const formData = await request.formData();
    const signature = formData.get("signature") as File | null;
    const photo = formData.get("photo") as File | null;
    const customerId = formData.get("customerId") as string;
    const signerName = formData.get("signerName") as string;
    const trolleys = parseInt(formData.get("trolleys") as string) || 0;
    const shelves = parseInt(formData.get("shelves") as string) || 0;
    const notes = formData.get("notes") as string;
    const deliveryRunId = formData.get("deliveryRunId") as string | null;

    if (!signature) {
      return NextResponse.json(
        { error: "Signature is required" },
        { status: 400 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    let signedDocketUrl: string | null = null;
    let photoUrl: string | null = null;

    // Upload signature
    const signatureBuffer = await signature.arrayBuffer();
    const signaturePath = `signed-dockets/${orgId}/${customerId}/${timestamp}-signature.png`;

    const { error: signatureUploadError } = await supabase.storage
      .from("media")
      .upload(signaturePath, signatureBuffer, {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false,
      });

    if (signatureUploadError) {
      console.error("Signature upload error:", signatureUploadError);
      return NextResponse.json(
        { error: "Failed to upload signature" },
        { status: 500 }
      );
    }

    // Get public URL for signature
    const { data: signatureUrlData } = supabase.storage
      .from("media")
      .getPublicUrl(signaturePath);
    signedDocketUrl = signatureUrlData.publicUrl;

    // Upload photo if provided
    if (photo) {
      const photoBuffer = await photo.arrayBuffer();
      const photoPath = `signed-dockets/${orgId}/${customerId}/${timestamp}-photo.jpg`;

      const { error: photoUploadError } = await supabase.storage
        .from("media")
        .upload(photoPath, photoBuffer, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });

      if (photoUploadError) {
        console.error("Photo upload error:", photoUploadError);
        // Don't fail the whole operation, signature is the important part
      } else {
        const { data: photoUrlData } = supabase.storage
          .from("media")
          .getPublicUrl(photoPath);
        photoUrl = photoUrlData.publicUrl;
      }
    }

    // Record the movement in equipment_movement_log with signed docket
    const { error: movementError } = await supabase
      .from("equipment_movement_log")
      .insert({
        org_id: orgId,
        movement_type: "not_returned",
        customer_id: customerId,
        trolleys: trolleys,
        shelves: shelves,
        delivery_run_id: deliveryRunId || null,
        notes: notes
          ? `${signerName ? `Signed by: ${signerName}. ` : ""}${notes}`
          : signerName
          ? `Signed by: ${signerName}`
          : null,
        signed_docket_url: signedDocketUrl,
        recorded_by: user.id,
        movement_date: new Date().toISOString(),
      });

    if (movementError) {
      console.error("Movement log error:", movementError);
      // Don't fail - the files are uploaded, just log the error
    }

    return NextResponse.json({
      success: true,
      signedDocketUrl,
      photoUrl,
    });
  } catch (error: any) {
    console.error("Error uploading signed docket:", error);
    return NextResponse.json(
      { error: "Failed to process signed docket" },
      { status: 500 }
    );
  }
}
