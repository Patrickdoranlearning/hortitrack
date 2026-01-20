import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { layoutGraph } from "@/server/batches/graphLayout";
import type { BatchHistory } from "@/server/batches/history";

export async function renderHistoryPdf(data: BatchHistory): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const PAGE = { w: 595.28, h: 841.89 }; // A4 portrait
  let page = pdf.addPage([PAGE.w, PAGE.h]);
  const margin = 36;
  let y = PAGE.h - margin;

  const drawText = (t: string, opt?: { size?: number; bold?: boolean; color?: number[] }) => {
    const size = opt?.size ?? 12; const f = opt?.bold ? bold : font; const color = opt?.color ? rgb(opt.color[0], opt.color[1], opt.color[2]) : rgb(0,0,0);
    page.drawText(t, { x: margin, y: y - size, size, font: f, color }); y -= size + 6;
  };

  // Header
  drawText(`Batch History — ${data.batch.batchNumber ?? data.batch.id}`, { size: 16, bold: true });
  drawText(`${data.batch.variety ?? data.batch.plantName ?? ""} • Qty: ${data.batch.quantity ?? "-"}`, { size: 11 });
  y -= 6;

  // Flowchart layout (server)
  const nodes = data.graph.nodes.map(n => ({ id: n.id, width: 200, height: 80, labels: [{ text: n.label }] }));
  const edges = data.graph.edges.map(e => ({ id: e.id, sources: [e.from], targets: [e.to], labels: e.label ? [{ text: e.label }] : [] }));
  // Build graph object for ELK
  const graphInput = { id: "root", children: nodes, edges };
  const layout = await layoutGraph(graphInput);
  const children = layout.children ?? [];

  // Draw flowchart
  const ox = margin - Math.min(...children.map((c:any)=>c.x||0)) + 0;
  let oy = y - 20 - Math.min(...children.map((c:any)=>c.y||0));

  // reserve approx height
  const flowH = Math.max(...children.map((c:any)=>(c.y||0)+(c.height||0))) + 20;
  if (y - flowH < margin + 200) { page = pdf.addPage([PAGE.w, PAGE.h]); y = PAGE.h - margin; oy = y - 20; }

  // edges
  for (const e of (layout.edges ?? []) as any[]) {
    for (const s of e.sections || []) {
      page.drawLine({ start: { x: ox + s.startPoint.x, y: oy - s.startPoint.y }, end: { x: ox + s.endPoint.x, y: oy - s.endPoint.y }, thickness: 1, color: rgb(0.5,0.5,0.5) });
      if (e.labels?.[0]?.text) {
        page.drawText(e.labels[0].text, { x: ox + (s.startPoint.x + s.endPoint.x)/2, y: oy - (s.startPoint.y + s.endPoint.y)/2 + 6, size: 9, font, color: rgb(0.3,0.3,0.3) });
      }
    }
  }
  // nodes
  for (const n of children as any[]) {
    const x = ox + (n.x||0), yy = oy - (n.y||0);
    page.drawRectangle({ x, y: yy - (n.height ?? 0), width: n.width ?? 0, height: n.height ?? 0, borderColor: rgb(0.35,0.35,0.35), borderWidth: 1, color: rgb(1,1,1) });
    const node = data.graph.nodes.find(z => z.id === n.id)!;
    page.drawText(n.labels?.[0]?.text || node.label, { x: x+8, y: yy - 18, size: 11, font: bold });
    let line = yy - 32;
    if (node.stageName) { page.drawText(node.stageName, { x: x+8, y: line, size: 10, font }); line -= 12; }
    if (node.locationName) { page.drawText(node.locationName, { x: x+8, y: line, size: 10, font }); line -= 12; }
    if (node.start) { page.drawText(`Start: ${node.start.slice(0,10)}`, { x: x+8, y: line, size: 9, font, color: rgb(0.25,0.25,0.25) }); line -= 12; }
    if (node.end)   { page.drawText(`End: ${node.end.slice(0,10)}`, { x: x+8, y: line, size: 9, font, color: rgb(0.25,0.25,0.25) }); line -= 12; }
    if (node.durationDays != null) { page.drawText(`⏱ ${node.durationDays} days`, { x: x+8, y: line, size: 10, font }); }
  }
  y -= (flowH + 24);

  // Action log summary
  drawText("Action Log (summary)", { size: 14, bold: true });
  const rows = data.logs.slice(0, 80); // keep PDF lightweight
  for (const l of rows) {
    const line = `${new Date(l.at).toISOString().slice(0,16).replace("T"," ")} • ${l.type} — ${l.title}${l.userName ? ` (by ${l.userName})` : ""}${l.details ? `: ${l.details}` : ""}`;
    const chunks = wrap(line, 95);
    for (const c of chunks) {
      if (y < margin + 20) { page = pdf.addPage([PAGE.w, PAGE.h]); y = PAGE.h - margin; }
      page.drawText("• " + c, { x: margin, y: y - 12, size: 10, font }); y -= 14;
    }
  }
  if (data.logs.length > rows.length) {
    if (y < margin + 20) { page = pdf.addPage([PAGE.w, PAGE.h]); y = PAGE.h - margin; }
    page.drawText(`(+ ${data.logs.length - rows.length} more entries)`, { x: margin, y: y - 12, size: 10, font, color: rgb(0.4,0.4,0.4) });
  }

  return await pdf.save();
}

function wrap(s: string, max: number) {
  const words = s.split(/\s+/); const out: string[] = []; let line = "";
  for (const w of words) { const t = (line ? line + " " : "") + w; if (t.length > max) { if (line) out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}
