
const ENABLED = process.env.NEXT_PUBLIC_TELEMETRY === "1";

type EventName =
  | "scan_decode_success"
  | "scan_decode_fail"
  | "scan_lookup_result";

export function track(event: EventName, data: Record<string, unknown> = {}) {
  if (!ENABLED) return;
  try {
    // Lightweight; replace with your analytics later
    console.log(JSON.stringify({ event, ts: new Date().toISOString(), ...data }));
  } catch {
    // no-op
  }
}
