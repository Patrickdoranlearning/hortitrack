import type { DocumentComponent, DocumentType } from "./types";

export type DocumentField = { path: string; label: string; example?: string };

export const DOCUMENT_FIELDS: Record<DocumentType, DocumentField[]> = {
  invoice: [
    { path: "invoice.number", label: "Invoice Number" },
    { path: "invoice.date", label: "Invoice Date" },
    { path: "customer.name", label: "Customer Name" },
    { path: "customer.email", label: "Customer Email" },
    { path: "customer.address", label: "Customer Address" },
    { path: "lines[].description", label: "Line Description" },
    { path: "lines[].quantity", label: "Line Quantity" },
    { path: "lines[].unitPrice", label: "Unit Price" },
    { path: "lines[].total", label: "Line Total" },
    { path: "totals.subtotal", label: "Subtotal" },
    { path: "totals.tax", label: "Tax" },
    { path: "totals.grandTotal", label: "Grand Total" },
  ],
  delivery_docket: [
    { path: "docket.number", label: "Docket Number" },
    { path: "docket.date", label: "Delivery Date" },
    { path: "delivery.address", label: "Delivery Address" },
    { path: "delivery.contact", label: "Delivery Contact" },
    { path: "lines[].description", label: "Line Description" },
    { path: "lines[].quantity", label: "Quantity" },
    { path: "lines[].location", label: "Location" },
    { path: "notes", label: "Notes" },
  ],
  order_confirmation: [
    { path: "order.number", label: "Order Number" },
    { path: "order.date", label: "Order Date" },
    { path: "customer.name", label: "Customer Name" },
    { path: "customer.email", label: "Customer Email" },
    { path: "lines[].description", label: "Line Description" },
    { path: "lines[].quantity", label: "Quantity" },
    { path: "lines[].unitPrice", label: "Unit Price" },
    { path: "totals.grandTotal", label: "Grand Total" },
  ],
  av_list: [
    { path: "title", label: "List Title" },
    { path: "generatedAt", label: "Generated Date" },
    { path: "items[].name", label: "Item Name" },
    { path: "items[].size", label: "Size" },
    { path: "items[].grade", label: "Grade" },
    { path: "items[].qty", label: "Available Quantity" },
    { path: "items[].price", label: "Price" },
  ],
  lookin_good: [
    { path: "title", label: "List Title" },
    { path: "generatedAt", label: "Generated Date" },
    { path: "items[].name", label: "Item Name" },
    { path: "items[].description", label: "Description" },
    { path: "items[].photo", label: "Photo URL" },
  ],
};

export function defaultLayoutFor(documentType: DocumentType): DocumentComponent[] {
  const baseHeader: DocumentComponent[] = [
    { id: "heading", type: "heading", text: "{{title}}", level: 2, style: { fontSize: 22, bold: true } },
    { id: "subtitle", type: "text", text: "{{subtitle}}", style: { color: "#475569" } },
    { id: "divider", type: "divider" },
  ];

  switch (documentType) {
    case "invoice":
      return [
        ...baseHeader,
        { id: "customer", type: "box", label: "Customer", children: [
          { id: "cust-name", type: "text", text: "Customer: {{customer.name}}", style: { bold: true } },
          { id: "cust-addr", type: "text", text: "{{customer.address}}" },
          { id: "cust-email", type: "text", text: "Email: {{customer.email}}" },
        ]},
        { id: "invoice-meta", type: "list", items: [
          { label: "Invoice #", binding: "invoice.number" },
          { label: "Date", binding: "invoice.date" },
          { label: "Due", binding: "invoice.dueDate" },
        ]},
        { id: "lines", type: "table", rowsBinding: "lines", showHeader: true, columns: [
          { key: "desc", label: "Description", binding: "description" },
          { key: "qty", label: "Qty", binding: "quantity", align: "right" },
          { key: "unit", label: "Unit Price", binding: "unitPrice", align: "right", format: "currency" },
          { key: "total", label: "Total", binding: "total", align: "right", format: "currency" },
        ]},
        { id: "totals", type: "list", items: [
          { label: "Subtotal", binding: "totals.subtotal" },
          { label: "Tax", binding: "totals.tax" },
          { label: "Total", binding: "totals.grandTotal" },
        ]},
      ];
    case "delivery_docket":
      return [
        ...baseHeader,
        { id: "delivery", type: "box", label: "Delivery", children: [
          { id: "del-contact", type: "text", text: "Deliver to: {{delivery.contact}}", style: { bold: true } },
          { id: "del-address", type: "text", text: "{{delivery.address}}" },
          { id: "del-notes", type: "text", text: "{{notes}}" },
        ]},
        { id: "delivery-lines", type: "table", rowsBinding: "lines", showHeader: true, columns: [
          { key: "desc", label: "Description", binding: "description" },
          { key: "qty", label: "Qty", binding: "quantity", align: "right" },
          { key: "loc", label: "Location", binding: "location" },
        ]},
      ];
    case "order_confirmation":
      return [
        ...baseHeader,
        { id: "order", type: "list", items: [
          { label: "Order #", binding: "order.number" },
          { label: "Order Date", binding: "order.date" },
          { label: "Requested Date", binding: "order.requestedDate" },
        ]},
        { id: "order-lines", type: "table", rowsBinding: "lines", showHeader: true, columns: [
          { key: "desc", label: "Description", binding: "description" },
          { key: "qty", label: "Qty", binding: "quantity", align: "right" },
          { key: "unit", label: "Unit Price", binding: "unitPrice", align: "right", format: "currency" },
        ]},
      ];
    case "av_list":
      return [
        ...baseHeader,
        { id: "av-table", type: "table", rowsBinding: "items", showHeader: true, columns: [
          { key: "name", label: "Product", binding: "name" },
          { key: "size", label: "Size", binding: "size" },
          { key: "grade", label: "Grade", binding: "grade" },
          { key: "qty", label: "Available", binding: "qty", align: "right" },
          { key: "price", label: "Price", binding: "price", align: "right", format: "currency" },
        ]},
      ];
    case "lookin_good":
    default:
      return [
        ...baseHeader,
        { id: "lg-table", type: "table", rowsBinding: "items", showHeader: true, columns: [
          { key: "name", label: "Product", binding: "name" },
          { key: "desc", label: "Description", binding: "description" },
          { key: "photo", label: "Photo URL", binding: "photo" },
        ]},
      ];
  }
}

