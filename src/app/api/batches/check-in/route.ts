import { NextResponse } from "next/server";
import { createCheckinBatch } from "@/server/batches/service";
import { CheckinFormSchema } from "@/types/batch";
import { getUserIdAndOrgId } from "@/server/auth/getUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await getUserIdAndOrgId();
    const body = await req.json();
    const input = CheckinFormSchema.parse(body);

    const newBatch = await createCheckinBatch({ input, userId });

    return NextResponse.json({ success: true, newBatch }, { status: 201 });
  } catch (error: any) {
    console.error("[api/batches/check-in] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to check in batch" },
      { status: 500 }
    );
  }
}
