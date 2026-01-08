import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getBatchById } from "@/server/batches/service";

function formatBatchNode(node: NonNullable<Awaited<ReturnType<typeof getBatchById>>>, proportion?: number | null) {
  return {
    id: node.id,
    batchNumber: node.batchNumber ?? node.id,
    plantVariety: node.plantVariety,
    plantFamily: node.plantFamily,
    size: node.size,
    status: node.status,
    quantity: node.quantity,
    initialQuantity: node.initialQuantity,
    proportion: proportion ?? 1,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    let supabase, orgId;
    try {
      const auth = await getUserAndOrg();
      supabase = auth.supabase;
      orgId = auth.orgId;
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Authentication failed";
      return NextResponse.json({ error: message }, { status: 401 });
    }

    // First try batch_ancestry table for explicit relationships
    const [{ data: ancestryParents }, { data: ancestryChildren }] =
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

    const current = await getBatchById(id);

    // Build parent nodes from batch_ancestry
    const parentNodes: ReturnType<typeof formatBatchNode>[] = [];
    for (const record of ancestryParents ?? []) {
      const node = await getBatchById(record.parent_batch_id);
      if (node) {
        parentNodes.push(formatBatchNode(node, record.proportion));
      }
    }

    // If no ancestry parents, check for parent_batch_id on the batch itself
    if (parentNodes.length === 0 && current?.parentBatchId) {
      const parentNode = await getBatchById(current.parentBatchId);
      if (parentNode) {
        parentNodes.push(formatBatchNode(parentNode, 1));
      }
    }

    // Build child nodes from batch_ancestry
    const childNodes: ReturnType<typeof formatBatchNode>[] = [];
    for (const record of ancestryChildren ?? []) {
      const node = await getBatchById(record.child_batch_id);
      if (node) {
        childNodes.push(formatBatchNode(node, record.proportion));
      }
    }

    // If no ancestry children, check for batches with this as parent_batch_id
    if (childNodes.length === 0) {
      const { data: directChildren } = await supabase
        .from("batches")
        .select("id")
        .eq("org_id", orgId)
        .eq("parent_batch_id", id)
        .limit(20);

      if (directChildren?.length) {
        for (const c of directChildren) {
          const node = await getBatchById(c.id);
          if (node) {
            childNodes.push(formatBatchNode(node, 1));
          }
        }
      }
    }

    return NextResponse.json({
      current: current ? formatBatchNode(current) : null,
      parents: parentNodes,
      children: childNodes,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    const status = /Unauthenticated/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
