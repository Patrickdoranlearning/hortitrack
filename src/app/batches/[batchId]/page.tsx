// This file is no longer needed and can be deleted.
// The functionality has been replaced by the more generic /api/batches/[batchId]/history page.
import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({ 
        error: "This endpoint is deprecated. Please use GET /api/batches/[batchId]/history instead." 
    }, { status: 410 });
}
