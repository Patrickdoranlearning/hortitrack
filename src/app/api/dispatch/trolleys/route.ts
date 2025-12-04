// src/app/api/dispatch/trolleys/route.ts
import { NextResponse } from "next/server";
import { CreateTrolleySchema } from "@/lib/dispatch/types";
import {
  listTrolleys,
  createTrolley,
  getCustomerTrolleyBalances,
} from "@/server/dispatch/queries.server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const balances = searchParams.get("balances");

    // If requesting customer balances
    if (balances === "true") {
      const data = await getCustomerTrolleyBalances();
      return NextResponse.json({ ok: true, balances: data });
    }

    const filters: any = {};
    if (status) filters.status = status;

    const trolleys = await listTrolleys(filters);
    return NextResponse.json({ ok: true, trolleys });
  } catch (err) {
    console.error("[api:dispatch/trolleys][GET]", err);
    return NextResponse.json(
      { ok: false, error: String((err as any)?.message ?? err) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = CreateTrolleySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const id = await createTrolley(parsed.data);
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    console.error("[api:dispatch/trolleys][POST]", err);
    return NextResponse.json(
      { ok: false, error: String((err as any)?.message ?? err) },
      { status: 500 }
    );
  }
}
