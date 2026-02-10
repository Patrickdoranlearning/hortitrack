import { NextResponse } from "next/server";
import { createCheckinBatch } from "@/server/batches/service";
import { CheckinFormSchema } from "@/types/batch";
import { getUserAndOrg } from "@/server/auth/org";
import { logger } from "@/server/utils/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { user } = await getUserAndOrg();
    const body = await req.json();
    const input = CheckinFormSchema.parse(body);

    const newBatch = await createCheckinBatch({ input, userId: user.id });

    return NextResponse.json({ success: true, newBatch }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Unauthenticated") {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
    const message = error instanceof Error ? error.message : "Failed to check in batch";
    logger.api.error("POST /api/batches/check-in failed", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
