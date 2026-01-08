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
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Authentication failed";
      return NextResponse.json({ error: message }, { status: 401 });
    }

    const history = await buildBatchHistory(id);
    return NextResponse.json({ logs: history.logs });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = /Unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
