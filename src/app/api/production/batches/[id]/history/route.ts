import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { buildBatchHistory } from "@/server/batches/history";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate user is authenticated
    try {
      await getUserAndOrg();
    } catch (authError: any) {
      console.error("[history] Auth error:", authError?.message);
      return NextResponse.json({ error: authError?.message ?? "Authentication failed" }, { status: 401 });
    }

    const history = await buildBatchHistory(id);
    return NextResponse.json({ logs: history.logs });
  } catch (e: any) {
    console.error("[history] Error:", e?.message, e?.stack);
    const status = /Unauthenticated/i.test(e?.message) ? 401 : 500;
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status });
  }
}
