/**
 * Development bypass configuration.
 *
 * SECURITY: The dev bypass is DISABLED by default.
 * To enable it for local development, set ENABLE_DEV_BYPASS=true in .env.local
 *
 * This should NEVER be enabled in staging, preview, or production environments.
 */
export const DEV_USER_ID = "83fb1278-0f92-467d-ad1c-aa1aaeeda070";
export const DEV_ORG_ID = "34229655-0246-4cbe-b717-d5a6bb6acea9";

// Only enable dev bypass if explicitly set AND in development mode
export const IS_DEV =
  process.env.NODE_ENV === 'development' &&
  process.env.ENABLE_DEV_BYPASS === 'true';
