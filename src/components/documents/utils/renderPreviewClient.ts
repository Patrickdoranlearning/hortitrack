/**
 * Client-side preview renderer for Document Designer.
 * This is a lightweight version of the server-side renderer that runs in the browser
 * for instant preview feedback during editing.
 */

import type {
  DocumentComponent,
  DocumentType,
  ComponentStyle,
} from "@/lib/documents/types";

type RenderOptions = {
  title?: string;
  documentType?: DocumentType;
};

type DocumentData = Record<string, unknown>;

// A4 page size in mm
const A4_MM = { width: 210, height: 297 };

/**
 * Resolve a dot-path binding from data object.
 * Supports array notation with [] suffix.
 */
function resolvePath(data: DocumentData, path?: string | null): unknown {
  if (!path) return null;
  const parts = path.split(".");
  let cur: unknown = data;
  for (const p of parts) {
    if (cur === undefined || cur === null) break;
    if (typeof cur !== "object") break;
    if (p.endsWith("[]")) {
      const key = p.slice(0, -2);
      cur = (cur as Record<string, unknown>)[key];
    } else {
      cur = (cur as Record<string, unknown>)[p];
    }
  }
  return cur ?? null;
}

/**
 * Apply mustache-style bindings {{ path }} to text.
 */
function applyBindings(text: string | undefined, data: DocumentData): string {
  if (!text) return "";
  return text.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, path) => {
    const val = resolvePath(data, path.trim());
    if (val === undefined || val === null) return "";
    if (typeof val === "number") return val.toString();
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    return String(val);
  });
}

/**
 * Convert ComponentStyle to CSS string.
 */
function toCss(style?: ComponentStyle, includePosition = false): string {
  if (!style) return "";
  const css: string[] = [];
  if (style.fontSize) css.push(`font-size:${style.fontSize}px`);
  if (style.bold) css.push("font-weight:700");
  if (style.italic) css.push("font-style:italic");
  if (style.color) css.push(`color:${style.color}`);
  if (style.background) css.push(`background:${style.background}`);
  if (style.padding !== undefined) css.push(`padding:${style.padding}px`);
  if (style.marginBottom !== undefined) css.push(`margin-bottom:${style.marginBottom}px`);
  if (style.align) css.push(`text-align:${style.align}`);
  if (style.border?.width) {
    css.push(`border:${style.border.width}px solid ${style.border.color ?? "#e2e8f0"}`);
  }
  if (includePosition && style.position) {
    css.push("position:absolute");
    css.push(`left:${style.position.x}mm`);
    css.push(`top:${style.position.y}mm`);
    if (style.position.width) css.push(`width:${style.position.width}mm`);
    if (style.position.height) css.push(`min-height:${style.position.height}mm`);
  }
  return css.join(";");
}

/**
 * Check visibility rules for a component.
 */
function isVisible(component: DocumentComponent, data: DocumentData): boolean {
  const rule = component.visibleWhen;
  if (!rule) return true;
  const rules = Array.isArray(rule) ? rule : [rule];
  return rules.every((r) => {
    const v = resolvePath(data, r.field);
    switch (r.operator ?? "exists") {
      case "exists":
        return v !== undefined && v !== null && v !== "";
      case "equals":
        return v === r.value;
      case "not_equals":
        return v !== r.value;
      default:
        return true;
    }
  });
}

/**
 * Format a value based on format type.
 */
function formatValue(value: unknown, fmt?: string): string {
  if (value === undefined || value === null) return "";
  if (fmt === "currency") {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(
      Number(value) || 0
    );
  }
  if (fmt === "number") {
    return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 2 }).format(
      Number(value) || 0
    );
  }
  if (fmt === "date") {
    try {
      const d = new Date(value as string | number | Date);
      if (isFinite(d.getTime())) return d.toISOString().slice(0, 10);
    } catch {
      /* ignore */
    }
  }
  return String(value);
}

/**
 * Render a single component to HTML.
 */
function renderComponentHtml(
  component: DocumentComponent,
  data: DocumentData,
  usePositioning = false
): string {
  if (!isVisible(component, data)) return "";
  const style = toCss(component.style, usePositioning && !!component.style?.position);

  switch (component.type) {
    case "heading": {
      const level = component.level ?? 2;
      const tag = `h${Math.min(Math.max(level, 1), 4)}`;
      return `<${tag} style="${style}">${applyBindings(component.text ?? "", data)}</${tag}>`;
    }
    case "text":
      return `<p style="${style}">${applyBindings(component.text ?? "", data)}</p>`;
    case "list": {
      const items = component.items ?? [];
      const listItems = items
        .map((item) => {
          const label = item.label ?? "";
          const value = item.binding ? resolvePath(data, item.binding) : "";
          if (!label && !value) return "";
          const displayValue = value ? applyBindings(String(value), data) : "";
          return `<li><strong>${label}</strong>${displayValue ? `: ${displayValue}` : ""}</li>`;
        })
        .filter(Boolean)
        .join("");
      return `<ul style="list-style:none;padding:0;margin:0 0 12px 0;${style}">${listItems}</ul>`;
    }
    case "chips": {
      const chips = (component.items ?? []).map(
        (c) =>
          `<span style="display:inline-block;padding:4px 8px;border-radius:12px;margin-right:6px;background:${
            c.color ?? "#e2e8f0"
          };">${applyBindings(c.label, data)}</span>`
      );
      return `<div style="${style}">${chips.join("")}</div>`;
    }
    case "divider":
      return `<hr style="border:0;border-top:1px solid #e2e8f0;margin:12px 0;${style}" />`;
    case "spacer": {
      const h = component.size ?? 12;
      return `<div style="height:${h}px;"></div>`;
    }
    case "image": {
      const src = component.url ?? applyBindings(component.binding ?? "", data);
      if (!src) return `<div style="width:100%;height:60px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#64748b;border-radius:4px;">Image placeholder</div>`;
      const width = component.width ? `width:${component.width}px;` : "max-width:100%;";
      const height = component.height ? `height:${component.height}px;` : "";
      return `<img src="${src}" style="${width}${height}${style}" />`;
    }
    case "box": {
      const children = (component.children ?? [])
        .map((child) => renderComponentHtml(child, data))
        .join("");
      return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px;${style}">${children}</div>`;
    }
    case "table": {
      const resolvedRows = resolvePath(data, component.rowsBinding ?? "");
      const rows: Record<string, unknown>[] = Array.isArray(resolvedRows)
        ? (resolvedRows as Record<string, unknown>[])
        : [];
      const cols = component.columns ?? [];
      const headers =
        component.showHeader !== false
          ? `<thead><tr>${cols
              .map(
                (c) =>
                  `<th style="text-align:${c.align ?? "left"};border-bottom:2px solid #e2e8f0;padding:8px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">${c.label}</th>`
              )
              .join("")}</tr></thead>`
          : "";
      const body = rows
        .map((row) => {
          const cells = cols
            .map((c) => {
              const raw = c.binding
                ? resolvePath(row as DocumentData, c.binding)
                : row?.[c.key];
              const formatted = formatValue(raw, c.format);
              return `<td style="text-align:${c.align ?? "left"};padding:8px;border-bottom:1px solid #f1f5f9;">${formatted}</td>`;
            })
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");
      return `<table style="width:100%;border-collapse:collapse;margin-bottom:12px;${style}">${headers}<tbody>${body}</tbody></table>`;
    }
    default:
      return "";
  }
}

/**
 * Render a complete document layout to HTML.
 * This is the main entry point for client-side preview.
 */
export function renderPreviewClient(
  layout: DocumentComponent[],
  data: DocumentData,
  opts?: RenderOptions
): string {
  const usePositioning = layout.some((c) => c.style?.position);
  const body = layout.map((c) => renderComponentHtml(c, data, usePositioning)).join("");
  const title = opts?.title ?? "Preview";

  const containerStyle = usePositioning
    ? `position: relative; width: ${A4_MM.width}mm; min-height: ${A4_MM.height}mm; margin: 0 auto; background: white; padding: 15mm;`
    : `background: white; max-width: 100%; margin: 0; padding: 24px;`;

  const styles = `
    * { box-sizing: border-box; }
    body {
      font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #0f172a;
      background: white;
      margin: 0;
      padding: 0;
      font-size: 14px;
      line-height: 1.5;
    }
    .doc { ${containerStyle} }
    h1 { font-size: 24px; margin: 0 0 8px 0; font-weight: 700; }
    h2 { font-size: 20px; margin: 0 0 8px 0; font-weight: 700; }
    h3 { font-size: 16px; margin: 0 0 8px 0; font-weight: 600; }
    h4 { font-size: 14px; margin: 0 0 8px 0; font-weight: 600; }
    p { margin: 0 0 10px 0; line-height: 1.5; }
    table { font-size: 13px; }
    th { font-weight: 600; }
  `;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>${styles}</style>
  </head>
  <body>
    <div class="doc">${body}</div>
  </body>
</html>`;
}

/**
 * Get sample data for a specific document type.
 * Used for live preview with realistic placeholder content.
 */
export function getSampleDataForType(documentType: DocumentType): DocumentData {
  const baseData = {
    title: "Sample Document",
    subtitle: "Preview Mode",
    generatedAt: new Date().toISOString().slice(0, 10),
  };

  switch (documentType) {
    case "invoice":
      return {
        ...baseData,
        title: "Invoice",
        subtitle: "Tax Invoice",
        invoice: {
          number: "INV-2024-001",
          date: "2024-02-04",
          dueDate: "2024-03-04",
        },
        customer: {
          name: "Acme Garden Centre",
          email: "orders@acmegarden.ie",
          address: "123 Garden Lane, Dublin 4, Ireland",
        },
        lines: [
          { description: "Lavender (9cm pot)", quantity: 50, unitPrice: 2.5, total: 125 },
          { description: "Rosemary (9cm pot)", quantity: 30, unitPrice: 2.75, total: 82.5 },
          { description: "Thyme (9cm pot)", quantity: 40, unitPrice: 2.25, total: 90 },
        ],
        totals: {
          subtotal: 297.5,
          tax: 68.43,
          grandTotal: 365.93,
        },
        notes: "Thank you for your business!",
      };

    case "delivery_docket":
      return {
        ...baseData,
        title: "Delivery Docket",
        subtitle: "Dispatch Note",
        docket: {
          number: "DD-2024-042",
          date: "2024-02-04",
        },
        delivery: {
          address: "456 Nursery Road, Cork, Ireland",
          contact: "John Murphy",
        },
        lines: [
          { description: "Lavender (9cm pot)", quantity: 50, location: "Bay A3" },
          { description: "Rosemary (9cm pot)", quantity: 30, location: "Bay B1" },
          { description: "Thyme (9cm pot)", quantity: 40, location: "Bay C2" },
        ],
        notes: "Please handle with care. Fragile plants.",
      };

    case "order_confirmation":
      return {
        ...baseData,
        title: "Order Confirmation",
        subtitle: "Your order has been received",
        order: {
          number: "ORD-2024-089",
          date: "2024-02-04",
          requestedDate: "2024-02-11",
        },
        customer: {
          name: "Green Thumb Landscapes",
          email: "info@greenthumb.ie",
        },
        lines: [
          { description: "Hebe 'Autumn Glory'", quantity: 25, unitPrice: 4.5 },
          { description: "Euonymus 'Emerald Gold'", quantity: 15, unitPrice: 5.25 },
          { description: "Photinia 'Red Robin'", quantity: 10, unitPrice: 8.0 },
        ],
        totals: {
          grandTotal: 271.25,
        },
      };

    case "av_list":
      return {
        ...baseData,
        title: "Availability List",
        subtitle: "Current Stock",
        items: [
          { name: "Lavender 'Hidcote'", size: "9cm", grade: "A", qty: 500, price: 2.5 },
          { name: "Rosemary 'Miss Jessopp'", size: "9cm", grade: "A", qty: 350, price: 2.75 },
          { name: "Salvia 'Hot Lips'", size: "1L", grade: "A", qty: 200, price: 4.0 },
          { name: "Hebe 'Autumn Glory'", size: "2L", grade: "A+", qty: 150, price: 5.5 },
        ],
      };

    case "lookin_good":
      return {
        ...baseData,
        title: "Looking Good List",
        subtitle: "Featured Plants This Week",
        items: [
          { name: "Camellia japonica", description: "Beautiful pink blooms, perfect for spring", photo: "" },
          { name: "Magnolia stellata", description: "Star magnolia, early spring flowering", photo: "" },
          { name: "Prunus 'Kanzan'", description: "Japanese cherry, stunning pink blossom", photo: "" },
        ],
      };

    default:
      return baseData;
  }
}
