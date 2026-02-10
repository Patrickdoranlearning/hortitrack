// src/app/api/sales/price-lists/[id]/customers/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  listPriceListCustomers,
  assignCustomerToPriceList,
  removeCustomerFromPriceList,
} from "@/server/sales/price-lists.server";
import { logger } from "@/server/utils/logger";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const customers = await listPriceListCustomers(id);
    return NextResponse.json({ ok: true, customers });
  } catch (error) {
    logger.sales.error("GET /api/sales/price-lists/[id]/customers failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

const AssignCustomerInput = z.object({
  customerId: z.string().uuid(),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
});

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = AssignCustomerInput.parse(body);
    
    const assignment = await assignCustomerToPriceList(
      id,
      input.customerId,
      input.validFrom,
      input.validTo
    );
    
    return NextResponse.json({ ok: true, assignment }, { status: 201 });
  } catch (error) {
    logger.sales.error("POST /api/sales/price-lists/[id]/customers failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to assign customer" },
      { status: 400 }
    );
  }
}

const RemoveCustomerInput = z.object({
  assignmentId: z.string().uuid(),
});

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const input = RemoveCustomerInput.parse(body);
    
    await removeCustomerFromPriceList(input.assignmentId);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.sales.error("DELETE /api/sales/price-lists/[id]/customers failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to remove customer" },
      { status: 400 }
    );
  }
}

