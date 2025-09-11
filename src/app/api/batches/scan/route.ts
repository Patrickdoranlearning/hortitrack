
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/server/db/admin";
import { declassify } from "@/server/utils/declassify";
import { parseScanCode, candidateBatchNumbers } from '@/lib/scan/parse';
import { checkRateLimit, requestKey } from "@/server/security/rateLimit";
import { getUserFromRequest } from "@/server/security/auth";
import { z } from 'zod';

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

    let batch = null;
    if (parsed.by === 'id') {
      const doc = await adminDb.collection('batches').doc(parsed.value).get();
      if (doc.exists) {
        batch = { id: doc.id, ...doc.data() };
      }
    } else { // parsed.by === 'batchNumber'
      const candidates = candidateBatchNumbers(parsed.value);
      for (const cand of candidates) {
        // Try to find by string batchNumber
        let snapshot = await adminDb.collection('batches').where('batchNumber', '==', cand).limit(1).get();
        if (!snapshot.empty) {
          batch = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
          break;
        }

        // If batchNumber is stored as a number, try that too
        const numCand = Number(cand);
        if (!isNaN(numCand)) {
            snapshot = await adminDb.collection('batches').where('batchNumber', '==', numCand).limit(1).get();
            if (!snapshot.empty) {
                batch = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
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

    const clean = declassify({ id: (batch as any).id, ...(batch as any) });
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
