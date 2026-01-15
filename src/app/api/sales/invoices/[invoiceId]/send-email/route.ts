export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getUserAndOrg } from "@/server/auth/org";
import { getSupabaseServerApp } from "@/server/db/supabase";
import { renderDocumentPdf } from "@/server/documents/render";
import { defaultLayoutFor } from "@/lib/documents/presets";
import { sendEmail } from "@/server/email/send";
import { format } from "date-fns";

type RouteParams = {
  params: Promise<{ invoiceId: string }>;
};

/**
 * POST /api/sales/invoices/[invoiceId]/send-email
 * Sends invoice PDF to customer via email
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { invoiceId } = await params;
    const { user, orgId } = await getUserAndOrg();
    const supabase = await getSupabaseServerApp();

    // Fetch invoice with customer details
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
        customer_id,
        org_id
      `
      )
      .eq("id", invoiceId)
      .eq("org_id", orgId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Fetch customer details
    const { data: customer } = await supabase
      .from("customers")
      .select("id, name, email")
      .eq("id", invoice.customer_id)
      .single();

    if (!customer?.email) {
      return NextResponse.json(
        { error: "Customer email not found. Please add an email address for this customer." },
        { status: 400 }
      );
    }

    // Fetch order items if order_id exists
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

    // Get organization details for the email
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    const companyName = org?.name || "Company";

    // Build invoice data for PDF generation
    const address = orderData?.customer_addresses;
    const addressParts = [
      address?.line1,
      address?.line2,
      address?.city,
      address?.county,
      address?.eircode,
    ].filter(Boolean);

    const invoiceData = {
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
        name: customer.name || "Customer",
        email: customer.email,
        address: addressParts.join(", "),
      },
      lines: orderItems.map((item) => ({
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

    // Generate PDF
    const layout = defaultLayoutFor("invoice");
    const pdfBuffer = await renderDocumentPdf(layout, invoiceData, { documentType: "invoice" });

    // Build email HTML
    const issueDate = invoice.issue_date
      ? format(new Date(invoice.issue_date), "PPP")
      : "N/A";
    const dueDate = invoice.due_date
      ? format(new Date(invoice.due_date), "PPP")
      : "N/A";

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 20px; }
            .details { background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0; }
            .details-row { display: flex; justify-content: space-between; padding: 8px 0; }
            .label { color: #6b7280; }
            .value { font-weight: 600; }
            .total { font-size: 1.25rem; color: #059669; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 12px; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 0.875rem; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; color: #111827;">Invoice ${invoice.invoice_number}</h1>
              <p style="color: #6b7280; margin: 8px 0 0 0;">From ${companyName}</p>
            </div>

            <p>Dear ${customer.name},</p>
            <p>Please find attached your invoice for your recent order.</p>

            <div class="details">
              <div class="details-row">
                <span class="label">Invoice Number:</span>
                <span class="value">${invoice.invoice_number}</span>
              </div>
              <div class="details-row">
                <span class="label">Issue Date:</span>
                <span class="value">${issueDate}</span>
              </div>
              <div class="details-row">
                <span class="label">Due Date:</span>
                <span class="value">${dueDate}</span>
              </div>
              <div class="details-row total">
                <span class="label">Total Amount:</span>
                <span class="value">€${invoice.total_inc_vat.toFixed(2)}</span>
              </div>
            </div>

            <p>If you have any questions about this invoice, please don't hesitate to contact us.</p>

            <p>Thank you for your business.</p>

            <p>Kind regards,<br>${companyName}</p>

            <div class="footer">
              <p>This email was sent from ${companyName}. The invoice PDF is attached to this email.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email with PDF attachment
    const result = await sendEmail({
      to: customer.email,
      subject: `Invoice ${invoice.invoice_number} from ${companyName}`,
      html: emailHtml,
      attachments: [
        {
          filename: `invoice-${invoice.invoice_number}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Invoice sent to ${customer.email}`,
      messageId: result.messageId,
    });
  } catch (err: any) {
    console.error("[sales/invoices] send-email failed:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to send invoice email" },
      { status: 500 }
    );
  }
}
