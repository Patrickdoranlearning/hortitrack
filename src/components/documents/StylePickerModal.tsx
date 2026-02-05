"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Receipt,
  Truck,
  ClipboardCheck,
  Leaf,
  Star,
  Check,
} from "lucide-react";
import type { DocumentType, DocumentComponent } from "@/lib/documents/types";

// Style definitions for each document type
export type StyleOption = {
  id: string;
  name: string;
  description: string;
  thumbnail: "classic" | "modern" | "minimal";
  getLayout: (documentType: DocumentType) => DocumentComponent[];
};

// Document type icons mapping
const DOC_TYPE_ICONS: Record<DocumentType, React.ReactNode> = {
  invoice: <Receipt className="h-5 w-5" />,
  delivery_docket: <Truck className="h-5 w-5" />,
  order_confirmation: <ClipboardCheck className="h-5 w-5" />,
  av_list: <Leaf className="h-5 w-5" />,
  lookin_good: <Star className="h-5 w-5" />,
};

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  invoice: "Invoice",
  delivery_docket: "Delivery Docket",
  order_confirmation: "Order Confirmation",
  av_list: "Availability List",
  lookin_good: "Lookin' Good List",
};

// Logo placeholder component that goes in all templates
function createLogoComponent(): DocumentComponent {
  return {
    id: "company-logo",
    type: "image",
    zone: "header",
    url: "{{company.logo}}",
    width: 50,
    height: 20,
    style: {
      position: { x: 15, y: 5, width: 50, height: 20 },
    },
  };
}

// Common company info component
function createCompanyInfo(): DocumentComponent {
  return {
    id: "company-info",
    type: "text",
    zone: "header",
    text: "{{company.name}}\n{{company.address}}\n{{company.phone}}",
    style: {
      fontSize: 10,
      color: "#64748b",
      position: { x: 70, y: 5, width: 80 },
    },
  };
}

// Style presets with layouts for each document type
const STYLE_PRESETS: Record<DocumentType, StyleOption[]> = {
  invoice: [
    {
      id: "classic-invoice",
      name: "Classic",
      description: "Traditional business invoice with detailed sections",
      thumbnail: "classic",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        createCompanyInfo(),
        {
          id: "header-title",
          type: "heading",
          zone: "header",
          text: "INVOICE",
          level: 1,
          style: { fontSize: 28, bold: true, align: "right", position: { x: 150, y: 8, width: 45 } },
        },
        { id: "header-divider", type: "divider", zone: "header", style: { position: { x: 15, y: 30, width: 180 } } },
        {
          id: "customer-box",
          type: "box",
          zone: "body",
          label: "Bill To",
          style: { position: { x: 15, y: 40, width: 85, height: 35 } },
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
          style: { position: { x: 110, y: 40, width: 85, height: 35 } },
          items: [
            { label: "Invoice Number", binding: "invoice.number" },
            { label: "Invoice Date", binding: "invoice.date" },
            { label: "Due Date", binding: "invoice.dueDate" },
            { label: "Payment Terms", binding: "invoice.paymentTerms" },
          ],
        },
        {
          id: "lines-table",
          type: "table",
          zone: "body",
          rowsBinding: "lines",
          showHeader: true,
          style: { position: { x: 15, y: 85, width: 180, height: 100 } },
          columns: [
            { key: "desc", label: "Description", binding: "description", width: 50 },
            { key: "qty", label: "Qty", binding: "quantity", align: "right", format: "number" },
            { key: "unit", label: "Unit Price", binding: "unitPrice", align: "right", format: "currency" },
            { key: "total", label: "Amount", binding: "total", align: "right", format: "currency" },
          ],
        },
        {
          id: "totals",
          type: "list",
          zone: "body",
          style: { position: { x: 120, y: 195, width: 75, height: 35 }, align: "right" },
          items: [
            { label: "Subtotal", binding: "totals.subtotal" },
            { label: "VAT ({{totals.vatRate}}%)", binding: "totals.tax" },
            { label: "Total Due", binding: "totals.grandTotal" },
          ],
        },
        {
          id: "footer-notes",
          type: "text",
          zone: "footer",
          text: "{{notes}}",
          style: { fontSize: 9, color: "#64748b", position: { x: 15, y: 280 } },
        },
        {
          id: "footer-terms",
          type: "text",
          zone: "footer",
          text: "Payment is due within the specified payment terms. Thank you for your business.",
          style: { fontSize: 8, color: "#94a3b8", position: { x: 15, y: 287, width: 180 } },
        },
      ],
    },
    {
      id: "modern-invoice",
      name: "Modern",
      description: "Contemporary design with visual flair and color accents",
      thumbnail: "modern",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        {
          id: "header-box",
          type: "box",
          zone: "header",
          style: { background: "#f8fafc", padding: 15, position: { x: 0, y: 0, width: 210, height: 35 } },
          children: [
            {
              id: "title",
              type: "heading",
              text: "INVOICE",
              level: 1,
              style: { fontSize: 26, bold: true, color: "#0f172a", align: "right" },
            },
            {
              id: "subtitle",
              type: "text",
              text: "#{{invoice.number}}",
              style: { color: "#64748b", fontSize: 12, align: "right" },
            },
          ],
        },
        {
          id: "customer",
          type: "box",
          zone: "body",
          label: "Customer",
          style: { position: { x: 15, y: 45, width: 90, height: 30 } },
          children: [
            { id: "cust-name", type: "text", text: "{{customer.name}}", style: { bold: true, fontSize: 14 } },
            { id: "cust-addr", type: "text", text: "{{customer.address}}", style: { color: "#475569" } },
          ],
        },
        {
          id: "invoice-chips",
          type: "chips",
          zone: "body",
          style: { position: { x: 15, y: 80, width: 180 } },
          items: [
            { label: "Date: {{invoice.date}}", color: "#dbeafe" },
            { label: "Due: {{invoice.dueDate}}", color: "#fef3c7" },
          ],
        },
        {
          id: "lines",
          type: "table",
          zone: "body",
          rowsBinding: "lines",
          showHeader: true,
          style: { position: { x: 15, y: 95, width: 180, height: 100 } },
          columns: [
            { key: "desc", label: "Description", binding: "description", width: 50 },
            { key: "qty", label: "Qty", binding: "quantity", align: "center" },
            { key: "unit", label: "Price", binding: "unitPrice", align: "right", format: "currency" },
            { key: "total", label: "Total", binding: "total", align: "right", format: "currency" },
          ],
        },
        {
          id: "totals-box",
          type: "box",
          zone: "body",
          style: { background: "#f8fafc", padding: 10, position: { x: 110, y: 205, width: 85, height: 40 } },
          children: [
            { id: "subtotal", type: "text", text: "Subtotal: {{totals.subtotal}}", style: { align: "right" } },
            { id: "tax", type: "text", text: "VAT: {{totals.tax}}", style: { align: "right" } },
            { id: "total", type: "text", text: "Total: {{totals.grandTotal}}", style: { align: "right", bold: true, fontSize: 16 } },
          ],
        },
      ],
    },
    {
      id: "minimal-invoice",
      name: "Minimal",
      description: "Clean, simple layout with just the essentials",
      thumbnail: "minimal",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        {
          id: "heading",
          type: "heading",
          zone: "header",
          text: "Invoice #{{invoice.number}}",
          level: 2,
          style: { fontSize: 20, bold: true, position: { x: 70, y: 10, width: 125 } },
        },
        { id: "divider", type: "divider", zone: "header", style: { position: { x: 15, y: 30, width: 180 } } },
        {
          id: "customer-info",
          type: "text",
          zone: "body",
          text: "{{customer.name}} | {{invoice.date}}",
          style: { position: { x: 15, y: 40, width: 180 } },
        },
        {
          id: "lines",
          type: "table",
          zone: "body",
          rowsBinding: "lines",
          showHeader: true,
          style: { position: { x: 15, y: 55, width: 180, height: 150 } },
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
          style: { bold: true, align: "right", position: { x: 130, y: 215, width: 65 } },
        },
      ],
    },
  ],
  delivery_docket: [
    {
      id: "classic-docket",
      name: "Classic",
      description: "Traditional delivery docket with signature line",
      thumbnail: "classic",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        createCompanyInfo(),
        {
          id: "header-title",
          type: "heading",
          zone: "header",
          text: "DELIVERY DOCKET",
          level: 1,
          style: { fontSize: 24, bold: true, position: { x: 110, y: 5, width: 85 } },
        },
        {
          id: "header-number",
          type: "text",
          zone: "header",
          text: "#{{docket.number}}",
          style: { fontSize: 14, color: "#64748b", position: { x: 110, y: 18, width: 85 } },
        },
        { id: "header-divider", type: "divider", zone: "header", style: { position: { x: 15, y: 30, width: 180 } } },
        {
          id: "delivery-box",
          type: "box",
          zone: "body",
          label: "Delivery",
          style: { position: { x: 15, y: 40, width: 90, height: 40 } },
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
          style: { position: { x: 115, y: 40, width: 80, height: 35 } },
          items: [
            { label: "Delivery Date", binding: "docket.date" },
            { label: "Order Reference", binding: "order.number" },
          ],
        },
        {
          id: "lines-table",
          type: "table",
          zone: "body",
          rowsBinding: "lines",
          showHeader: true,
          style: { position: { x: 15, y: 90, width: 180, height: 120 } },
          columns: [
            { key: "desc", label: "Item", binding: "description", width: 60 },
            { key: "qty", label: "Quantity", binding: "quantity", align: "right", format: "number" },
            { key: "loc", label: "Location", binding: "location" },
          ],
        },
        {
          id: "notes-section",
          type: "text",
          zone: "body",
          text: "Notes: {{notes}}",
          style: { color: "#475569", position: { x: 15, y: 220, width: 180 } },
        },
        {
          id: "signature-line",
          type: "text",
          zone: "footer",
          text: "Received by: ________________________________  Date: _______________",
          style: { fontSize: 10, position: { x: 15, y: 280, width: 180 } },
        },
      ],
    },
    {
      id: "modern-docket",
      name: "Modern",
      description: "Contemporary docket with visual highlights",
      thumbnail: "modern",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        {
          id: "header-box",
          type: "box",
          zone: "header",
          style: { background: "#ecfdf5", padding: 10, position: { x: 0, y: 0, width: 210, height: 35 } },
          children: [
            { id: "title", type: "heading", text: "Delivery Docket", level: 1, style: { fontSize: 22, bold: true } },
            { id: "number", type: "text", text: "#{{docket.number}} - {{docket.date}}", style: { color: "#059669" } },
          ],
        },
        {
          id: "delivery-chips",
          type: "chips",
          zone: "body",
          style: { position: { x: 15, y: 45, width: 180 } },
          items: [
            { label: "To: {{delivery.contact}}", color: "#d1fae5" },
            { label: "Ref: {{order.number}}", color: "#f0fdfa" },
          ],
        },
        {
          id: "address",
          type: "text",
          zone: "body",
          text: "{{delivery.address}}",
          style: { color: "#475569", position: { x: 15, y: 60, width: 180 } },
        },
        {
          id: "lines-table",
          type: "table",
          zone: "body",
          rowsBinding: "lines",
          showHeader: true,
          style: { position: { x: 15, y: 80, width: 180, height: 130 } },
          columns: [
            { key: "desc", label: "Item", binding: "description", width: 55 },
            { key: "qty", label: "Qty", binding: "quantity", align: "center" },
            { key: "loc", label: "Location", binding: "location" },
          ],
        },
        {
          id: "signature-box",
          type: "box",
          zone: "footer",
          style: { border: { color: "#d1d5db", width: 1 }, position: { x: 15, y: 270, width: 180, height: 22 } },
          children: [
            { id: "sig-text", type: "text", text: "Signature: ___________________  Print Name: ___________________  Date: _________", style: { fontSize: 9 } },
          ],
        },
      ],
    },
    {
      id: "minimal-docket",
      name: "Minimal",
      description: "Simple clean delivery slip",
      thumbnail: "minimal",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        {
          id: "heading",
          type: "heading",
          zone: "header",
          text: "Delivery #{{docket.number}}",
          level: 2,
          style: { fontSize: 18, bold: true, position: { x: 70, y: 10, width: 125 } },
        },
        { id: "divider", type: "divider", zone: "header", style: { position: { x: 15, y: 28, width: 180 } } },
        {
          id: "delivery-info",
          type: "text",
          zone: "body",
          text: "To: {{delivery.contact}} | {{docket.date}}",
          style: { position: { x: 15, y: 40, width: 180 } },
        },
        {
          id: "lines",
          type: "table",
          zone: "body",
          rowsBinding: "lines",
          showHeader: true,
          style: { position: { x: 15, y: 55, width: 180, height: 180 } },
          columns: [
            { key: "desc", label: "Item", binding: "description" },
            { key: "qty", label: "Qty", binding: "quantity", align: "right" },
          ],
        },
        {
          id: "signature",
          type: "text",
          zone: "footer",
          text: "Received: ____________________",
          style: { position: { x: 15, y: 280, width: 180 } },
        },
      ],
    },
  ],
  order_confirmation: [
    {
      id: "classic-order",
      name: "Classic",
      description: "Traditional order confirmation format",
      thumbnail: "classic",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        createCompanyInfo(),
        {
          id: "header-title",
          type: "heading",
          zone: "header",
          text: "ORDER CONFIRMATION",
          level: 1,
          style: { fontSize: 22, bold: true, align: "right", position: { x: 110, y: 5, width: 85 } },
        },
        { id: "header-divider", type: "divider", zone: "header", style: { position: { x: 15, y: 30, width: 180 } } },
        {
          id: "customer-box",
          type: "box",
          zone: "body",
          style: { position: { x: 15, y: 40, width: 90, height: 35 } },
          children: [
            { id: "cust-name", type: "text", text: "{{customer.name}}", style: { bold: true } },
            { id: "cust-addr", type: "text", text: "{{customer.address}}" },
            { id: "cust-email", type: "text", text: "{{customer.email}}" },
          ],
        },
        {
          id: "order-meta",
          type: "list",
          zone: "body",
          style: { position: { x: 115, y: 40, width: 80, height: 35 } },
          items: [
            { label: "Order Number", binding: "order.number" },
            { label: "Order Date", binding: "order.date" },
            { label: "Requested Date", binding: "order.requestedDate" },
          ],
        },
        {
          id: "lines-table",
          type: "table",
          zone: "body",
          rowsBinding: "lines",
          showHeader: true,
          style: { position: { x: 15, y: 85, width: 180, height: 120 } },
          columns: [
            { key: "desc", label: "Description", binding: "description", width: 50 },
            { key: "qty", label: "Qty", binding: "quantity", align: "right" },
            { key: "unit", label: "Unit Price", binding: "unitPrice", align: "right", format: "currency" },
          ],
        },
        {
          id: "total",
          type: "text",
          zone: "body",
          text: "Estimated Total: {{totals.grandTotal}}",
          style: { bold: true, align: "right", position: { x: 110, y: 215, width: 85 } },
        },
        {
          id: "footer-text",
          type: "text",
          zone: "footer",
          text: "Thank you for your order! Please contact us if you have any questions.",
          style: { fontSize: 10, color: "#64748b", position: { x: 15, y: 280, width: 180 } },
        },
      ],
    },
    {
      id: "modern-order",
      name: "Modern",
      description: "Fresh, contemporary order confirmation",
      thumbnail: "modern",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        {
          id: "header-box",
          type: "box",
          zone: "header",
          style: { background: "#eff6ff", padding: 10, position: { x: 0, y: 0, width: 210, height: 35 } },
          children: [
            { id: "title", type: "heading", text: "Order Confirmed!", level: 1, style: { fontSize: 22, bold: true, color: "#1e40af" } },
            { id: "number", type: "text", text: "Order #{{order.number}}", style: { color: "#3b82f6" } },
          ],
        },
        {
          id: "order-chips",
          type: "chips",
          zone: "body",
          style: { position: { x: 15, y: 45, width: 180 } },
          items: [
            { label: "Customer: {{customer.name}}", color: "#dbeafe" },
            { label: "Date: {{order.date}}", color: "#e0e7ff" },
            { label: "Delivery: {{order.requestedDate}}", color: "#fef3c7" },
          ],
        },
        {
          id: "lines-table",
          type: "table",
          zone: "body",
          rowsBinding: "lines",
          showHeader: true,
          style: { position: { x: 15, y: 65, width: 180, height: 140 } },
          columns: [
            { key: "desc", label: "Item", binding: "description", width: 55 },
            { key: "qty", label: "Qty", binding: "quantity", align: "center" },
            { key: "unit", label: "Price", binding: "unitPrice", align: "right", format: "currency" },
          ],
        },
        {
          id: "total-box",
          type: "box",
          zone: "body",
          style: { background: "#f0fdf4", padding: 8, position: { x: 110, y: 215, width: 85, height: 25 } },
          children: [
            { id: "total", type: "text", text: "Total: {{totals.grandTotal}}", style: { bold: true, fontSize: 14, align: "right" } },
          ],
        },
      ],
    },
    {
      id: "minimal-order",
      name: "Minimal",
      description: "Simple order summary",
      thumbnail: "minimal",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        {
          id: "heading",
          type: "heading",
          zone: "header",
          text: "Order #{{order.number}}",
          level: 2,
          style: { fontSize: 18, bold: true, position: { x: 70, y: 10, width: 125 } },
        },
        { id: "divider", type: "divider", zone: "header", style: { position: { x: 15, y: 28, width: 180 } } },
        {
          id: "order-info",
          type: "text",
          zone: "body",
          text: "{{customer.name}} | {{order.date}}",
          style: { position: { x: 15, y: 40, width: 180 } },
        },
        {
          id: "lines",
          type: "table",
          zone: "body",
          rowsBinding: "lines",
          showHeader: true,
          style: { position: { x: 15, y: 55, width: 180, height: 180 } },
          columns: [
            { key: "desc", label: "Item", binding: "description" },
            { key: "qty", label: "Qty", binding: "quantity", align: "right" },
          ],
        },
      ],
    },
  ],
  av_list: [
    {
      id: "classic-avlist",
      name: "Classic",
      description: "Traditional availability listing",
      thumbnail: "classic",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        createCompanyInfo(),
        {
          id: "header-title",
          type: "heading",
          zone: "header",
          text: "AVAILABILITY LIST",
          level: 1,
          style: { fontSize: 22, bold: true, position: { x: 110, y: 5, width: 85 } },
        },
        {
          id: "generated",
          type: "text",
          zone: "header",
          text: "Generated: {{generatedAt}}",
          style: { fontSize: 10, color: "#64748b", position: { x: 110, y: 18, width: 85 } },
        },
        { id: "header-divider", type: "divider", zone: "header", style: { position: { x: 15, y: 30, width: 180 } } },
        {
          id: "items-table",
          type: "table",
          zone: "body",
          rowsBinding: "items",
          showHeader: true,
          style: { position: { x: 15, y: 40, width: 180, height: 220 } },
          columns: [
            { key: "name", label: "Product", binding: "name", width: 35 },
            { key: "size", label: "Size", binding: "size" },
            { key: "grade", label: "Grade", binding: "grade" },
            { key: "qty", label: "Available", binding: "qty", align: "right" },
            { key: "price", label: "Price", binding: "price", align: "right", format: "currency" },
          ],
        },
        {
          id: "footer-note",
          type: "text",
          zone: "footer",
          text: "Prices subject to availability. Contact us to place an order.",
          style: { fontSize: 9, color: "#64748b", position: { x: 15, y: 280, width: 180 } },
        },
      ],
    },
    {
      id: "modern-avlist",
      name: "Modern",
      description: "Contemporary availability view",
      thumbnail: "modern",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        {
          id: "header-box",
          type: "box",
          zone: "header",
          style: { background: "#f0fdf4", padding: 10, position: { x: 0, y: 0, width: 210, height: 35 } },
          children: [
            { id: "title", type: "heading", text: "{{title}}", level: 1, style: { fontSize: 22, bold: true, color: "#166534" } },
            { id: "date", type: "text", text: "Updated: {{generatedAt}}", style: { color: "#16a34a", fontSize: 10 } },
          ],
        },
        {
          id: "items-table",
          type: "table",
          zone: "body",
          rowsBinding: "items",
          showHeader: true,
          style: { position: { x: 15, y: 45, width: 180, height: 220 } },
          columns: [
            { key: "name", label: "Product", binding: "name", width: 40 },
            { key: "size", label: "Size", binding: "size" },
            { key: "qty", label: "Stock", binding: "qty", align: "center" },
            { key: "price", label: "Price", binding: "price", align: "right", format: "currency" },
          ],
        },
      ],
    },
    {
      id: "minimal-avlist",
      name: "Minimal",
      description: "Simple availability table",
      thumbnail: "minimal",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        {
          id: "heading",
          type: "heading",
          zone: "header",
          text: "{{title}}",
          level: 2,
          style: { fontSize: 18, bold: true, position: { x: 70, y: 10, width: 125 } },
        },
        { id: "divider", type: "divider", zone: "header", style: { position: { x: 15, y: 28, width: 180 } } },
        {
          id: "items",
          type: "table",
          zone: "body",
          rowsBinding: "items",
          showHeader: true,
          style: { position: { x: 15, y: 40, width: 180, height: 230 } },
          columns: [
            { key: "name", label: "Name", binding: "name" },
            { key: "qty", label: "Available", binding: "qty", align: "right" },
          ],
        },
      ],
    },
  ],
  lookin_good: [
    {
      id: "classic-lookin",
      name: "Classic",
      description: "Traditional product showcase",
      thumbnail: "classic",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        createCompanyInfo(),
        {
          id: "header-title",
          type: "heading",
          zone: "header",
          text: "LOOKIN' GOOD LIST",
          level: 1,
          style: { fontSize: 22, bold: true, position: { x: 110, y: 5, width: 85 } },
        },
        {
          id: "generated",
          type: "text",
          zone: "header",
          text: "{{generatedAt}}",
          style: { fontSize: 10, color: "#64748b", position: { x: 110, y: 18, width: 85 } },
        },
        { id: "header-divider", type: "divider", zone: "header", style: { position: { x: 15, y: 30, width: 180 } } },
        {
          id: "items-table",
          type: "table",
          zone: "body",
          rowsBinding: "items",
          showHeader: true,
          style: { position: { x: 15, y: 40, width: 180, height: 230 } },
          columns: [
            { key: "name", label: "Product", binding: "name" },
            { key: "desc", label: "Description", binding: "description" },
            { key: "photo", label: "Photo", binding: "photo" },
          ],
        },
      ],
    },
    {
      id: "modern-lookin",
      name: "Modern",
      description: "Eye-catching product highlights",
      thumbnail: "modern",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        {
          id: "header-box",
          type: "box",
          zone: "header",
          style: { background: "#fef3c7", padding: 10, position: { x: 0, y: 0, width: 210, height: 35 } },
          children: [
            { id: "title", type: "heading", text: "{{title}}", level: 1, style: { fontSize: 22, bold: true, color: "#92400e" } },
            { id: "subtitle", type: "text", text: "Fresh picks just for you!", style: { color: "#d97706" } },
          ],
        },
        {
          id: "items-table",
          type: "table",
          zone: "body",
          rowsBinding: "items",
          showHeader: true,
          style: { position: { x: 15, y: 45, width: 180, height: 225 } },
          columns: [
            { key: "name", label: "Product", binding: "name", width: 40 },
            { key: "desc", label: "What's Special", binding: "description", width: 50 },
          ],
        },
      ],
    },
    {
      id: "minimal-lookin",
      name: "Minimal",
      description: "Clean product listing",
      thumbnail: "minimal",
      getLayout: (): DocumentComponent[] => [
        createLogoComponent(),
        {
          id: "heading",
          type: "heading",
          zone: "header",
          text: "{{title}}",
          level: 2,
          style: { fontSize: 18, bold: true, position: { x: 70, y: 10, width: 125 } },
        },
        { id: "divider", type: "divider", zone: "header", style: { position: { x: 15, y: 28, width: 180 } } },
        {
          id: "items",
          type: "table",
          zone: "body",
          rowsBinding: "items",
          showHeader: true,
          style: { position: { x: 15, y: 40, width: 180, height: 230 } },
          columns: [
            { key: "name", label: "Product", binding: "name" },
            { key: "desc", label: "Description", binding: "description" },
          ],
        },
      ],
    },
  ],
};

// Visual preview thumbnails for styles
function StyleThumbnail({ style }: { style: "classic" | "modern" | "minimal" }) {
  const baseClasses = "w-full h-24 rounded border bg-white relative overflow-hidden";

  if (style === "classic") {
    return (
      <div className={baseClasses}>
        {/* Classic style preview */}
        <div className="absolute top-2 left-2 w-8 h-3 bg-slate-200 rounded-sm" /> {/* Logo */}
        <div className="absolute top-2 right-2 w-12 h-3 bg-slate-800 rounded-sm" /> {/* Title */}
        <div className="absolute top-7 left-0 right-0 h-[1px] bg-slate-200" /> {/* Divider */}
        <div className="absolute top-9 left-2 w-16 h-8 border border-slate-200 rounded-sm" /> {/* Box */}
        <div className="absolute top-9 right-2 w-10 h-8 flex flex-col gap-0.5 justify-center">
          <div className="h-1 bg-slate-100 w-full rounded" />
          <div className="h-1 bg-slate-100 w-full rounded" />
          <div className="h-1 bg-slate-100 w-full rounded" />
        </div>
        <div className="absolute bottom-3 left-2 right-2 h-5 border-t border-slate-200" /> {/* Table line */}
      </div>
    );
  }

  if (style === "modern") {
    return (
      <div className={baseClasses}>
        {/* Modern style preview */}
        <div className="absolute top-0 left-0 right-0 h-8 bg-slate-100" /> {/* Header bg */}
        <div className="absolute top-2 left-2 w-8 h-3 bg-slate-300 rounded-sm" /> {/* Logo */}
        <div className="absolute top-2 right-2 w-14 h-3 bg-blue-500 rounded-sm" /> {/* Title */}
        <div className="absolute top-10 left-2 flex gap-1">
          <div className="px-1.5 py-0.5 bg-blue-100 rounded-full text-[6px]" />
          <div className="px-1.5 py-0.5 bg-amber-100 rounded-full text-[6px]" />
        </div>
        <div className="absolute top-16 left-2 right-2 h-5 flex flex-col gap-0.5">
          <div className="h-1.5 bg-slate-100 w-full rounded" />
          <div className="h-1 bg-slate-50 w-full rounded" />
        </div>
        <div className="absolute bottom-3 right-2 w-12 h-4 bg-slate-100 rounded" /> {/* Total box */}
      </div>
    );
  }

  // Minimal
  return (
    <div className={baseClasses}>
      {/* Minimal style preview */}
      <div className="absolute top-2 left-2 w-6 h-3 bg-slate-200 rounded-sm" /> {/* Logo */}
      <div className="absolute top-2 left-10 w-20 h-2 bg-slate-700 rounded-sm" /> {/* Title */}
      <div className="absolute top-6 left-2 right-2 h-[1px] bg-slate-200" /> {/* Divider */}
      <div className="absolute top-9 left-2 right-2 flex flex-col gap-1">
        <div className="h-1 bg-slate-100 w-full rounded" />
        <div className="h-1 bg-slate-50 w-full rounded" />
        <div className="h-1 bg-slate-50 w-full rounded" />
        <div className="h-1 bg-slate-50 w-full rounded" />
      </div>
    </div>
  );
}

type StylePickerModalProps = {
  open: boolean;
  onClose: () => void;
  documentType: DocumentType;
  onStyleSelect: (layout: DocumentComponent[], styleName: string) => void;
};

export function StylePickerModal({
  open,
  onClose,
  documentType,
  onStyleSelect,
}: StylePickerModalProps) {
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);

  const styles = useMemo(() => STYLE_PRESETS[documentType] || [], [documentType]);

  const handleSelect = () => {
    if (!selectedStyle) return;
    const style = styles.find((s) => s.id === selectedStyle);
    if (style) {
      onStyleSelect(style.getLayout(documentType), style.name);
      setSelectedStyle(null);
    }
  };

  const handleStyleClick = (styleId: string) => {
    if (selectedStyle === styleId) {
      // Double-click behavior: select and confirm
      const style = styles.find((s) => s.id === styleId);
      if (style) {
        onStyleSelect(style.getLayout(documentType), style.name);
        setSelectedStyle(null);
      }
    } else {
      setSelectedStyle(styleId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent size="lg" className="max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {DOC_TYPE_ICONS[documentType]}
            <span>Choose a Style for {DOC_TYPE_LABELS[documentType]}</span>
          </DialogTitle>
          <DialogDescription>
            Select a starting template style. You can customize it further in the editor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="grid grid-cols-3 gap-4">
            {styles.map((style) => (
              <button
                key={style.id}
                onClick={() => handleStyleClick(style.id)}
                className={cn(
                  "group relative rounded-lg border-2 p-3 text-left transition-all hover:shadow-md",
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                  selectedStyle === style.id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-muted hover:border-primary/50"
                )}
              >
                {/* Selection indicator */}
                {selectedStyle === style.id && (
                  <div className="absolute -top-2 -right-2 rounded-full bg-primary p-1">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}

                {/* Thumbnail */}
                <StyleThumbnail style={style.thumbnail} />

                {/* Style info */}
                <div className="mt-3">
                  <h3 className="font-semibold text-sm">{style.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {style.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSelect} disabled={!selectedStyle}>
            Use This Style
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Export the presets for use elsewhere
export { STYLE_PRESETS };
