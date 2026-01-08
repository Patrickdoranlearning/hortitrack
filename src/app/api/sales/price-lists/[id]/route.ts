// src/app/api/sales/price-lists/[id]/route.ts
import { NextResponse } from "next/server";
import {
  getPriceListById,
  updatePriceList,
  deletePriceList,
  UpdatePriceListInput,
} from "@/server/sales/price-lists.server";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const priceList = await getPriceListById(id);
    
    if (!priceList) {
      return NextResponse.json(
        { ok: false, error: "Price list not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ ok: true, priceList });
  } catch (error) {
    console.error("[api:sales/price-lists/[id]][GET]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to fetch price list" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const input = UpdatePriceListInput.parse(body);
    const priceList = await updatePriceList(id, input);
    return NextResponse.json({ ok: true, priceList });
  } catch (error) {
    console.error("[api:sales/price-lists/[id]][PATCH]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to update price list" },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deletePriceList(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api:sales/price-lists/[id]][DELETE]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to delete price list" },
      { status: 400 }
    );
  }
}

