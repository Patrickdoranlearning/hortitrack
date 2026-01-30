// src/app/api/dispatch/items/[itemId]/route.ts
import { NextResponse } from "next/server";
import { UpdateDeliveryItemSchema } from "@/lib/dispatch/types";
import { updateDeliveryItem } from "@/server/dispatch/queries.server";
import { logger, getErrorMessage } from "@/server/utils/logger";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params;
    const json = await req.json();
    const parsed = UpdateDeliveryItemSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await updateDeliveryItem(itemId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.dispatch.error("Error updating delivery item", err);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(err) },
      { status: 500 }
    );
  }
}
