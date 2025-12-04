import { NextResponse } from "next/server";
import { createPropagationBatch } from "@/server/batches/service";
import { PropagationFormSchema } from "@/types/batch";
import { getUserIdAndOrgId } from "@/server/auth/getUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { userId } = await getUserIdAndOrgId();
    const body = await req.json();
    const input = PropagationFormSchema.parse(body);

    const newBatch = await createPropagationBatch({ input, userId });

    return NextResponse.json({ success: true, newBatch }, { status: 201 });
  } catch (error: any) {
    console.error("[api/batches/propagation-start] error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to start propagation" },
      { status: 500 }
    );
  }
}
