'use server';

import { getSupabaseAdmin } from "@/server/db/supabase";
import { isValidDocId } from "@/server/utils/ids";

export type GrowerGuideTargets = {
  tempC: { day: number | null; night: number | null } | null;
  humidityPct: number | null;
  lightHours: number | null;
  ec: number | null;
  ph: number | null;
  spacing: number | string | null;
};

export type AncestorBatch = {
  id: string;
  batchNumber: string | null;
  variety: string | null;
  size: string | null;
  location: string | null;
  phase: string | null;
  plantedAt: string | null;
  quantity: number | null;
  generation: number; // 0 = current batch, 1 = parent, 2 = grandparent, etc.
  weekYear: string | null; // e.g., "30/25" for week 30 of 2025
};

export type TimelineAction = {
  week: number;
  weekYear: string; // e.g., "30/25"
  date: string;
  type: string;
  category: 'milestone' | 'care' | 'treatment' | 'movement' | 'other';
  title: string;
  details: string | null;
  batchNumber: string | null;
  batchId: string;
  generation: number;
  // For treatments/sprays
  product: string | null;
  rate: string | null;
  method: string | null;
  // Location info for movements
  fromLocation: string | null;
  toLocation: string | null;
};

export type WeekSummary = {
  week: number;
  weekYear: string; // e.g., "30/25"
  weekStart: string;
  weekEnd: string;
  actions: TimelineAction[];
};

export type TimelineHighlight = {
  weekYear: string;
  type: 'origin' | 'transplant' | 'ready' | 'treatment' | 'milestone';
  title: string;
  batchNumber: string | null;
  generation: number;
};

export type StageTreatment = {
  weekYear: string;
  product: string;
  rate: string | null;
  method: string | null;
  details: string | null;
};

export type StageCareActivity = {
  weekYear: string;
  activity: string;
  details: string | null;
};

export type StageSummary = {
  batchId: string;
  batchNumber: string | null;
  size: string | null;
  startWeekYear: string | null;
  endWeekYear: string | null;
  generation: number;
  quantity: number | null;
  isCurrent: boolean;
  treatments: StageTreatment[];
  careActivities: StageCareActivity[];
};

export type GrowerGuide = {
  batch: {
    id: string;
    batchNumber: string | null;
    variety: string | null;
    family: string | null;
    size: string | null;
    location: string | null;
    quantity: number | null;
    plantedAt: string | null;
    readyAt: string | null;
    status: string | null;
    phase: string | null;
    weekYear: string | null; // Current batch week/year
  };
  ancestors: AncestorBatch[];
  stageSummaries: StageSummary[]; // Per-batch treatment & care summaries
  highlights: TimelineHighlight[]; // Timeline 1: Overview
  timeline: WeekSummary[]; // Timeline 2: Detailed
  originDate: string | null;
  originWeekYear: string | null;
  totalWeeks: number;
  protocol: {
    id: string;
    name: string;
    description: string | null;
    summary: string | null;
    targets: GrowerGuideTargets | null;
    recommendations: string[];
  } | null;
  generatedAt: string;
};

type BatchRow = {
  id: string;
  batch_number: string | null;
  quantity: number | null;
  status: string | null;
  phase: string | null;
  planted_at: string | null;
  ready_at: string | null;
  created_at: string | null;
  protocol_id: string | null;
  parent_batch_id: string | null;
  plant_varieties?: { name: string | null; category: string | null } | null;
  plant_sizes?: { name: string | null } | null;
  nursery_locations?: { name: string | null } | null;
};

type EventRow = {
  id: string;
  type: string | null;
  at: string | null;
  payload: unknown;
};

type HealthLogRow = {
  id: string;
  event_type: string | null;
  event_at: string | null;
  title: string | null;
  notes: string | null;
  product_name: string | null;
  rate: number | null;
  unit: string | null;
  method: string | null;
  reason_for_use: string | null;
};

type ProtocolRow = {
  id: string;
  name: string;
  description: string | null;
  definition: Record<string, unknown> | null;
  route: Record<string, unknown> | null;
};

// ============ WEEK/YEAR FORMATTING ============

function getISOWeekYear(date: Date): { week: number; year: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year: d.getFullYear() };
}

function formatWeekYear(date: Date | string | null): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  const { week, year } = getISOWeekYear(d);
  return `${week}/${String(year).slice(-2)}`; // e.g., "30/25"
}

function formatWeekYearFull(date: Date | string | null): string | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  const { week, year } = getISOWeekYear(d);
  return `Week ${week}, ${year}`; // e.g., "Week 30, 2025"
}

// ============ MAIN BUILDER ============

export async function buildGrowerGuide(batchId: string): Promise<GrowerGuide> {
  if (!isValidDocId(batchId)) {
    throw new Error("Invalid batch ID provided.");
  }

  const supabase = getSupabaseAdmin();

  // Fetch current batch with related data
  const currentBatch = await fetchBatch(supabase, batchId);
  if (!currentBatch) throw new Error("Batch not found");

  // Fetch full ancestor chain
  const ancestors = await fetchAncestorChain(supabase, currentBatch);

  // Collect all batch IDs (current + ancestors)
  const allBatchIds = [currentBatch.id, ...ancestors.map(a => a.id)];

  // Fetch all events and health logs for entire lineage
  const [allEvents, allHealthLogs] = await Promise.all([
    fetchEventsForBatches(supabase, allBatchIds),
    fetchHealthLogsForBatches(supabase, allBatchIds),
  ]);

  // Build batch lookup for generation info
  const batchLookup = new Map<string, { batchNumber: string | null; generation: number }>();
  batchLookup.set(currentBatch.id, { batchNumber: currentBatch.batch_number, generation: 0 });
  ancestors.forEach(a => batchLookup.set(a.id, { batchNumber: a.batchNumber, generation: a.generation }));

  // Find the origin date (earliest planted_at or created_at across lineage)
  const originDate = findOriginDate(currentBatch, ancestors);

  // Build timeline actions from events and health logs
  const actions = buildTimelineActions(allEvents, allHealthLogs, batchLookup, originDate);

  // Group actions by week (Timeline 2: Detailed)
  const timeline = groupActionsByWeek(actions, originDate);

  // Build highlights (Timeline 1: Overview)
  const highlights = buildHighlights(currentBatch, ancestors, actions);

  // Build stage summaries (per-batch treatments & care activities)
  const stageSummaries = buildStageSummaries(currentBatch, ancestors, actions);

  // Calculate total weeks
  const totalWeeks = timeline.length > 0 ? Math.max(...timeline.map(w => w.week)) + 1 : 0;

  // Fetch protocol if batch has one assigned
  let protocol: GrowerGuide["protocol"] = null;
  if (currentBatch.protocol_id) {
    const { data: protocolData } = await supabase
      .from("protocols")
      .select("id, name, description, definition, route")
      .eq("id", currentBatch.protocol_id)
      .maybeSingle();

    if (protocolData) {
      protocol = parseProtocol(protocolData as ProtocolRow);
    }
  }

  return {
    batch: {
      id: currentBatch.id,
      batchNumber: currentBatch.batch_number,
      variety: currentBatch.plant_varieties?.name ?? null,
      family: currentBatch.plant_varieties?.category ?? null,
      size: currentBatch.plant_sizes?.name ?? null,
      location: currentBatch.nursery_locations?.name ?? null,
      quantity: currentBatch.quantity,
      plantedAt: currentBatch.planted_at,
      readyAt: currentBatch.ready_at,
      status: currentBatch.status,
      phase: currentBatch.phase,
      weekYear: formatWeekYear(currentBatch.planted_at ?? currentBatch.created_at),
    },
    ancestors: ancestors.map(a => ({
      id: a.id,
      batchNumber: a.batchNumber,
      variety: a.variety,
      size: a.size,
      location: a.location,
      phase: a.phase,
      plantedAt: a.plantedAt,
      quantity: a.quantity,
      generation: a.generation,
      weekYear: formatWeekYear(a.plantedAt),
    })),
    stageSummaries,
    highlights,
    timeline,
    originDate,
    originWeekYear: formatWeekYear(originDate),
    totalWeeks,
    protocol,
    generatedAt: new Date().toISOString(),
  };
}

// ============ DATA FETCHERS ============

async function fetchBatch(supabase: ReturnType<typeof getSupabaseAdmin>, id: string): Promise<BatchRow | null> {
  const { data, error } = await supabase
    .from("batches")
    .select(`
      id,
      batch_number,
      quantity,
      status,
      phase,
      planted_at,
      ready_at,
      created_at,
      protocol_id,
      parent_batch_id,
      plant_varieties(name, category),
      plant_sizes(name),
      nursery_locations(name)
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as BatchRow | null;
}

async function fetchAncestorChain(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  batch: BatchRow
): Promise<(AncestorBatch & { id: string })[]> {
  const ancestors: (AncestorBatch & { id: string })[] = [];
  let currentParentId = batch.parent_batch_id;
  let generation = 1;

  // Walk up the parent chain (limit to 20 to prevent infinite loops)
  while (currentParentId && generation <= 20) {
    const parent = await fetchBatch(supabase, currentParentId);
    if (!parent) break;

    ancestors.push({
      id: parent.id,
      batchNumber: parent.batch_number,
      variety: parent.plant_varieties?.name ?? null,
      size: parent.plant_sizes?.name ?? null,
      location: parent.nursery_locations?.name ?? null,
      phase: parent.phase,
      plantedAt: parent.planted_at,
      quantity: parent.quantity,
      generation,
      weekYear: formatWeekYear(parent.planted_at),
    });

    currentParentId = parent.parent_batch_id;
    generation++;
  }

  return ancestors;
}

async function fetchEventsForBatches(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  batchIds: string[]
): Promise<(EventRow & { batch_id: string })[]> {
  const { data, error } = await supabase
    .from("batch_events")
    .select("id, batch_id, type, at, payload")
    .in("batch_id", batchIds)
    .order("at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as (EventRow & { batch_id: string })[];
}

async function fetchHealthLogsForBatches(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  batchIds: string[]
): Promise<(HealthLogRow & { batch_id: string })[]> {
  const { data, error } = await supabase
    .from("plant_health_logs")
    .select(`
      id,
      batch_id,
      event_type,
      event_at,
      title,
      notes,
      product_name,
      rate,
      unit,
      method,
      reason_for_use
    `)
    .in("batch_id", batchIds)
    .order("event_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as (HealthLogRow & { batch_id: string })[];
}

function findOriginDate(batch: BatchRow, ancestors: AncestorBatch[]): string | null {
  const dates: Date[] = [];

  // Add current batch dates
  if (batch.planted_at) dates.push(new Date(batch.planted_at));
  if (batch.created_at) dates.push(new Date(batch.created_at));

  // Add ancestor dates
  for (const ancestor of ancestors) {
    if (ancestor.plantedAt) dates.push(new Date(ancestor.plantedAt));
  }

  if (dates.length === 0) return null;

  // Return earliest date
  const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
  return earliest.toISOString();
}

// ============ HIGHLIGHTS BUILDER (Timeline 1) ============

function buildHighlights(
  batch: BatchRow,
  ancestors: AncestorBatch[],
  actions: TimelineAction[]
): TimelineHighlight[] {
  const highlights: TimelineHighlight[] = [];

  // Add origin batch start
  const allBatches = [...ancestors].reverse(); // Oldest first
  if (allBatches.length > 0) {
    const oldest = allBatches[0];
    if (oldest.plantedAt) {
      highlights.push({
        weekYear: formatWeekYear(oldest.plantedAt) ?? '?',
        type: 'origin',
        title: `Origin: ${oldest.size ?? 'Propagation'} started`,
        batchNumber: oldest.batchNumber,
        generation: oldest.generation,
      });
    }
  } else if (batch.planted_at) {
    highlights.push({
      weekYear: formatWeekYear(batch.planted_at) ?? '?',
      type: 'origin',
      title: `Started: ${batch.phase ?? 'Propagation'}`,
      batchNumber: batch.batch_number,
      generation: 0,
    });
  }

  // Add transplant milestones (when moving to larger sizes)
  for (const ancestor of allBatches) {
    const transplantAction = actions.find(
      a => a.batchId === ancestor.id &&
      (a.type === 'TRANSPLANT_OUT' || a.type === 'TRANSPLANT')
    );
    if (transplantAction) {
      highlights.push({
        weekYear: transplantAction.weekYear,
        type: 'transplant',
        title: `Transplant to ${ancestor.size ?? 'next stage'}`,
        batchNumber: ancestor.batchNumber,
        generation: ancestor.generation,
      });
    }
  }

  // Add current batch creation if transplanted in
  const currentTransplantIn = actions.find(
    a => a.batchId === batch.id && a.type === 'TRANSPLANT_IN'
  );
  if (currentTransplantIn) {
    highlights.push({
      weekYear: currentTransplantIn.weekYear,
      type: 'transplant',
      title: `Transplant to ${batch.plant_sizes?.name ?? batch.phase ?? 'current'}`,
      batchNumber: batch.batch_number,
      generation: 0,
    });
  }

  // Add significant treatments (first spray of each type)
  const treatmentTypes = new Set<string>();
  for (const action of actions) {
    if (action.type === 'SPRAY' || action.type === 'TREATMENT') {
      const key = action.product ?? action.title;
      if (!treatmentTypes.has(key)) {
        treatmentTypes.add(key);
        highlights.push({
          weekYear: action.weekYear,
          type: 'treatment',
          title: `Treatment: ${action.product ?? action.title}`,
          batchNumber: action.batchNumber,
          generation: action.generation,
        });
      }
    }
  }

  // Add ready/finished milestone if exists
  const readyAction = actions.find(a => a.type === 'READY');
  if (readyAction) {
    highlights.push({
      weekYear: readyAction.weekYear,
      type: 'ready',
      title: 'Marked Ready for Sale',
      batchNumber: readyAction.batchNumber,
      generation: readyAction.generation,
    });
  } else if (batch.ready_at) {
    highlights.push({
      weekYear: formatWeekYear(batch.ready_at) ?? '?',
      type: 'ready',
      title: 'Expected Ready',
      batchNumber: batch.batch_number,
      generation: 0,
    });
  }

  // Sort by week/year
  highlights.sort((a, b) => {
    const parseWY = (wy: string) => {
      const [w, y] = wy.split('/').map(Number);
      return (2000 + y) * 100 + w;
    };
    return parseWY(a.weekYear) - parseWY(b.weekYear);
  });

  return highlights;
}

// ============ STAGE SUMMARIES BUILDER ============

function buildStageSummaries(
  batch: BatchRow,
  ancestors: AncestorBatch[],
  actions: TimelineAction[]
): StageSummary[] {
  const summaries: StageSummary[] = [];

  // Build list of all batches (oldest first for display)
  type BatchInfo = {
    id: string;
    batchNumber: string | null;
    size: string | null;
    generation: number;
    quantity: number | null;
    plantedAt: string | null;
  };

  const allBatches: BatchInfo[] = [
    ...ancestors.slice().reverse().map(a => ({
      id: a.id,
      batchNumber: a.batchNumber,
      size: a.size,
      generation: a.generation,
      quantity: a.quantity,
      plantedAt: a.plantedAt,
    })),
    {
      id: batch.id,
      batchNumber: batch.batch_number,
      size: batch.plant_sizes?.name ?? null,
      generation: 0,
      quantity: batch.quantity,
      plantedAt: batch.planted_at,
    },
  ];

  for (const b of allBatches) {
    // Get actions for this batch
    const batchActions = actions.filter(a => a.batchId === b.id);

    // Find week/year range for this batch
    const weekYears = batchActions.map(a => a.weekYear).filter(Boolean);
    const startWeekYear = b.plantedAt ? formatWeekYear(b.plantedAt) : (weekYears[0] ?? null);
    const endWeekYear = weekYears.length > 0 ? weekYears[weekYears.length - 1] : startWeekYear;

    // Extract treatments
    const treatments: StageTreatment[] = batchActions
      .filter(a => a.category === 'treatment' && (a.product || a.title))
      .map(a => ({
        weekYear: a.weekYear,
        product: a.product ?? a.title,
        rate: a.rate,
        method: a.method,
        details: a.details,
      }));

    // Extract care activities (excluding treatments)
    const careActivities: StageCareActivity[] = batchActions
      .filter(a => a.category === 'care' || a.category === 'movement')
      .map(a => ({
        weekYear: a.weekYear,
        activity: a.title,
        details: buildCareDetails(a),
      }));

    summaries.push({
      batchId: b.id,
      batchNumber: b.batchNumber,
      size: b.size,
      startWeekYear,
      endWeekYear,
      generation: b.generation,
      quantity: b.quantity,
      isCurrent: b.generation === 0,
      treatments,
      careActivities,
    });
  }

  return summaries;
}

function buildCareDetails(action: TimelineAction): string | null {
  const parts: string[] = [];

  if (action.toLocation) {
    parts.push(`> ${action.toLocation}`);
  }
  if (action.fromLocation && action.toLocation) {
    parts.unshift(`${action.fromLocation}`);
  }
  if (action.details && !parts.includes(action.details)) {
    parts.push(action.details);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}

// ============ TIMELINE ACTIONS BUILDER ============

function parsePayload(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function categorizeEvent(eventType: string): TimelineAction['category'] {
  const type = eventType.toUpperCase();

  // Milestones
  if (['CHECKIN', 'PROPAGATION_IN', 'READY', 'CREATE'].includes(type)) {
    return 'milestone';
  }

  // Care activities
  if (['SPACED', 'SPACING', 'TRIMMED', 'TRIM', 'POTTED', 'POTTING', 'GRADED', 'GRADING', 'ROOTED', 'UNCOVER', 'UNCOVERED', 'PINCH', 'PINCHED'].includes(type)) {
    return 'care';
  }

  // Treatments
  if (['SPRAY', 'TREATMENT', 'HEALTH', 'FERTILIZE', 'FERTILIZED', 'WATER', 'WATERED'].includes(type)) {
    return 'treatment';
  }

  // Movements
  if (['MOVE', 'TRANSPLANT', 'TRANSPLANT_IN', 'TRANSPLANT_OUT', 'TRANSFER'].includes(type)) {
    return 'movement';
  }

  return 'other';
}

function buildTimelineActions(
  events: (EventRow & { batch_id: string })[],
  healthLogs: (HealthLogRow & { batch_id: string })[],
  batchLookup: Map<string, { batchNumber: string | null; generation: number }>,
  originDate: string | null
): TimelineAction[] {
  const actions: TimelineAction[] = [];
  const origin = originDate ? new Date(originDate) : new Date();

  // Process batch events
  for (const evt of events) {
    if (!evt.at) continue;

    const eventDate = new Date(evt.at);
    const week = Math.floor((eventDate.getTime() - origin.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const weekYear = formatWeekYear(eventDate) ?? '?';
    const batchInfo = batchLookup.get(evt.batch_id);
    const payload = parsePayload(evt.payload);

    const eventType = (evt.type ?? "event").toUpperCase();

    // Build readable title based on event type
    let title = evt.type ?? "Event";
    let details: string | null = null;
    let fromLocation: string | null = null;
    let toLocation: string | null = null;

    switch (eventType) {
      case "CHECKIN":
        title = "Checked In";
        details = payload?.notes as string ?? null;
        break;
      case "PROPAGATION_IN":
        title = "Propagation Started";
        details = payload?.notes as string ?? null;
        break;
      case "TRANSPLANT":
      case "TRANSPLANT_OUT":
        title = "Transplanted Out";
        const unitsOut = payload?.units_moved ?? payload?.units ?? payload?.quantity;
        if (unitsOut) details = `${unitsOut} units`;
        fromLocation = payload?.from_location as string ?? null;
        toLocation = payload?.to_location as string ?? null;
        break;
      case "TRANSPLANT_IN":
        title = "Transplanted In";
        const unitsIn = payload?.units_received ?? payload?.units ?? payload?.quantity ?? payload?.containers;
        if (unitsIn) details = `${unitsIn} units`;
        fromLocation = payload?.from_batch_id as string ?? null;
        break;
      case "MOVE":
        title = "Moved";
        fromLocation = payload?.from_location as string ?? null;
        toLocation = payload?.to_location as string ?? payload?.location as string ?? null;
        if (toLocation) details = `to ${toLocation}`;
        break;
      case "SPACED":
      case "SPACING":
        title = "Spaced";
        const spacing = payload?.spacing ?? payload?.new_spacing;
        if (spacing) details = `${spacing}`;
        break;
      case "TRIMMED":
      case "TRIM":
        title = "Trimmed";
        details = payload?.notes as string ?? null;
        break;
      case "UNCOVER":
      case "UNCOVERED":
        title = "Uncovered";
        details = payload?.notes as string ?? null;
        break;
      case "PINCH":
      case "PINCHED":
        title = "Pinched";
        details = payload?.notes as string ?? null;
        break;
      case "POTTED":
      case "POTTING":
        title = "Potted";
        const potSize = payload?.pot_size ?? payload?.size;
        if (potSize) details = `to ${potSize}`;
        break;
      case "GRADED":
      case "GRADING":
        title = "Graded";
        details = payload?.grade as string ?? payload?.notes as string ?? null;
        break;
      case "ROOTED":
        title = "Rooted";
        details = payload?.notes as string ?? null;
        break;
      case "READY":
        title = "Marked Ready";
        details = null;
        break;
      case "PICKED":
        title = "Picked";
        const picked = payload?.units_picked ?? payload?.quantity;
        if (picked) details = `${picked} units`;
        break;
      case "LOSS":
        title = "Loss";
        const lost = payload?.quantity ?? payload?.units;
        const reason = payload?.reason as string;
        details = lost ? `${lost} units${reason ? ` - ${reason}` : ""}` : reason ?? null;
        break;
      case "STATUS_CHANGE":
        title = "Status Changed";
        const newStatus = payload?.status ?? payload?.newStatus;
        if (newStatus) details = `to ${newStatus}`;
        break;
      case "NOTE":
      case "NOTES":
        title = "Note";
        details = payload?.notes as string ?? payload?.note as string ?? null;
        break;
      default:
        title = formatEventType(eventType);
        details = payload?.notes as string ?? null;
    }

    actions.push({
      week: Math.max(0, week),
      weekYear,
      date: evt.at,
      type: eventType,
      category: categorizeEvent(eventType),
      title,
      details,
      batchNumber: batchInfo?.batchNumber ?? null,
      batchId: evt.batch_id,
      generation: batchInfo?.generation ?? 0,
      product: null,
      rate: null,
      method: null,
      fromLocation,
      toLocation,
    });
  }

  // Process health logs (treatments, sprays, etc.)
  for (const log of healthLogs) {
    if (!log.event_at) continue;

    const logDate = new Date(log.event_at);
    const week = Math.floor((logDate.getTime() - origin.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const weekYear = formatWeekYear(logDate) ?? '?';
    const batchInfo = batchLookup.get(log.batch_id);

    const eventType = log.event_type?.toUpperCase() ?? "HEALTH";
    let title = log.title ?? log.product_name ?? "Treatment";

    // Build details
    const detailParts: string[] = [];
    if (log.reason_for_use) detailParts.push(log.reason_for_use);
    if (log.notes) detailParts.push(log.notes);

    // Build rate string
    let rateStr: string | null = null;
    if (log.rate != null && log.unit) {
      rateStr = `${log.rate} ${log.unit}`;
    }

    actions.push({
      week: Math.max(0, week),
      weekYear,
      date: log.event_at,
      type: eventType === "TREATMENT" ? "SPRAY" : eventType,
      category: 'treatment',
      title,
      details: detailParts.length > 0 ? detailParts.join(" - ") : null,
      batchNumber: batchInfo?.batchNumber ?? null,
      batchId: log.batch_id,
      generation: batchInfo?.generation ?? 0,
      product: log.product_name,
      rate: rateStr,
      method: log.method,
      fromLocation: null,
      toLocation: null,
    });
  }

  // Sort by date
  actions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return actions;
}

function formatEventType(type: string): string {
  return type
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function groupActionsByWeek(actions: TimelineAction[], originDate: string | null): WeekSummary[] {
  if (!originDate || actions.length === 0) return [];

  const origin = new Date(originDate);
  const weekMap = new Map<number, TimelineAction[]>();

  for (const action of actions) {
    const existing = weekMap.get(action.week) ?? [];
    existing.push(action);
    weekMap.set(action.week, existing);
  }

  // Convert to array and sort by week
  const weeks: WeekSummary[] = [];
  const sortedWeekNumbers = Array.from(weekMap.keys()).sort((a, b) => a - b);

  for (const weekNum of sortedWeekNumbers) {
    const weekStart = new Date(origin.getTime() + weekNum * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    const weekYear = formatWeekYear(weekStart) ?? '?';

    weeks.push({
      week: weekNum,
      weekYear,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      actions: weekMap.get(weekNum) ?? [],
    });
  }

  return weeks;
}

function parseProtocol(row: ProtocolRow): GrowerGuide["protocol"] {
  const definition = row.definition ?? {};

  // Extract targets from definition
  const rawTargets = definition.targets as Record<string, unknown> | undefined;
  const targets: GrowerGuideTargets | null = rawTargets
    ? {
        tempC: rawTargets.tempC as { day: number | null; night: number | null } | null ?? null,
        humidityPct: rawTargets.humidityPct as number | null ?? null,
        lightHours: rawTargets.lightHours as number | null ?? null,
        ec: rawTargets.ec as number | null ?? null,
        ph: rawTargets.ph as number | null ?? null,
        spacing: rawTargets.spacing as number | string | null ?? null,
      }
    : null;

  // Extract recommendations
  const recommendations = (definition.recommendations ?? []) as string[];

  // Extract summary
  const summary = (definition.summary as string) ?? null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    summary,
    targets,
    recommendations,
  };
}
