export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getUser } from "@/server/auth/getUser";
import { toMessage } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getUser();
    // Derive roles from your DB/claims (placeholder below)
    const roles = (user as any).roles ?? [];
    return NextResponse.json({ uid: user.uid, roles });
  } catch (e: any) {
    const msg = toMessage(e);
    const status = msg.includes("UNAUTHENTICATED") ? 401 : 500;
    return new NextResponse(msg, { status });
  }
}
