// src/app/api/sales/customers/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listCustomers } from "@/server/sales/customers.server";
import { FirebaseCredentialError } from "@/server/errors";
import { logger } from "@/server/utils/logger";

export async function GET() {
  // Verify user is authenticated
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

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
    logger.sales.error("GET /api/sales/customers failed", e);
    return NextResponse.json({ ok: false, error: "Failed to fetch customers" }, { status: 500 });
  }
}
