// src/app/api/production/transplants/route.ts
import { NextResponse } from "next/server";
import { TransplantRequestSchema, TransplantResponseSchema } from "@/lib/validators/transplant";
import { performTransplant } from "@/server/production/transplantService";

export async function POST(req: Request) {
  try {
    // Quick validation for clear 400s
    const body = await req.json();
    TransplantRequestSchema.parse(body);

    // Execute service with already-validated body
    const result = await performTransplant(body);
    const parsed = TransplantResponseSchema.parse(result);

    return NextResponse.json(parsed, { status: 201 });
  } catch (err: any) {
    const code = err?.name === "ZodError" ? 400 : 500;
    return NextResponse.json({ error: err?.message ?? "Transplant failed" }, { status: code });
  }
}
