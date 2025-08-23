// src/app/api/me/roles/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getUser } from "@/server/auth/getUser";

export async function GET() {
  try {
    const user = await getUser();
    const roles = (user as any).roles ?? [];
    return NextResponse.json({ uid: user.uid, roles });
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}