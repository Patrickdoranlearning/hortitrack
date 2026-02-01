/**
 * Structured Logging Utility
 *
 * Production-ready logger that replaces console.log/error statements.
 * - JSON output in production for log aggregation
 * - Readable format in development
 * - Module-scoped loggers for context
 *
 * Usage:
 *   import { logger } from '@/server/utils/logger';
 *
 *   logger.dispatch.info('Delivery run created', { runId, orgId });
 *   logger.dispatch.error('Failed to create run', error, { runId });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  [key: string]: unknown;
}

interface ModuleLogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: unknown, context?: LogContext): void;
}

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

/**
 * Formats an error for logging, extracting useful information
 */
function formatError(error: unknown): LogEntry["error"] | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: isProduction ? undefined : error.stack,
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

/**
 * Creates a logger scoped to a specific module
 */
function createModuleLogger(module: string): ModuleLogger {
  const log = (level: LogLevel, message: string, context?: LogContext, error?: unknown) => {
    // Skip logging in test environment unless explicitly enabled
    if (isTest && !process.env.ENABLE_TEST_LOGS) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      ...context,
    };

    if (error) {
      entry.error = formatError(error);
    }

    if (isProduction) {
      // JSON format for production log aggregation (Datadog, CloudWatch, etc.)
      // Using console methods is acceptable here as this IS the logging utility
      switch (level) {
        case "error":
          console.error(JSON.stringify(entry));
          break;
        case "warn":
          console.warn(JSON.stringify(entry));
          break;
        default:
          console.log(JSON.stringify(entry));
      }
    } else {
      // Readable format for development
      const prefix = `[${level.toUpperCase()}] [${module}]`;
      const contextStr = context && Object.keys(context).length > 0
        ? ` ${JSON.stringify(context)}`
        : "";

      switch (level) {
        case "error":
          console.error(`${prefix} ${message}${contextStr}`, error || "");
          break;
        case "warn":
          console.warn(`${prefix} ${message}${contextStr}`);
          break;
        case "debug":
          console.debug(`${prefix} ${message}${contextStr}`);
          break;
        default:
          console.log(`${prefix} ${message}${contextStr}`);
      }
    }
  };

  return {
    debug: (message, context) => log("debug", message, context),
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context),
    error: (message, error, context) => log("error", message, context, error),
  };
}

/**
 * Pre-configured loggers for each module
 *
 * Add new modules here as needed:
 *   logger.myModule = createModuleLogger('my-module');
 */
export const logger = {
  dispatch: createModuleLogger("dispatch"),
  picking: createModuleLogger("picking"),
  trolley: createModuleLogger("trolley"),
  auth: createModuleLogger("auth"),
  api: createModuleLogger("api"),
  db: createModuleLogger("db"),
  worker: createModuleLogger("worker"),
  security: createModuleLogger("security"),
  production: createModuleLogger("production"),
  sales: createModuleLogger("sales"),
  materials: createModuleLogger("materials"),
  ai: createModuleLogger("ai"),
  cache: createModuleLogger("cache"),
  refdata: createModuleLogger("refdata"),
} as const;

/**
 * Create a custom module logger for one-off use cases
 *
 * Usage:
 *   const log = createLogger('my-feature');
 *   log.info('Feature initialized');
 */
export { createModuleLogger as createLogger };

/**
 * Type guard to check if a value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Extracts error message safely from unknown error type
 *
 * Usage:
 *   catch (error) {
 *     return { error: getErrorMessage(error) };
 *   }
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unknown error occurred";
}
