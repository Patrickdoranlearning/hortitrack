
export const runtime = "nodejs";

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { parseScanCode, candidateBatchNumbers } from '@/lib/scan/parse';
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { getUserFromRequest } from "@/server/security/auth";
import { z } from 'zod';
import { getBatchById, BatchNode } from "@/server/batches/service";

const Body = z.object({ code: z.string().min(1) });

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const key = requestKey(req as any, user.uid);
    const rl = await checkRateLimit({ key: `scan:${key}`, windowMs: 60_000, max: 30 });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests", resetMs: rl.resetMs }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { code } = Body.parse(body);
    const started = Date.now();

    const parsed = parseScanCode(code);
    if (!parsed) {
      return NextResponse.json({ error: 'Unsupported code format' }, { status: 422 });
    }

    const supabase = await createClient();
    let batch: BatchNode | null = null;

    if (parsed.by === 'id') {
      batch = await getBatchById(parsed.value);
    } else { // parsed.by === 'batchNumber'
      const candidates = candidateBatchNumbers(parsed.value);
      for (const cand of candidates) {
        // Try to find by string batchNumber
        let { data } = await supabase
          .from('batches')
          .select("id")
          .eq("batch_number", cand)
          .limit(1)
          .maybeSingle();
        if (data) {
          batch = await getBatchById(data.id);
          break;
        }

        // If batchNumber is stored as a number, try that too
        const numCand = Number(cand);
        if (!isNaN(numCand)) {
          let { data: dataNum } = await supabase
            .from('batches')
            .select("id")
            .eq("batch_number", numCand)
            .limit(1)
            .maybeSingle();
          if (dataNum) {
            batch = await getBatchById(dataNum.id);
            break;
          }
        }
      }
    }

    if (!batch) {
      return NextResponse.json(
        {
          error: 'Batch not found',
          summary: {
            by: parsed.by,
            value: parsed.value,
            rawLen: code.length,
            ms: Date.now() - started,
          },
        },
        { status: 404 }
      );
    }

    // Map to clean structure (already camelCase from service)
    const clean = batch;

    const summary = {
      id: clean.id,
      batchNumber: clean.batchNumber,
      variety: clean.plantVariety,
      family: clean.plantFamily,
      size: clean.size,
      location: clean.location,
      status: clean.status,
    };
    return NextResponse.json({ batch: clean, summary }, { status: 200 });
  } catch (e: any) {
    console.error("POST /api/batches/scan error:", e);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
