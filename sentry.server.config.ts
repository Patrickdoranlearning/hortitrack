// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === "production",

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: 0.1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Filter out noisy errors
  ignoreErrors: [
    // Network/timeout errors
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
    // Rate limiting (expected behavior)
    "Rate limit exceeded",
  ],

  // Don't capture errors from health checks
  beforeSend(event) {
    const url = event.request?.url || "";
    if (url.includes("/api/health") || url.includes("/_next/")) {
      return null;
    }
    return event;
  },
});
