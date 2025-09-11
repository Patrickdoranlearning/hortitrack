
// This file is no longer needed and can be deleted.
// The functionality has been replaced by the more generic /api/batches/[batchId]/flags route.
import { NextResponse } from "next/server";

export async function PATCH() {
    return NextResponse.json({ 
        error: "This endpoint is deprecated. Please use PATCH /api/batches/[batchId]/flags instead." 
    }, { status: 410 });
}
