import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { buildPlantHealthHistory, getPlantHealthSummary } from "@/server/batches/plant-health-history";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const includeSummary = searchParams.get('summary') === 'true';

    // Validate user is authenticated
    try {
      await getUserAndOrg();
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Authentication failed";
      return NextResponse.json({ error: message }, { status: 401 });
    }

    const logs = await buildPlantHealthHistory(id);

    if (includeSummary) {
      const summary = await getPlantHealthSummary(id);
      return NextResponse.json({ logs, summary });
    }

    return NextResponse.json({ logs });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = /Unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
