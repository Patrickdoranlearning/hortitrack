export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderDocumentPdf } from "@/server/documents/render";
import { defaultLayoutFor } from "@/lib/documents/presets";
import { format } from "date-fns";

type RouteParams = {
  params: Promise<{ invoiceId: string }>;
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { invoiceId } = await params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's customer association
    const { data: customerUser } = await supabase
      .from("customer_users")
      .select("customer_id")
      .eq("user_id", user.id)
      .single();

    if (!customerUser) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Fetch invoice with order details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        status,
        issue_date,
        due_date,
        subtotal_ex_vat,
        vat_amount,
        total_inc_vat,
        notes,
        order_id,
        customer_id
      `
      )
      .eq("id", invoiceId)
      .eq("customer_id", customerUser.customer_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Fetch order with items if order_id exists
    let orderData: any = null;
    let orderItems: any[] = [];

    if (invoice.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select(
          `
          id,
          order_number,
          status,
          subtotal_ex_vat,
          vat_amount,
          total_inc_vat,
          requested_delivery_date,
          notes,
          created_at,
          customers (
            name,
            email
          ),
          customer_addresses (
            label,
            store_name,
            line1,
            line2,
            city,
            county,
            eircode,
            country_code
          )
        `
        )
        .eq("id", invoice.order_id)
        .single();

      if (order) {
        orderData = order;

        // Fetch order items
        const { data: items } = await supabase
          .from("order_items")
          .select(
            `
            id,
            description,
            quantity,
            unit_price_ex_vat,
            vat_rate,
            line_total_ex_vat,
            line_vat_amount,
            rrp
          `
          )
          .eq("order_id", invoice.order_id)
          .order("created_at");

        orderItems = items || [];
      }
    }

    // Get customer details
    const { data: customer } = await supabase
      .from("customers")
      .select("name, email")
      .eq("id", customerUser.customer_id)
      .single();

    // Determine document type based on invoice status
    // If invoice is draft, we generate an order confirmation instead
    const isOrderConfirmation = invoice.status === "draft" || !invoice.invoice_number;
    const documentType = isOrderConfirmation ? "order_confirmation" : "invoice";

    // Build document data
    const documentData = isOrderConfirmation
      ? buildOrderConfirmationData(orderData, orderItems, customer, invoice)
      : buildInvoiceData(invoice, orderData, orderItems, customer);

    // Get layout for document type
    const layout = defaultLayoutFor(documentType);

    // Generate PDF
    const pdf = await renderDocumentPdf(layout, documentData, { documentType });

    // Set filename
    const filename = isOrderConfirmation
      ? `order-confirmation-${orderData?.order_number || invoice.id}.pdf`
      : `invoice-${invoice.invoice_number || invoice.id}.pdf`;

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("[b2b/invoices] PDF generation failed:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

function buildOrderConfirmationData(
  order: any,
  items: any[],
  customer: any,
  invoice: any
) {
  const address = order?.customer_addresses;
  const addressParts = [
    address?.line1,
    address?.line2,
    address?.city,
    address?.county,
    address?.eircode,
  ].filter(Boolean);

  return {
    title: "Order Confirmation",
    subtitle: "Thank you for your order",
    order: {
      number: order?.order_number || `ORD-${invoice.id.slice(0, 8)}`,
      date: order?.created_at
        ? format(new Date(order.created_at), "dd/MM/yyyy")
        : format(new Date(), "dd/MM/yyyy"),
      requestedDate: order?.requested_delivery_date
        ? format(new Date(order.requested_delivery_date), "dd/MM/yyyy")
        : "TBC",
    },
    customer: {
      name: customer?.name || order?.customers?.name || "Customer",
      email: customer?.email || order?.customers?.email || "",
      address: addressParts.join(", "),
    },
    lines: items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price_ex_vat,
      total: item.line_total_ex_vat,
      rrp: item.rrp,
    })),
    totals: {
      subtotal: invoice.subtotal_ex_vat || order?.subtotal_ex_vat || 0,
      tax: invoice.vat_amount || order?.vat_amount || 0,
      grandTotal: invoice.total_inc_vat || order?.total_inc_vat || 0,
    },
    notes: order?.notes || invoice.notes || "",
  };
}

function buildInvoiceData(
  invoice: any,
  order: any,
  items: any[],
  customer: any
) {
  const address = order?.customer_addresses;
  const addressParts = [
    address?.line1,
    address?.line2,
    address?.city,
    address?.county,
    address?.eircode,
  ].filter(Boolean);

  return {
    title: "Invoice",
    subtitle: `Invoice #${invoice.invoice_number}`,
    invoice: {
      number: invoice.invoice_number,
      date: invoice.issue_date
        ? format(new Date(invoice.issue_date), "dd/MM/yyyy")
        : format(new Date(), "dd/MM/yyyy"),
      dueDate: invoice.due_date
        ? format(new Date(invoice.due_date), "dd/MM/yyyy")
        : "",
    },
    customer: {
      name: customer?.name || order?.customers?.name || "Customer",
      email: customer?.email || order?.customers?.email || "",
      address: addressParts.join(", "),
    },
    lines: items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price_ex_vat,
      total: item.line_total_ex_vat,
    })),
    totals: {
      subtotal: invoice.subtotal_ex_vat,
      tax: invoice.vat_amount,
      grandTotal: invoice.total_inc_vat,
    },
    notes: invoice.notes || "",
  };
}
