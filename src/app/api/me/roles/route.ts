import { NextRequest } from "next/server";
import { ok } from "@/server/utils/envelope";
import { getUser } from "@/server/auth/getUser";

export async function GET(_: NextRequest) {
  const user = await getUser();
  const roles: string[] = (user as any)?.roles ?? (user as any)?.customClaims?.roles ?? [];
  return ok({ roles });
}
