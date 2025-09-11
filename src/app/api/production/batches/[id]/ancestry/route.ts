import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { supabase, orgId } = await getUserAndOrg();

    const parentQ = supabase
      .from("batch_ancestry")
      .select("parent_batch_id, proportion, parent:parent_batch_id (id, batch_number)")
      .eq("org_id", orgId)
      .eq("child_batch_id", params.id);

    const childQ = supabase
      .from("batch_ancestry")
      .select("child_batch_id, proportion, child:child_batch_id (id, batch_number)")
      .eq("org_id", orgId)
      .eq("parent_batch_id", params.id);

    const [{ data: parents, error: pErr }, { data: children, error: cErr }] =
      await Promise.all([parentQ, childQ]);

    if (pErr) throw pErr;
    if (cErr) throw cErr;

    return NextResponse.json({
      parents: (parents ?? []).map(r => ({
        id: r.parent?.id, batch_number: r.parent?.batch_number, proportion: r.proportion,
      })),
      children: (children ?? []).map(r => ({
        id: r.child?.id, batch_number: r.child?.batch_number, proportion: r.proportion,
      })),
    });
  } catch (e: any) {
    const status = /Unauthenticated/i.test(e?.message) ? 401 : 500;
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status });
  }
}
