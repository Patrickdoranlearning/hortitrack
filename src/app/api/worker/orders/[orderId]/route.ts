import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { logError } from "@/lib/log";

/**
 * GET /api/worker/orders/[orderId]
 * Get order details for workers (read-only view)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const { supabase, orgId } = await getUserAndOrg();

    // Fetch order with customer and address
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        id,
        org_id,
        order_number,
        status,
        requested_delivery_date,
        delivery_instructions,
        internal_notes,
        sub_total_ex_vat,
        discount_amount,
        vat_amount,
        total_inc_vat,
        created_at,
        updated_at,
        customers(
          id,
          name,
          account_number,
          phone,
          email
        ),
        customer_addresses!orders_ship_to_address_id_fkey(
          id,
          line1,
          line2,
          city,
          county,
          eircode,
          country
        )
      `)
      .eq("id", orderId)
      .eq("org_id", orgId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select(`
        id,
        description,
        quantity,
        unit_price_ex_vat,
        line_total_ex_vat,
        vat_rate,
        sku_id,
        product_id,
        product_group_id,
        required_batch_id,
        skus(
          code,
          plant_varieties(name),
          plant_sizes(name)
        ),
        products(name),
        product_groups(name)
      `)
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (itemsError) {
      logError("Error fetching order items", { error: itemsError.message, orderId });
    }

    // Fetch pick list status if exists
    const { data: pickList } = await supabase
      .from("pick_lists")
      .select("id, status, started_at, completed_at")
      .eq("order_id", orderId)
      .maybeSingle();

    // Transform response - Supabase returns related objects directly when using foreign key joins
    // Cast through unknown to handle Supabase's array type inference
    const customerData = order.customers as unknown as {
      id: string;
      name: string;
      account_number?: string;
      phone?: string;
      email?: string;
    } | null;

    const customer = customerData ? {
      id: customerData.id,
      name: customerData.name,
      account_number: customerData.account_number,
      phone: customerData.phone,
      email: customerData.email,
    } : null;

    const addressData = order.customer_addresses as unknown as {
      id: string;
      line1: string;
      line2?: string;
      city?: string;
      county?: string;
      eircode?: string;
      country?: string;
    } | null;

    const address = addressData ? {
      id: addressData.id,
      line1: addressData.line1,
      line2: addressData.line2,
      city: addressData.city,
      county: addressData.county,
      eircode: addressData.eircode,
      country: addressData.country,
    } : null;

    const orderLines = (items || []).map((item: Record<string, unknown>) => {
      const skuData = item.skus as {
        code?: string;
        plant_varieties?: { name?: string };
        plant_sizes?: { name?: string };
      } | null;
      const productData = item.products as { name?: string } | null;
      const productGroupData = item.product_groups as { name?: string } | null;

      return {
        id: item.id as string,
        description: item.description as string | null,
        quantity: item.quantity as number,
        unitPrice: item.unit_price_ex_vat as number | null,
        lineTotal: item.line_total_ex_vat as number | null,
        vatRate: item.vat_rate as number | null,
        skuCode: skuData?.code,
        varietyName: skuData?.plant_varieties?.name,
        sizeName: skuData?.plant_sizes?.name,
        productName: productData?.name,
        productGroupName: productGroupData?.name,
        isProductGroup: !!item.product_group_id,
      };
    });

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status,
        requestedDeliveryDate: order.requested_delivery_date,
        deliveryInstructions: order.delivery_instructions,
        internalNotes: order.internal_notes,
        subTotalExVat: order.sub_total_ex_vat,
        discountAmount: order.discount_amount,
        vatAmount: order.vat_amount,
        totalIncVat: order.total_inc_vat,
        createdAt: order.created_at,
        customer: customer
          ? {
              id: customer.id,
              name: customer.name,
              accountNumber: customer.account_number,
              phone: customer.phone,
              email: customer.email,
            }
          : null,
        deliveryAddress: address
          ? {
              line1: address.line1,
              line2: address.line2,
              city: address.city,
              county: address.county,
              eircode: address.eircode,
              country: address.country,
            }
          : null,
        lines: orderLines,
        pickList: pickList
          ? {
              id: pickList.id,
              status: pickList.status,
              startedAt: pickList.started_at,
              completedAt: pickList.completed_at,
            }
          : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch order";

    if (message === "Unauthenticated") {
      return NextResponse.json(
        { error: "Unauthenticated" },
        { status: 401 }
      );
    }

    logError("Error fetching worker order", { error: message });
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
