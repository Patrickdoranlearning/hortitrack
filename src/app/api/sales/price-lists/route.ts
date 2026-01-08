// src/app/api/sales/price-lists/route.ts
import { NextResponse } from "next/server";
import {
  listPriceLists,
  createPriceList,
  CreatePriceListInput,
} from "@/server/sales/price-lists.server";

export async function GET() {
  try {
    const priceLists = await listPriceLists();
    return NextResponse.json({ ok: true, priceLists });
  } catch (error) {
    console.error("[api:sales/price-lists][GET]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to fetch price lists" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = CreatePriceListInput.parse(body);
    const priceList = await createPriceList(input);
    return NextResponse.json({ ok: true, priceList }, { status: 201 });
  } catch (error) {
    console.error("[api:sales/price-lists][POST]", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to create price list" },
      { status: 400 }
    );
  }
}

