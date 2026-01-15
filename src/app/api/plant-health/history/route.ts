import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getOrgPlantHealthHistory } from "@/server/batches/plant-health-history";

export async function GET(req: NextRequest) {
  try {
    // Validate user is authenticated
    let org;
    try {
      const auth = await getUserAndOrg();
      org = auth.org;
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Authentication failed";
      return NextResponse.json({ error: message }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batchId') || undefined;
    const eventType = searchParams.get('eventType') || undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await getOrgPlantHealthHistory({
      orgId: org.id,
      batchId,
      eventType,
      fromDate,
      toDate,
      search,
      limit,
      offset
    });

    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = /Unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
