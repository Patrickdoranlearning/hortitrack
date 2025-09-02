// src/app/api/production/transplants/route.ts
import { NextRequest, NextResponse } from "next/server";
import { TransplantRequestSchema, TransplantResponseSchema } from "@/lib/validators/transplant";
import { performTransplant } from "@/server/production/transplantService";

export async function POST(req: NextRequest) {
  try {
    // Quick validation for clear 400s
    const body = await req.json();
    TransplantRequestSchema.parse(body);

    // Execute service
    const result = await performTransplant(new NextRequest(req.url, { method: "POST", body: JSON.stringify(body), headers: req.headers }));
    const parsed = TransplantResponseSchema.parse(result);

    return NextResponse.json(parsed, { status: 201 });
  } catch (err: any) {
    const code = err?.name === "ZodError" ? 400 : 500;
    return NextResponse.json({ error: err?.message ?? "Transplant failed" }, { status: code });
  }
}
