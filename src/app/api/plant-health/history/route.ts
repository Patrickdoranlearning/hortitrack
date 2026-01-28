import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getOrgPlantHealthHistory } from "@/server/batches/plant-health-history";
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";

export async function GET(req: NextRequest) {
  try {
    // Validate user is authenticated
    const auth = await getUserAndOrg();

    // Rate limit: 60 history requests per minute per user
    const rlKey = `plant-health:history:${requestKey(req, auth.user.id)}`;
    const rl = await checkRateLimit({ key: rlKey, windowMs: 60_000, max: 60 });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests", resetMs: rl.resetMs },
        { status: 429 }
      );
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
      orgId: auth.orgId,
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
    console.error("[api/plant-health/history] error", e);
    const message = e instanceof Error ? e.message : "Server error";
    const status = /Unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
