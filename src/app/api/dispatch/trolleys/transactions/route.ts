// src/app/api/dispatch/trolleys/transactions/route.ts
import { NextResponse } from "next/server";
import { CreateTrolleyTransactionSchema } from "@/lib/dispatch/types";
import { recordTrolleyTransaction } from "@/server/dispatch/queries.server";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = CreateTrolleyTransactionSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const id = await recordTrolleyTransaction(parsed.data);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    console.error("[api:dispatch/trolleys/transactions][POST]", err);
    return NextResponse.json(
      { ok: false, error: String((err as any)?.message ?? err) },
      { status: 500 }
    );
  }
}
