/**
 * Development Authentication Bypass
 *
 * ⚠️  SECURITY WARNING ⚠️
 * This module allows bypassing authentication for local development ONLY.
 *
 * SAFEGUARDS:
 * 1. Requires NODE_ENV === "development" (cannot work in production builds)
 * 2. Requires explicit ENABLE_DEV_BYPASS=true environment variable
 * 3. Credentials must be provided via env vars (not hardcoded)
 *
 * TO ENABLE (local development only):
 * Add to .env.local:
 *   ENABLE_DEV_BYPASS=true
 *   DEV_BYPASS_USER_ID=<your-dev-user-uuid>
 *   DEV_BYPASS_ORG_ID=<your-dev-org-uuid>
 *
 * NEVER enable in staging, preview, or production environments.
 * The .env.local file is gitignored and should never be committed.
 */

// Only enable dev bypass if explicitly set AND in development mode
export const IS_DEV =
  process.env.NODE_ENV === "development" &&
  process.env.ENABLE_DEV_BYPASS === "true";

// Get bypass credentials from environment variables (not hardcoded)
export const DEV_USER_ID = process.env.DEV_BYPASS_USER_ID || "";
export const DEV_ORG_ID = process.env.DEV_BYPASS_ORG_ID || "";

// Warn if bypass is enabled but credentials are missing
if (IS_DEV && (!DEV_USER_ID || !DEV_ORG_ID)) {
  console.warn(
    "[dev-bypass] ENABLE_DEV_BYPASS is true but DEV_BYPASS_USER_ID or DEV_BYPASS_ORG_ID is missing"
  );
}
