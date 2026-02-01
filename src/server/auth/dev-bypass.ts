/**
 * Development Authentication Bypass
 *
 * !! SECURITY WARNING !!
 * This module allows bypassing authentication for local development ONLY.
 *
 * SAFEGUARDS:
 * 1. Requires NODE_ENV === "development" (cannot work in production builds)
 * 2. Explicitly blocked when VERCEL_ENV === "production"
 * 3. Requires explicit ENABLE_DEV_BYPASS=true environment variable
 * 4. Credentials must be provided via env vars (not hardcoded)
 * 5. Runtime assertion throws error if misconfigured in production
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

// PRODUCTION GUARD: Explicit check for production environment
// This catches edge cases where NODE_ENV might be misconfigured
const isProductionBuild =
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production";

// Only enable dev bypass if:
// 1. NOT in any production environment
// 2. NODE_ENV is explicitly "development"
// 3. ENABLE_DEV_BYPASS is explicitly "true"
export const IS_DEV =
  !isProductionBuild &&
  process.env.NODE_ENV === "development" &&
  process.env.ENABLE_DEV_BYPASS === "true";

// RUNTIME SAFETY ASSERTION
// This throws immediately if someone accidentally enables dev bypass in production
if (process.env.ENABLE_DEV_BYPASS === "true" && isProductionBuild) {
  throw new Error(
    "CRITICAL SECURITY ERROR: Dev bypass is enabled in a production environment. " +
    "Remove ENABLE_DEV_BYPASS from environment variables immediately."
  );
}

// Get bypass credentials from environment variables (not hardcoded)
export const DEV_USER_ID = process.env.DEV_BYPASS_USER_ID || "";
export const DEV_ORG_ID = process.env.DEV_BYPASS_ORG_ID || "";

// Warn if bypass is enabled but credentials are missing
if (IS_DEV && (!DEV_USER_ID || !DEV_ORG_ID)) {
  console.warn(
    "[dev-bypass] ENABLE_DEV_BYPASS is true but DEV_BYPASS_USER_ID or DEV_BYPASS_ORG_ID is missing"
  );
}
