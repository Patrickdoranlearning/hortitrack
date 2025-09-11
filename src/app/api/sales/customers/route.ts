// src/app/api/sales/customers/route.ts
import { NextResponse } from "next/server";
import { listCustomers } from "@/server/sales/customers.server";
import { FirebaseCredentialError } from "@/server/errors";

export async function GET() {
  try {
    const customers = await listCustomers();
    return NextResponse.json({ ok: true, customers });
  } catch (e) {
    if (e instanceof FirebaseCredentialError) {
      // Surface a clear, actionable error
      return NextResponse.json(
        { ok: false, error: e.message, code: e.code },
        { status: 503 },
      );
    }
    console.error("[api:sales/customers][GET]", e);
    return NextResponse.json({ ok: false, error: "Failed to fetch customers" }, { status: 500 });
  }
}
