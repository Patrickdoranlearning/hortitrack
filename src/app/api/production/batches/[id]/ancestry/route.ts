import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getBatchById } from "@/server/batches/service";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase, orgId } = await getUserAndOrg();

    const [{ data: parents, error: pErr }, { data: children, error: cErr }] =
      await Promise.all([
        supabase
          .from("batch_ancestry")
          .select("parent_batch_id, proportion")
          .eq("org_id", orgId)
          .eq("child_batch_id", params.id),
        supabase
          .from("batch_ancestry")
          .select("child_batch_id, proportion")
          .eq("org_id", orgId)
          .eq("parent_batch_id", params.id),
      ]);

    if (pErr) throw pErr;
    if (cErr) throw cErr;

    const parentIds = (parents ?? [])
      .map((r) => r.parent_batch_id)
      .filter(Boolean);
    const childIds = (children ?? [])
      .map((r) => r.child_batch_id)
      .filter(Boolean);

    const [current, parentNodes, childNodes] = await Promise.all([
      getBatchById(params.id),
      Promise.all(parentIds.map((id) => getBatchById(id))),
      Promise.all(childIds.map((id) => getBatchById(id))),
    ]);

    return NextResponse.json({
      current,
      parents: parentNodes.filter(Boolean),
      children: childNodes.filter(Boolean),
    });
  } catch (e: any) {
    const status = /Unauthenticated/i.test(e?.message) ? 401 : 500;
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status });
  }
}
