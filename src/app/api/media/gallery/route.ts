import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getSmartGallery, galleryToProductFormat } from "@/server/media/gallery";

/**
 * Get Smart Gallery images for a product/variety/batch combination
 * 
 * GET /api/media/gallery?batchId=xxx&varietyId=xxx&productId=xxx
 */
export async function GET(req: NextRequest) {
  try {
    const { orgId } = await getUserAndOrg();
    const { searchParams } = new URL(req.url);
    
    const batchId = searchParams.get("batchId");
    const varietyId = searchParams.get("varietyId");
    const productId = searchParams.get("productId");
    const format = searchParams.get("format"); // 'full' or 'product' (for CustomerCatalogProduct)

    if (!batchId && !varietyId && !productId) {
      return NextResponse.json(
        { error: "At least one of batchId, varietyId, or productId is required" },
        { status: 400 }
      );
    }

    const images = await getSmartGallery({
      batchId,
      varietyId,
      productId,
      orgId,
    });

    // Return in requested format
    if (format === "product") {
      return NextResponse.json({
        images: galleryToProductFormat(images),
      });
    }

    return NextResponse.json({ images });
  } catch (err) {
    console.error("[media/gallery] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch gallery" },
      { status: 500 }
    );
  }
}

