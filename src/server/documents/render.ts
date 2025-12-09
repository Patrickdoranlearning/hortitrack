import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  type DocumentComponent,
  type TemplateLayout,
  type DocumentType,
  type ComponentStyle,
} from "@/lib/documents/types";

type RenderOptions = {
  title?: string;
  documentType?: DocumentType;
};

function resolvePath(data: any, path?: string | null): any {
  if (!path) return null;
  const parts = path.split(".");
  let cur: any = data;
  for (const p of parts) {
    if (p.endsWith("[]")) {
      const key = p.slice(0, -2);
      cur = cur?.[key];
    } else {
      cur = cur?.[p];
    }
    if (cur === undefined || cur === null) break;
  }
  return cur ?? null;
}

function applyBindings(text: string | undefined, data: any): string {
  if (!text) return "";
  return text.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, path) => {
    const val = resolvePath(data, path.trim());
    if (val === undefined || val === null) return "";
    if (typeof val === "number") return val.toString();
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    return String(val);
  });
}

function toCss(style?: ComponentStyle) {
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
  return css.join(";");
}

function isVisible(component: DocumentComponent, data: any): boolean {
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

function renderComponentHtml(component: DocumentComponent, data: any): string {
  if (!isVisible(component, data)) return "";
  const style = toCss(component.style);

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
      const lis = items
        .map((item, idx) => {
          const text =
            item.binding ? resolvePath(data, item.binding) : item.label ?? `Item ${idx + 1}`;
          if (text === undefined || text === null || text === "") return "";
          return `<li>${applyBindings(String(text), data)}</li>`;
        })
        .join("");
      return `<ul style="${style}">${lis}</ul>`;
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
      return `<hr style="border:0;border-top:1px solid #e2e8f0;${style}" />`;
    case "spacer": {
      const h = component.size ?? 12;
      return `<div style="height:${h}px;"></div>`;
    }
    case "image": {
      const src = component.url ?? applyBindings(component.binding ?? "", data);
      if (!src) return "";
      const width = component.width ? `width:${component.width}px;` : "";
      const height = component.height ? `height:${component.height}px;` : "";
      return `<img src="${src}" style="${width}${height}${style}" />`;
    }
    case "box": {
      const children = (component.children ?? [])
        .map((child) => renderComponentHtml(child, data))
        .join("");
      return `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;${style}">${children}</div>`;
    }
    case "table": {
      const rows: any[] = Array.isArray(resolvePath(data, component.rowsBinding ?? ""))
        ? (resolvePath(data, component.rowsBinding ?? "") as any[])
        : [];
      const cols = component.columns ?? [];
      const headers = component.showHeader !== false
        ? `<thead><tr>${cols
            .map(
              (c) =>
                `<th style="text-align:${c.align ?? "left"};border-bottom:1px solid #e2e8f0;padding:6px 8px;">${
                  c.label
                }</th>`
            )
            .join("")}</tr></thead>`
        : "";
      const body = rows
        .map((row) => {
          const cells = cols
            .map((c) => {
              const raw = c.binding ? resolvePath(row, c.binding) : row?.[c.key];
              const formatted = formatValue(raw, c.format);
              return `<td style="text-align:${c.align ?? "left"};padding:6px 8px;border-bottom:1px solid #f1f5f9;">${formatted}</td>`;
            })
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");
      return `<table style="width:100%;border-collapse:collapse;${style}">${headers}<tbody>${body}</tbody></table>`;
    }
    default:
      return "";
  }
}

function formatValue(value: any, fmt?: string): string {
  if (value === undefined || value === null) return "";
  if (fmt === "currency") return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(Number(value) || 0);
  if (fmt === "number") return new Intl.NumberFormat("en-IE", { maximumFractionDigits: 2 }).format(Number(value) || 0);
  if (fmt === "date") {
    try {
      const d = new Date(value);
      if (isFinite(d.getTime())) return d.toISOString().slice(0, 10);
    } catch {
      /* no-op */
    }
  }
  return String(value);
}

export function renderDocumentHtml(layout: TemplateLayout, data: any, opts?: RenderOptions): string {
  const body = layout.map((c) => renderComponentHtml(c, data)).join("");
  const title = opts?.title ?? "Document";
  const style = `
    body { font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #0f172a; background: #f8fafc; }
    .doc { background: white; max-width: 820px; margin: 12px auto; padding: 24px 28px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
    h1,h2,h3,h4 { margin: 0 0 8px 0; }
    p { margin: 0 0 10px 0; line-height: 1.45; }
    table { font-size: 14px; }
    th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
  `;
  return `
    <html>
      <head>
        <title>${title}</title>
        <style>${style}</style>
      </head>
      <body>
        <div class="doc">${body}</div>
      </body>
    </html>
  `;
}

export async function renderDocumentPdf(layout: TemplateLayout, data: any, opts?: RenderOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 40;
  let y = page.getHeight() - margin;
  const usableWidth = page.getWidth() - margin * 2;

  const ensureSpace = (height: number) => {
    if (y - height < margin) {
      page = pdf.addPage([595.28, 841.89]);
      y = page.getHeight() - margin;
    }
  };

  const drawText = (text: string, size = 12, weight: "regular" | "bold" = "regular") => {
    ensureSpace(size + 6);
    page.drawText(text, { x: margin, y: y - size, size, font: weight === "bold" ? bold : font, color: rgb(0, 0, 0) });
    y -= size + 6;
  };

  const drawBoxBorder = (height: number) => {
    page.drawRectangle({
      x: margin - 4,
      y: y - height - 6,
      width: usableWidth + 8,
      height: height + 10,
      borderColor: rgb(0.89, 0.93, 0.97),
      borderWidth: 1,
      color: undefined,
    });
  };

  const renderComponent = (component: DocumentComponent) => {
    if (!isVisible(component, data)) return;
    switch (component.type) {
      case "heading":
        drawText(applyBindings(component.text ?? "", data), component.style?.fontSize ?? 18, "bold");
        return;
      case "text":
        drawText(applyBindings(component.text ?? "", data), component.style?.fontSize ?? 12, component.style?.bold ? "bold" : "regular");
        return;
      case "spacer": {
        const h = component.size ?? 12;
        ensureSpace(h);
        y -= h;
        return;
      }
      case "divider":
        ensureSpace(14);
        page.drawLine({
          start: { x: margin, y },
          end: { x: page.getWidth() - margin, y },
          thickness: 1,
          color: rgb(0.85, 0.89, 0.95),
        });
        y -= 12;
        return;
      case "list": {
        const items = component.items ?? [];
        for (const item of items) {
          const text =
            item.binding ? resolvePath(data, item.binding) : item.label;
          if (!text) continue;
          drawText(`• ${applyBindings(String(text), data)}`, component.style?.fontSize ?? 12);
        }
        return;
      }
      case "chips": {
        const chips = component.items ?? [];
        const text = chips.map((c) => applyBindings(c.label, data)).filter(Boolean).join("  ");
        if (text) drawText(text, 11);
        return;
      }
      case "box": {
        const children = component.children ?? [];
        const beforeY = y;
        y -= 6;
        for (const child of children) renderComponent(child);
        const heightUsed = beforeY - y;
        drawBoxBorder(heightUsed);
        y -= 6;
        return;
      }
      case "table": {
        const rows: any[] = Array.isArray(resolvePath(data, component.rowsBinding ?? ""))
          ? (resolvePath(data, component.rowsBinding ?? "") as any[])
          : [];
        const cols = component.columns ?? [];
        const rowHeight = 18;
        if (component.showHeader !== false) {
          ensureSpace(rowHeight);
          let x = margin;
          for (const col of cols) {
            const label = col.label ?? col.key;
            page.drawText(label, { x, y: y - 12, size: 10, font: bold });
            x += usableWidth / Math.max(cols.length, 1);
          }
          y -= rowHeight;
        }
        for (const row of rows) {
          ensureSpace(rowHeight);
          let x = margin;
          for (const col of cols) {
            const raw = col.binding ? resolvePath(row, col.binding) : row?.[col.key];
            const text = formatValue(raw, col.format);
            page.drawText(text ?? "", { x, y: y - 12, size: 11, font });
            x += usableWidth / Math.max(cols.length, 1);
          }
          y -= rowHeight;
        }
        return;
      }
      default:
        drawText(applyBindings(component.text ?? "", data));
    }
  };

  for (const component of layout) {
    renderComponent(component);
  }

  return pdf.save();
}

