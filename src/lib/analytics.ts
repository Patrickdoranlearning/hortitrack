type Payload = Record<string, unknown>;
export function track(event: string, payload?: Payload) {
  // If you have a real client (PostHog/GA), call it here.
  // Fallback to console for now:
  // eslint-disable-next-line no-console
  console.info("[analytics]", event, payload ?? {});
}
