import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getBatchById, type BatchNode } from "@/server/batches/service";

type NodeWithProportion = BatchNode & { proportion?: number | null };

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, orgId } = await getUserAndOrg();

    const [{ data: parents, error: pErr }, { data: children, error: cErr }] =
      await Promise.all([
        supabase
          .from("batch_ancestry")
          .select("parent_batch_id, proportion")
          .eq("org_id", orgId)
          .eq("child_batch_id", id),
        supabase
          .from("batch_ancestry")
          .select("child_batch_id, proportion")
          .eq("org_id", orgId)
          .eq("parent_batch_id", id),
      ]);

    if (pErr) throw pErr;
    if (cErr) throw cErr;

    const parentIds = (parents ?? [])
      .map((r) => r.parent_batch_id)
      .filter(Boolean);
    const childIds = (children ?? [])
      .map((r) => r.child_batch_id)
      .filter(Boolean);

    const current = await getBatchById(id);
    const parentNodes = (await Promise.all(
      (parents ?? []).map(async (record) => {
        const node = await getBatchById(record.parent_batch_id);
        if (!node) return null;
        return {
          id: node.id,
          batch_number: node.batchNumber ?? node.id,
          proportion: record.proportion ?? 1,
        };
      })
    )).filter(Boolean);
    const childNodes = (await Promise.all(
      (children ?? []).map(async (record) => {
        const node = await getBatchById(record.child_batch_id);
        if (!node) return null;
        return {
          id: node.id,
          batch_number: node.batchNumber ?? node.id,
          proportion: record.proportion ?? 1,
        };
      })
    )).filter(Boolean);

    return NextResponse.json({
      current: current ? { ...current, batch_number: current.batchNumber } : null,
      parents: parentNodes,
      children: childNodes,
    });
  } catch (e: any) {
    const status = /Unauthenticated/i.test(e?.message) ? 401 : 500;
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status });
  }
}
