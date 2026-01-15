type Payload = Record<string, unknown>;
export function track(event: string, payload?: Payload) {
  // If you have a real client (PostHog/GA), call it here.
  // Fallback to console for now:
   
  console.info("[analytics]", event, payload ?? {});
}
