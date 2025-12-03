/**
 * @deprecated This API route is maintained for backwards compatibility.
 * Use the `transplantBatchAction` server action instead for better type safety
 * and transactional integrity.
 */

import { NextRequest, NextResponse } from "next/server";
import { TransplantInputSchema } from "@/lib/domain/batch";
import { getUserAndOrg } from "@/server/auth/org";

export async function POST(req: NextRequest) {
  try {
    const input = TransplantInputSchema.parse(await req.json());
    const { supabase, orgId, user } = await getUserAndOrg();

    // Use the transactional RPC function - this ensures atomic operations
    const { data, error } = await supabase.rpc("perform_transplant", {
      p_org_id: orgId,
      p_parent_batch_id: input.parent_batch_id,
      p_size_id: input.size_id,
      p_location_id: input.location_id,
      p_containers: input.containers,
      p_user_id: user.id,
      p_planted_at: input.planted_at ?? null,
      p_notes: input.notes ?? null,
      p_archive_parent_if_empty: input.archive_parent_if_empty ?? true,
    });

    if (error) {
      console.error("[batches/transplant] RPC error:", error);
      
      // Map error types to HTTP status codes
      const status = 
        /Insufficient quantity/i.test(error.message) ? 409 :
        /not found/i.test(error.message) ? 404 :
        /Invalid/i.test(error.message) ? 400 : 500;
      
      return NextResponse.json(
        { error: error.message, requestId: null }, 
        { status }
      );
    }

    // The RPC returns the result directly
    const result = data as {
      request_id: string;
      child_batch: {
        id: string;
        batch_number: string;
        quantity: number;
        phase: string;
      };
      parent_new_quantity: number;
    };

    return NextResponse.json({
      requestId: result.request_id,
      child_batch: result.child_batch,
      parent_new_quantity: result.parent_new_quantity,
    }, { status: 201 });

  } catch (e: unknown) {
    console.error("[batches/transplant] Error:", e);
    
    const message = e instanceof Error ? e.message : "Server error";
    const status =
      /Unauthenticated/i.test(message) ? 401 :
      /parse|invalid|ZodError/i.test(message) ? 400 : 500;
    
    return NextResponse.json(
      { error: message, requestId: null }, 
      { status }
    );
  }
}
