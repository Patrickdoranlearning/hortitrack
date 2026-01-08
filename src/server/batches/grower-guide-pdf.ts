import { PDFDocument, StandardFonts, rgb, PDFPage, PDFFont } from "pdf-lib";
import type { GrowerGuide, WeekSummary, TimelineAction, TimelineHighlight, AncestorBatch, StageSummary } from "./grower-guide";

const PAGE = { w: 595.28, h: 841.89 }; // A4 portrait
const MARGIN = 40;
const CONTENT_WIDTH = PAGE.w - 2 * MARGIN;

// Bright, modern color palette
const COLORS = {
  // Primary colors
  primary: rgb(0.063, 0.725, 0.506),     // #10B981 Emerald
  secondary: rgb(0.2, 0.2, 0.2),
  muted: rgb(0.45, 0.45, 0.45),
  light: rgb(0.85, 0.85, 0.85),
  veryLight: rgb(0.96, 0.98, 0.96),
  white: rgb(1, 1, 1),
  black: rgb(0, 0, 0),
  // Category colors (bright & modern)
  milestone: rgb(0.063, 0.725, 0.506),   // #10B981 Emerald
  care: rgb(0.545, 0.361, 0.965),        // #8B5CF6 Violet
  treatment: rgb(0.055, 0.647, 0.914),   // #0EA5E9 Sky Blue
  movement: rgb(0.961, 0.620, 0.043),    // #F59E0B Amber
  other: rgb(0.5, 0.5, 0.5),
  // Accent colors
  orange: rgb(0.976, 0.451, 0.086),      // #F97316 Bright Orange
  yellow: rgb(0.918, 0.702, 0.031),      // #EAB308 Deep Yellow
  // Softer background variants
  emeraldBg: rgb(0.925, 0.98, 0.961),    // Light emerald background
  violetBg: rgb(0.96, 0.94, 0.99),       // Light violet background
  skyBg: rgb(0.94, 0.97, 1),             // Light sky blue background
  amberBg: rgb(1, 0.98, 0.94),           // Light amber background
};

type PDFContext = {
  pdf: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  bold: PDFFont;
  y: number;
  pageNum: number;
};

export async function renderGrowerGuidePdf(data: GrowerGuide): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ctx: PDFContext = {
    pdf,
    page: pdf.addPage([PAGE.w, PAGE.h]),
    font,
    bold,
    y: PAGE.h - MARGIN,
    pageNum: 1,
  };

  const ensureSpace = (needed: number) => {
    if (ctx.y - needed < MARGIN + 20) {
      addFooter(ctx, data);
      ctx.page = ctx.pdf.addPage([PAGE.w, PAGE.h]);
      ctx.y = PAGE.h - MARGIN;
      ctx.pageNum++;
    }
  };

  const drawText = (
    text: string,
    opts?: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      x?: number;
      maxWidth?: number;
    }
  ) => {
    const size = opts?.size ?? 10;
    const f = opts?.bold ? ctx.bold : ctx.font;
    const color = opts?.color ?? COLORS.black;
    const x = opts?.x ?? MARGIN;
    const maxWidth = opts?.maxWidth ?? CONTENT_WIDTH;

    const lines = wrapText(text, f, size, maxWidth);
    for (const line of lines) {
      ensureSpace(size + 3);
      ctx.page.drawText(line, { x, y: ctx.y - size, size, font: f, color });
      ctx.y -= size + 3;
    }
  };

  const drawSectionHeader = (title: string) => {
    ensureSpace(30);
    ctx.y -= 8;
    ctx.page.drawRectangle({
      x: MARGIN,
      y: ctx.y - 18,
      width: CONTENT_WIDTH,
      height: 18,
      color: COLORS.primary,
    });
    ctx.page.drawText(title.toUpperCase(), {
      x: MARGIN + 8,
      y: ctx.y - 14,
      size: 10,
      font: ctx.bold,
      color: COLORS.white,
    });
    ctx.y -= 26;
  };

  const drawDivider = () => {
    ensureSpace(12);
    ctx.page.drawLine({
      start: { x: MARGIN, y: ctx.y - 6 },
      end: { x: PAGE.w - MARGIN, y: ctx.y - 6 },
      thickness: 0.5,
      color: COLORS.light,
    });
    ctx.y -= 12;
  };

  // ============ HEADER ============
  drawText("GROWER GUIDE", { size: 22, bold: true, color: COLORS.primary });
  ctx.y -= 4;

  const batchLabel = data.batch.batchNumber
    ? `Batch #${data.batch.batchNumber}`
    : `Batch ${data.batch.id.slice(0, 8)}`;

  // Main batch info line
  const headerParts = [batchLabel];
  if (data.batch.variety) headerParts.push(data.batch.variety);
  if (data.batch.size) headerParts.push(data.batch.size);
  drawText(headerParts.join("  |  "), { size: 12, bold: true });

  // Stats line
  const statsParts: string[] = [];
  if (data.originWeekYear) statsParts.push(`Origin: ${data.originWeekYear}`);
  if (data.totalWeeks > 0) statsParts.push(`${data.totalWeeks} weeks growing`);
  if (data.batch.quantity) statsParts.push(`Qty: ${data.batch.quantity}`);
  if (data.batch.status) statsParts.push(data.batch.status);
  if (statsParts.length > 0) {
    drawText(statsParts.join("  |  "), { size: 9, color: COLORS.muted });
  }

  ctx.y -= 4;
  drawText(`Generated: ${new Date(data.generatedAt).toLocaleDateString('en-GB')}`, {
    size: 8,
    color: COLORS.muted,
  });

  // ============ TIMELINE 1: HIGHLIGHTS/OVERVIEW ============
  if (data.highlights.length > 0) {
    drawSectionHeader("Timeline Overview");

    // Draw highlight timeline as a horizontal flow
    ensureSpace(50);
    const boxY = ctx.y;

    ctx.page.drawRectangle({
      x: MARGIN,
      y: boxY - 45,
      width: CONTENT_WIDTH,
      height: 45,
      color: COLORS.veryLight,
      borderColor: COLORS.light,
      borderWidth: 1,
    });

    // Draw timeline line
    ctx.page.drawLine({
      start: { x: MARGIN + 20, y: boxY - 22 },
      end: { x: PAGE.w - MARGIN - 20, y: boxY - 22 },
      thickness: 2,
      color: COLORS.primary,
    });

    // Position highlights along the line
    const highlightCount = Math.min(data.highlights.length, 6); // Max 6 to fit
    const spacing = (CONTENT_WIDTH - 40) / Math.max(highlightCount - 1, 1);

    for (let i = 0; i < highlightCount; i++) {
      const h = data.highlights[i];
      const x = MARGIN + 20 + (i * spacing);

      // Dot on timeline
      ctx.page.drawCircle({
        x,
        y: boxY - 22,
        size: 5,
        color: getHighlightColor(h.type),
      });

      // Week/year above
      ctx.page.drawText(h.weekYear, {
        x: x - 12,
        y: boxY - 12,
        size: 8,
        font: ctx.bold,
        color: COLORS.primary,
      });

      // Title below (truncated)
      const shortTitle = truncateText(h.title.replace(/^(Origin:|Started:|Treatment:|Transplant to)\s*/i, ''), 12);
      ctx.page.drawText(shortTitle, {
        x: x - 20,
        y: boxY - 38,
        size: 7,
        font: ctx.font,
        color: COLORS.secondary,
      });
    }

    ctx.y = boxY - 52;

    // List all highlights
    for (const h of data.highlights) {
      ensureSpace(14);
      const color = getHighlightColor(h.type);

      ctx.page.drawCircle({
        x: MARGIN + 6,
        y: ctx.y - 5,
        size: 3,
        color,
      });

      const batchRef = h.generation > 0 && h.batchNumber ? ` [#${h.batchNumber}]` : '';
      ctx.page.drawText(`${h.weekYear}`, {
        x: MARGIN + 14,
        y: ctx.y - 8,
        size: 9,
        font: ctx.bold,
        color: COLORS.primary,
      });
      ctx.page.drawText(`${h.title}${batchRef}`, {
        x: MARGIN + 50,
        y: ctx.y - 8,
        size: 9,
        font: ctx.font,
        color: COLORS.secondary,
      });
      ctx.y -= 14;
    }
  }

  // ============ LINEAGE OVERVIEW ============
  if (data.ancestors.length > 0 || data.batch.batchNumber) {
    drawSectionHeader("Lineage Overview");

    // Build lineage data from ancestors (oldest first) + current batch
    const lineageBatches = [
      ...data.ancestors.slice().reverse(),
      {
        id: data.batch.id,
        batchNumber: data.batch.batchNumber,
        size: data.batch.size,
        quantity: data.batch.quantity,
        weekYear: data.batch.weekYear,
        generation: 0,
      },
    ];

    ensureSpace(55);
    const boxY = ctx.y;
    const boxHeight = 50;
    const boxWidth = Math.min(110, (CONTENT_WIDTH - (lineageBatches.length - 1) * 20) / lineageBatches.length);
    const totalWidth = lineageBatches.length * boxWidth + (lineageBatches.length - 1) * 20;
    const startX = MARGIN + (CONTENT_WIDTH - totalWidth) / 2;

    for (let i = 0; i < lineageBatches.length; i++) {
      const b = lineageBatches[i];
      const x = startX + i * (boxWidth + 20);
      const isCurrent = b.generation === 0;

      // Box background
      ctx.page.drawRectangle({
        x,
        y: boxY - boxHeight,
        width: boxWidth,
        height: boxHeight,
        color: isCurrent ? COLORS.emeraldBg : COLORS.veryLight,
        borderColor: isCurrent ? COLORS.primary : COLORS.light,
        borderWidth: isCurrent ? 2 : 1,
      });

      // Week/Year badge at top
      const weekYear = b.weekYear ?? '?';
      ctx.page.drawRectangle({
        x: x,
        y: boxY - 13,
        width: boxWidth,
        height: 13,
        color: isCurrent ? COLORS.primary : COLORS.muted,
      });
      ctx.page.drawText(weekYear, {
        x: x + (boxWidth - ctx.bold.widthOfTextAtSize(weekYear, 9)) / 2,
        y: boxY - 10,
        size: 9,
        font: ctx.bold,
        color: COLORS.white,
      });

      // Batch number
      const bNum = b.batchNumber ? `#${b.batchNumber}` : '—';
      ctx.page.drawText(truncateText(bNum, 14), {
        x: x + 4,
        y: boxY - 25,
        size: 8,
        font: ctx.bold,
        color: COLORS.black,
      });

      // Size
      const size = b.size ?? '—';
      ctx.page.drawText(truncateText(size, 14), {
        x: x + 4,
        y: boxY - 36,
        size: 8,
        font: ctx.font,
        color: COLORS.secondary,
      });

      // Quantity
      const qty = b.quantity != null ? `${b.quantity} u` : '';
      ctx.page.drawText(qty, {
        x: x + 4,
        y: boxY - 47,
        size: 7,
        font: ctx.font,
        color: COLORS.muted,
      });

      // CURRENT label for current batch
      if (isCurrent) {
        ctx.page.drawText('CURRENT', {
          x: x + boxWidth - 38,
          y: boxY - 47,
          size: 6,
          font: ctx.bold,
          color: COLORS.primary,
        });
      }

      // Arrow to next (draw as line with arrowhead since → not in WinAnsi)
      if (i < lineageBatches.length - 1) {
        const arrowX = x + boxWidth + 3;
        const arrowY = boxY - 25;
        // Arrow line
        ctx.page.drawLine({
          start: { x: arrowX, y: arrowY },
          end: { x: arrowX + 14, y: arrowY },
          thickness: 2,
          color: COLORS.primary,
        });
        // Arrowhead
        ctx.page.drawLine({
          start: { x: arrowX + 10, y: arrowY + 4 },
          end: { x: arrowX + 14, y: arrowY },
          thickness: 2,
          color: COLORS.primary,
        });
        ctx.page.drawLine({
          start: { x: arrowX + 10, y: arrowY - 4 },
          end: { x: arrowX + 14, y: arrowY },
          thickness: 2,
          color: COLORS.primary,
        });
      }
    }

    ctx.y = boxY - boxHeight - 8;
  }

  // ============ STAGE SUMMARIES ============
  if (data.stageSummaries && data.stageSummaries.length > 0) {
    drawSectionHeader("Stage Summaries");

    for (const stage of data.stageSummaries) {
      renderStageSummary(ctx, stage, ensureSpace);
    }
  }

  // ============ DETAILED TIMELINE ============
  if (data.timeline.length > 0) {
    drawSectionHeader("Detailed Timeline");

    for (const week of data.timeline) {
      renderWeekSection(ctx, week, ensureSpace);
    }
  }

  // ============ PROTOCOL (if exists) ============
  if (data.protocol) {
    drawDivider();
    drawSectionHeader("Growing Protocol");

    drawText(data.protocol.name, { size: 11, bold: true });
    if (data.protocol.description) {
      drawText(data.protocol.description, { size: 9, color: COLORS.secondary });
    }

    // Compact targets
    if (data.protocol.targets) {
      const t = data.protocol.targets;
      const parts: string[] = [];
      if (t.tempC?.day != null) parts.push(`Day: ${t.tempC.day}°C`);
      if (t.tempC?.night != null) parts.push(`Night: ${t.tempC.night}°C`);
      if (t.humidityPct != null) parts.push(`Humidity: ${t.humidityPct}%`);
      if (t.lightHours != null) parts.push(`Light: ${t.lightHours}h`);
      if (t.ec != null) parts.push(`EC: ${t.ec}`);
      if (t.ph != null) parts.push(`pH: ${t.ph}`);
      if (parts.length > 0) {
        ctx.y -= 4;
        drawText(`Targets: ${parts.join(" | ")}`, { size: 9, color: COLORS.muted });
      }
    }

    if (data.protocol.recommendations.length > 0) {
      ctx.y -= 4;
      for (const rec of data.protocol.recommendations) {
        drawText(`• ${rec}`, { size: 9, x: MARGIN + 8 });
      }
    }
  }

  // Add final footer
  addFooter(ctx, data);

  return await pdf.save();
}

function renderWeekSection(
  ctx: PDFContext,
  week: WeekSummary,
  ensureSpace: (n: number) => void
) {
  ensureSpace(40);

  // Week header with week/year format
  const weekBoxY = ctx.y;

  // Week number badge
  ctx.page.drawRectangle({
    x: MARGIN,
    y: weekBoxY - 18,
    width: 55,
    height: 18,
    color: COLORS.primary,
  });
  ctx.page.drawText(`${week.weekYear}`, {
    x: MARGIN + 8,
    y: weekBoxY - 13,
    size: 10,
    font: ctx.bold,
    color: COLORS.white,
  });

  // Date range
  ctx.page.drawText(formatDateRange(week.weekStart, week.weekEnd), {
    x: MARGIN + 62,
    y: weekBoxY - 13,
    size: 8,
    font: ctx.font,
    color: COLORS.muted,
  });

  ctx.y = weekBoxY - 24;

  // Group actions by category
  const groupedActions = groupByCategory(week.actions);

  for (const [category, actions] of Object.entries(groupedActions)) {
    if (actions.length === 0) continue;

    for (const action of actions) {
      renderDetailedAction(ctx, action, ensureSpace);
    }
  }

  ctx.y -= 6;
}

function renderDetailedAction(
  ctx: PDFContext,
  action: TimelineAction,
  ensureSpace: (n: number) => void
) {
  ensureSpace(24);

  const color = getCategoryColor(action.category);
  const isAncestor = action.generation > 0;

  // Category indicator bar
  ctx.page.drawRectangle({
    x: MARGIN + 4,
    y: ctx.y - 14,
    width: 3,
    height: 14,
    color,
  });

  // Title
  ctx.page.drawText(action.title, {
    x: MARGIN + 12,
    y: ctx.y - 10,
    size: 9,
    font: ctx.bold,
    color: COLORS.black,
  });

  // Batch reference (if ancestor)
  let xOffset = MARGIN + 12 + ctx.font.widthOfTextAtSize(action.title, 9) + 8;
  if (isAncestor && action.batchNumber) {
    ctx.page.drawText(`[#${action.batchNumber}]`, {
      x: xOffset,
      y: ctx.y - 10,
      size: 8,
      font: ctx.font,
      color: COLORS.movement,
    });
    xOffset += ctx.font.widthOfTextAtSize(`[#${action.batchNumber}]`, 8) + 8;
  }

  ctx.y -= 16;

  // Details line
  const detailParts: string[] = [];

  // Add specific details based on action type
  if (action.product) detailParts.push(`Product: ${action.product}`);
  if (action.rate) detailParts.push(`Rate: ${action.rate}`);
  if (action.method) detailParts.push(`Method: ${action.method}`);
  if (action.toLocation) detailParts.push(`> ${action.toLocation}`);
  if (action.details && !detailParts.includes(action.details)) {
    detailParts.push(action.details);
  }

  if (detailParts.length > 0) {
    ensureSpace(12);
    const detailText = detailParts.join(" | ");
    const lines = wrapText(detailText, ctx.font, 8, CONTENT_WIDTH - 20);
    for (const line of lines) {
      ctx.page.drawText(line, {
        x: MARGIN + 12,
        y: ctx.y - 8,
        size: 8,
        font: ctx.font,
        color: COLORS.muted,
      });
      ctx.y -= 10;
    }
  }

  ctx.y -= 2;
}

function renderStageSummary(
  ctx: PDFContext,
  stage: StageSummary,
  ensureSpace: (n: number) => void
) {
  // Calculate needed space: header + treatment table + care table
  const hasTreatments = stage.treatments.length > 0;
  const hasCare = stage.careActivities.length > 0;
  const headerHeight = 24;
  const tableHeaderHeight = 16;
  const rowHeight = 14;
  const treatmentHeight = hasTreatments ? tableHeaderHeight + stage.treatments.length * rowHeight + 8 : 0;
  const careHeight = hasCare ? tableHeaderHeight + stage.careActivities.length * rowHeight + 8 : 0;
  const minNeeded = headerHeight + Math.max(20, treatmentHeight + careHeight);

  ensureSpace(minNeeded);

  // Stage header bar
  const headerY = ctx.y;
  const weekRange = stage.startWeekYear && stage.endWeekYear && stage.startWeekYear !== stage.endWeekYear
    ? `Weeks ${stage.startWeekYear} - ${stage.endWeekYear}`
    : stage.startWeekYear ? `Week ${stage.startWeekYear}` : '';

  const stageLabel = stage.isCurrent ? 'CURRENT STAGE' : `STAGE ${stage.generation}`;
  const batchLabel = stage.batchNumber ? `#${stage.batchNumber}` : '';
  const sizeLabel = stage.size ?? '';

  // Draw header background with left accent bar
  ctx.page.drawRectangle({
    x: MARGIN,
    y: headerY - 20,
    width: 4,
    height: 20,
    color: stage.isCurrent ? COLORS.primary : COLORS.muted,
  });
  ctx.page.drawRectangle({
    x: MARGIN + 4,
    y: headerY - 20,
    width: CONTENT_WIDTH - 4,
    height: 20,
    color: stage.isCurrent ? COLORS.emeraldBg : COLORS.veryLight,
  });

  // Header text
  ctx.page.drawText(`${batchLabel} - ${sizeLabel}`, {
    x: MARGIN + 10,
    y: headerY - 14,
    size: 10,
    font: ctx.bold,
    color: COLORS.black,
  });

  ctx.page.drawText(weekRange, {
    x: MARGIN + 150,
    y: headerY - 14,
    size: 9,
    font: ctx.font,
    color: COLORS.muted,
  });

  if (stage.isCurrent) {
    ctx.page.drawText(stageLabel, {
      x: PAGE.w - MARGIN - 70,
      y: headerY - 14,
      size: 8,
      font: ctx.bold,
      color: COLORS.primary,
    });
  }

  ctx.y = headerY - 26;

  // TREATMENTS TABLE
  if (hasTreatments) {
    ensureSpace(tableHeaderHeight + stage.treatments.length * rowHeight + 8);

    // Treatments label with sky blue accent
    ctx.page.drawRectangle({
      x: MARGIN + 8,
      y: ctx.y - 12,
      width: 3,
      height: 12,
      color: COLORS.treatment,
    });
    ctx.page.drawText('TREATMENTS', {
      x: MARGIN + 16,
      y: ctx.y - 10,
      size: 8,
      font: ctx.bold,
      color: COLORS.treatment,
    });
    ctx.y -= 16;

    // Table header
    const colWidths = { week: 50, product: 150, rate: 80, method: 100 };
    let colX = MARGIN + 16;

    ctx.page.drawRectangle({
      x: MARGIN + 12,
      y: ctx.y - 12,
      width: CONTENT_WIDTH - 24,
      height: 12,
      color: COLORS.skyBg,
    });

    ctx.page.drawText('Week', { x: colX, y: ctx.y - 9, size: 7, font: ctx.bold, color: COLORS.secondary });
    colX += colWidths.week;
    ctx.page.drawText('Product', { x: colX, y: ctx.y - 9, size: 7, font: ctx.bold, color: COLORS.secondary });
    colX += colWidths.product;
    ctx.page.drawText('Rate', { x: colX, y: ctx.y - 9, size: 7, font: ctx.bold, color: COLORS.secondary });
    colX += colWidths.rate;
    ctx.page.drawText('Method', { x: colX, y: ctx.y - 9, size: 7, font: ctx.bold, color: COLORS.secondary });

    ctx.y -= 14;

    // Table rows
    for (const t of stage.treatments) {
      colX = MARGIN + 16;
      ctx.page.drawText(t.weekYear, { x: colX, y: ctx.y - 10, size: 8, font: ctx.font, color: COLORS.black });
      colX += colWidths.week;
      ctx.page.drawText(truncateText(t.product, 25), { x: colX, y: ctx.y - 10, size: 8, font: ctx.font, color: COLORS.black });
      colX += colWidths.product;
      ctx.page.drawText(t.rate ?? '—', { x: colX, y: ctx.y - 10, size: 8, font: ctx.font, color: COLORS.muted });
      colX += colWidths.rate;
      ctx.page.drawText(t.method ?? '—', { x: colX, y: ctx.y - 10, size: 8, font: ctx.font, color: COLORS.muted });
      ctx.y -= rowHeight;
    }

    ctx.y -= 4;
  }

  // CARE ACTIVITIES TABLE
  if (hasCare) {
    ensureSpace(tableHeaderHeight + stage.careActivities.length * rowHeight + 8);

    // Care label with violet accent
    ctx.page.drawRectangle({
      x: MARGIN + 8,
      y: ctx.y - 12,
      width: 3,
      height: 12,
      color: COLORS.care,
    });
    ctx.page.drawText('CARE ACTIVITIES', {
      x: MARGIN + 16,
      y: ctx.y - 10,
      size: 8,
      font: ctx.bold,
      color: COLORS.care,
    });
    ctx.y -= 16;

    // Table header
    const careColWidths = { week: 50, activity: 130, details: 200 };
    let colX = MARGIN + 16;

    ctx.page.drawRectangle({
      x: MARGIN + 12,
      y: ctx.y - 12,
      width: CONTENT_WIDTH - 24,
      height: 12,
      color: COLORS.violetBg,
    });

    ctx.page.drawText('Week', { x: colX, y: ctx.y - 9, size: 7, font: ctx.bold, color: COLORS.secondary });
    colX += careColWidths.week;
    ctx.page.drawText('Activity', { x: colX, y: ctx.y - 9, size: 7, font: ctx.bold, color: COLORS.secondary });
    colX += careColWidths.activity;
    ctx.page.drawText('Details', { x: colX, y: ctx.y - 9, size: 7, font: ctx.bold, color: COLORS.secondary });

    ctx.y -= 14;

    // Table rows
    for (const c of stage.careActivities) {
      colX = MARGIN + 16;
      ctx.page.drawText(c.weekYear, { x: colX, y: ctx.y - 10, size: 8, font: ctx.font, color: COLORS.black });
      colX += careColWidths.week;
      ctx.page.drawText(truncateText(c.activity, 20), { x: colX, y: ctx.y - 10, size: 8, font: ctx.font, color: COLORS.black });
      colX += careColWidths.activity;
      ctx.page.drawText(truncateText(c.details ?? '—', 35), { x: colX, y: ctx.y - 10, size: 8, font: ctx.font, color: COLORS.muted });
      ctx.y -= rowHeight;
    }

    ctx.y -= 4;
  }

  // Empty state message
  if (!hasTreatments && !hasCare) {
    ctx.page.drawText('No recorded activities for this stage', {
      x: MARGIN + 16,
      y: ctx.y - 10,
      size: 8,
      font: ctx.font,
      color: COLORS.muted,
    });
    ctx.y -= 16;
  }

  ctx.y -= 8;
}

function addFooter(ctx: PDFContext, data: GrowerGuide) {
  const batchLabel = data.batch.batchNumber
    ? `#${data.batch.batchNumber}`
    : data.batch.id.slice(0, 8);

  ctx.page.drawLine({
    start: { x: MARGIN, y: MARGIN },
    end: { x: PAGE.w - MARGIN, y: MARGIN },
    thickness: 0.5,
    color: COLORS.light,
  });

  ctx.page.drawText(`HortiTrack Grower Guide - Batch ${batchLabel}`, {
    x: MARGIN,
    y: MARGIN - 12,
    size: 7,
    font: ctx.font,
    color: COLORS.muted,
  });

  ctx.page.drawText(`Page ${ctx.pageNum}`, {
    x: PAGE.w - MARGIN - 35,
    y: MARGIN - 12,
    size: 7,
    font: ctx.font,
    color: COLORS.muted,
  });
}

function getHighlightColor(type: TimelineHighlight['type']): ReturnType<typeof rgb> {
  switch (type) {
    case 'origin': return COLORS.milestone;
    case 'transplant': return COLORS.movement;
    case 'treatment': return COLORS.treatment;
    case 'ready': return COLORS.primary;
    default: return COLORS.muted;
  }
}

function getCategoryColor(category: TimelineAction['category']): ReturnType<typeof rgb> {
  switch (category) {
    case 'milestone': return COLORS.milestone;
    case 'care': return COLORS.care;
    case 'treatment': return COLORS.treatment;
    case 'movement': return COLORS.movement;
    default: return COLORS.other;
  }
}

function groupByCategory(actions: TimelineAction[]): Record<string, TimelineAction[]> {
  const groups: Record<string, TimelineAction[]> = {
    milestone: [],
    movement: [],
    care: [],
    treatment: [],
    other: [],
  };

  for (const action of actions) {
    groups[action.category].push(action);
  }

  return groups;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  return `${fmt(s)} - ${fmt(e)}`;
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (text: string, size: number) => number },
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, size);

    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
}
