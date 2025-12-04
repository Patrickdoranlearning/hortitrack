import { addDays, parseISO } from "date-fns";
import type { ProductionProtocolRoute } from "@/lib/protocol-types";

export type PlannedNodeWindow = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  stageName?: string | null;
  locationName?: string | null;
};

export type RouteSchedule = {
  startDate: string;
  readyDate: string;
  nodes: PlannedNodeWindow[];
  totalDurationDays: number;
};

export function computeRouteSchedule(
  route: ProductionProtocolRoute | null | undefined,
  readyDate: string
): RouteSchedule {
  const ready = safeParseDate(readyDate);
  const nodes = route?.nodes ?? [];
  const totalDuration = nodes.reduce((sum, node) => sum + (node.durationDays ?? 0), 0);
  const start = addDays(ready, totalDuration ? -totalDuration : 0);
  let cursor = start;

  const windows: PlannedNodeWindow[] = nodes.map((node) => {
    const start = cursor;
    const duration = node.durationDays ?? 0;
    const end = duration ? addDays(start, duration) : start;
    cursor = end;
    return {
      id: node.id,
      label: node.label,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      durationDays: duration,
      stageName: node.stageName ?? null,
      locationName: node.locationName ?? null,
    };
  });

  return {
    startDate: start.toISOString(),
    readyDate: ready.toISOString(),
    nodes: windows,
    totalDurationDays: totalDuration,
  };
}

function safeParseDate(value: string | null | undefined): Date {
  if (!value) return new Date();
  try {
    return parseISO(value);
  } catch {
    return new Date(value);
  }
}


