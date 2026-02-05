/**
 * Template Presets
 *
 * Pre-defined layouts for different document types and styles.
 * Users can select these when creating a new template.
 */

import type { DocumentComponent, DocumentType } from "@/lib/documents/types";

export type TemplatePreset = {
  id: string;
  name: string;
  description: string;
  documentTypes: DocumentType[]; // Which document types this preset applies to
  thumbnail?: string; // Future: preview image
  getLayout: (documentType: DocumentType) => DocumentComponent[];
};

// Classic Invoice - Traditional business invoice style
const classicInvoiceLayout: DocumentComponent[] = [
  {
    id: "header-title",
    type: "heading",
    zone: "header",
    text: "INVOICE",
    level: 1,
    style: { fontSize: 28, bold: true, align: "right" },
  },
  {
    id: "header-company",
    type: "text",
    zone: "header",
    text: "{{company.name}}",
    style: { align: "right", color: "#475569" },
  },
  { id: "header-divider", type: "divider", zone: "header" },
  {
    id: "customer-box",
    type: "box",
    zone: "body",
    label: "Bill To",
    children: [
      { id: "cust-label", type: "text", text: "Bill To:", style: { bold: true, fontSize: 10, color: "#64748b" } },
      { id: "cust-name", type: "text", text: "{{customer.name}}", style: { bold: true } },
      { id: "cust-addr", type: "text", text: "{{customer.address}}" },
      { id: "cust-email", type: "text", text: "{{customer.email}}" },
    ],
  },
  {
    id: "invoice-meta",
    type: "list",
    zone: "body",
    items: [
      { label: "Invoice Number", binding: "invoice.number" },
      { label: "Invoice Date", binding: "invoice.date" },
      { label: "Due Date", binding: "invoice.dueDate" },
      { label: "Payment Terms", binding: "invoice.paymentTerms" },
    ],
  },
  { id: "spacer-1", type: "spacer", zone: "body", size: 10 },
  {
    id: "lines-table",
    type: "table",
    zone: "body",
    rowsBinding: "lines",
    showHeader: true,
    columns: [
      { key: "desc", label: "Description", binding: "description", width: 50 },
      { key: "qty", label: "Qty", binding: "quantity", align: "right", format: "number" },
      { key: "unit", label: "Unit Price", binding: "unitPrice", align: "right", format: "currency" },
      { key: "total", label: "Amount", binding: "total", align: "right", format: "currency" },
    ],
  },
  { id: "spacer-2", type: "spacer", zone: "body", size: 10 },
  {
    id: "totals",
    type: "list",
    zone: "body",
    items: [
      { label: "Subtotal", binding: "totals.subtotal" },
      { label: "VAT ({{totals.vatRate}}%)", binding: "totals.tax" },
      { label: "Total Due", binding: "totals.grandTotal" },
    ],
    style: { align: "right" },
  },
  {
    id: "footer-notes",
    type: "text",
    zone: "footer",
    text: "{{notes}}",
    style: { fontSize: 9, color: "#64748b" },
  },
  {
    id: "footer-terms",
    type: "text",
    zone: "footer",
    text: "Payment is due within the specified payment terms. Thank you for your business.",
    style: { fontSize: 8, color: "#94a3b8" },
  },
];

// Simple Docket - Clean delivery docket
const simpleDocketLayout: DocumentComponent[] = [
  {
    id: "header-title",
    type: "heading",
    zone: "header",
    text: "DELIVERY DOCKET",
    level: 1,
    style: { fontSize: 24, bold: true },
  },
  {
    id: "header-number",
    type: "text",
    zone: "header",
    text: "#{{docket.number}}",
    style: { fontSize: 14, color: "#64748b" },
  },
  { id: "header-divider", type: "divider", zone: "header" },
  {
    id: "delivery-box",
    type: "box",
    zone: "body",
    label: "Delivery",
    children: [
      { id: "del-label", type: "text", text: "Deliver To:", style: { bold: true, fontSize: 10, color: "#64748b" } },
      { id: "del-contact", type: "text", text: "{{delivery.contact}}", style: { bold: true } },
      { id: "del-address", type: "text", text: "{{delivery.address}}" },
      { id: "del-phone", type: "text", text: "{{delivery.phone}}" },
    ],
  },
  {
    id: "docket-meta",
    type: "list",
    zone: "body",
    items: [
      { label: "Delivery Date", binding: "docket.date" },
      { label: "Order Reference", binding: "order.number" },
    ],
  },
  { id: "spacer-1", type: "spacer", zone: "body", size: 10 },
  {
    id: "lines-table",
    type: "table",
    zone: "body",
    rowsBinding: "lines",
    showHeader: true,
    columns: [
      { key: "desc", label: "Item", binding: "description", width: 60 },
      { key: "qty", label: "Quantity", binding: "quantity", align: "right", format: "number" },
      { key: "loc", label: "Location", binding: "location" },
    ],
  },
  { id: "spacer-2", type: "spacer", zone: "body", size: 10 },
  {
    id: "notes-section",
    type: "text",
    zone: "body",
    text: "Notes: {{notes}}",
    style: { color: "#475569" },
  },
  {
    id: "signature-line",
    type: "text",
    zone: "footer",
    text: "Received by: ________________________________  Date: _______________",
    style: { fontSize: 10 },
  },
];

// Minimal preset - Just the essentials
const minimalLayout = (documentType: DocumentType): DocumentComponent[] => {
  const base: DocumentComponent[] = [
    {
      id: "heading",
      type: "heading",
      zone: "header",
      text: "{{title}}",
      level: 2,
      style: { fontSize: 20, bold: true },
    },
    { id: "divider", type: "divider", zone: "header" },
  ];

  switch (documentType) {
    case "invoice":
      return [
        ...base,
        {
          id: "lines",
          type: "table",
          zone: "body",
          rowsBinding: "lines",
          showHeader: true,
          columns: [
            { key: "desc", label: "Description", binding: "description" },
            { key: "qty", label: "Qty", binding: "quantity", align: "right" },
            { key: "total", label: "Total", binding: "total", align: "right", format: "currency" },
          ],
        },
        {
          id: "total",
          type: "text",
          zone: "body",
          text: "Total: {{totals.grandTotal}}",
          style: { bold: true, align: "right" },
        },
      ];
    case "delivery_docket":
      return [
        ...base,
        {
          id: "lines",
          type: "table",
          zone: "body",
          rowsBinding: "lines",
          showHeader: true,
          columns: [
            { key: "desc", label: "Item", binding: "description" },
            { key: "qty", label: "Qty", binding: "quantity", align: "right" },
          ],
        },
      ];
    case "order_confirmation":
      return [
        ...base,
        {
          id: "order-info",
          type: "list",
          zone: "body",
          items: [
            { label: "Order", binding: "order.number" },
            { label: "Date", binding: "order.date" },
          ],
        },
        {
          id: "lines",
          type: "table",
          zone: "body",
          rowsBinding: "lines",
          showHeader: true,
          columns: [
            { key: "desc", label: "Item", binding: "description" },
            { key: "qty", label: "Qty", binding: "quantity", align: "right" },
          ],
        },
      ];
    case "av_list":
    case "lookin_good":
    default:
      return [
        ...base,
        {
          id: "items",
          type: "table",
          zone: "body",
          rowsBinding: "items",
          showHeader: true,
          columns: [
            { key: "name", label: "Name", binding: "name" },
            { key: "qty", label: "Available", binding: "qty", align: "right" },
          ],
        },
      ];
  }
};

// Modern preset - Contemporary clean design
const modernLayout = (documentType: DocumentType): DocumentComponent[] => {
  const base: DocumentComponent[] = [
    {
      id: "header-box",
      type: "box",
      zone: "header",
      style: { background: "#f8fafc", padding: 15 },
      children: [
        {
          id: "title",
          type: "heading",
          text: "{{title}}",
          level: 1,
          style: { fontSize: 26, bold: true, color: "#0f172a" },
        },
        {
          id: "subtitle",
          type: "text",
          text: "{{subtitle}}",
          style: { color: "#64748b", fontSize: 12 },
        },
      ],
    },
    { id: "spacer-header", type: "spacer", zone: "body", size: 15 },
  ];

  switch (documentType) {
    case "invoice":
      return [
        ...base,
        {
          id: "two-col-top",
          type: "box",
          zone: "body",
          children: [
            {
              id: "customer",
              type: "box",
              label: "Customer",
              children: [
                { id: "cust-name", type: "text", text: "{{customer.name}}", style: { bold: true, fontSize: 14 } },
                { id: "cust-addr", type: "text", text: "{{customer.address}}", style: { color: "#475569" } },
              ],
            },
          ],
        },
        {
          id: "invoice-chips",
          type: "chips",
          zone: "body",
          items: [
            { label: "INV #{{invoice.number}}", color: "#dbeafe" },
            { label: "{{invoice.date}}", color: "#f1f5f9" },
            { label: "Due: {{invoice.dueDate}}", color: "#fef3c7" },
          ],
        },
        { id: "spacer-1", type: "spacer", zone: "body", size: 15 },
        {
          id: "lines",
          type: "table",
          zone: "body",
          rowsBinding: "lines",
          showHeader: true,
          columns: [
            { key: "desc", label: "Description", binding: "description", width: 50 },
            { key: "qty", label: "Qty", binding: "quantity", align: "center" },
            { key: "unit", label: "Price", binding: "unitPrice", align: "right", format: "currency" },
            { key: "total", label: "Total", binding: "total", align: "right", format: "currency" },
          ],
        },
        { id: "spacer-2", type: "spacer", zone: "body", size: 10 },
        {
          id: "totals-box",
          type: "box",
          zone: "body",
          style: { background: "#f8fafc", padding: 10 },
          children: [
            { id: "subtotal", type: "text", text: "Subtotal: {{totals.subtotal}}", style: { align: "right" } },
            { id: "tax", type: "text", text: "VAT: {{totals.tax}}", style: { align: "right" } },
            { id: "total", type: "text", text: "Total: {{totals.grandTotal}}", style: { align: "right", bold: true, fontSize: 16 } },
          ],
        },
      ];
    default:
      return minimalLayout(documentType);
  }
};

// Export all presets
export const TEMPLATE_PRESETS: TemplatePreset[] = [
  {
    id: "classic-invoice",
    name: "Classic Invoice",
    description: "Traditional business invoice with detailed line items and totals",
    documentTypes: ["invoice"],
    getLayout: () => classicInvoiceLayout,
  },
  {
    id: "simple-docket",
    name: "Simple Docket",
    description: "Clean delivery docket with signature line",
    documentTypes: ["delivery_docket"],
    getLayout: () => simpleDocketLayout,
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean, simple layout with just the essentials",
    documentTypes: ["invoice", "delivery_docket", "order_confirmation", "av_list", "lookin_good"],
    getLayout: minimalLayout,
  },
  {
    id: "modern",
    name: "Modern",
    description: "Contemporary design with visual flair",
    documentTypes: ["invoice", "delivery_docket", "order_confirmation"],
    getLayout: modernLayout,
  },
];

/**
 * Get presets available for a specific document type
 */
export function getPresetsForType(documentType: DocumentType): TemplatePreset[] {
  return TEMPLATE_PRESETS.filter((preset) => preset.documentTypes.includes(documentType));
}

/**
 * Get a preset by ID
 */
export function getPresetById(id: string): TemplatePreset | undefined {
  return TEMPLATE_PRESETS.find((preset) => preset.id === id);
}
