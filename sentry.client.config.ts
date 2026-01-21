// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Session replay configuration - helps debug user-reported issues
  // Capture replay on 10% of error sessions for debugging
  replaysOnErrorSampleRate: 0.1,
  // Don't capture general session replays to minimize performance impact
  replaysSessionSampleRate: 0,

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    /extensions\//i,
    /^chrome-extension:\/\//i,
    // Network errors that are often transient
    "Network request failed",
    "Failed to fetch",
    "Load failed",
    // User-initiated navigation
    "AbortError",
    "The operation was aborted",
  ],

  // Don't send PII
  beforeSend(event) {
    // Remove sensitive data from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
        if (breadcrumb.data?.url) {
          // Remove query params that might contain sensitive data
          try {
            const url = new URL(breadcrumb.data.url);
            url.search = "";
            breadcrumb.data.url = url.toString();
          } catch {
            // Keep original if URL parsing fails
          }
        }
        return breadcrumb;
      });
    }
    return event;
  },
});
