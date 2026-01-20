/**
 * Error parsing and categorization for user-friendly toast messages
 */

export type ErrorCategory =
  | 'network'
  | 'auth'
  | 'validation'
  | 'database'
  | 'permission'
  | 'notFound'
  | 'conflict'
  | 'unknown';

export type FriendlyError = {
  userMessage: string;
  technicalDetails?: string;
  category: ErrorCategory;
  canRetry: boolean;
};

type ErrorPattern = {
  pattern: RegExp;
  category: ErrorCategory;
  message: string;
  canRetry: boolean;
};

/**
 * Pattern matchers for common errors
 * Ordered by specificity - more specific patterns should come first
 */
const errorPatterns: ErrorPattern[] = [
  // Network errors
  {
    pattern: /fetch failed|network|ECONNREFUSED|timeout|ERR_NETWORK|Failed to fetch/i,
    category: 'network',
    message: 'Connection issue. Check your internet and try again.',
    canRetry: true,
  },
  {
    pattern: /offline|no internet/i,
    category: 'network',
    message: 'You appear to be offline. Changes will sync when you reconnect.',
    canRetry: true,
  },

  // Auth errors
  {
    pattern: /not authenticated|unauthenticated|401|session.*(expired|invalid)|JWT expired/i,
    category: 'auth',
    message: 'Your session has expired. Please sign in again.',
    canRetry: false,
  },
  {
    pattern: /invalid.*credentials|wrong.*password|login failed/i,
    category: 'auth',
    message: 'Invalid login credentials. Please try again.',
    canRetry: true,
  },

  // Permission errors
  {
    pattern: /access denied|forbidden|403|permission denied|not allowed/i,
    category: 'permission',
    message: "You don't have permission to do this.",
    canRetry: false,
  },
  {
    pattern: /row.level security|RLS|policy.*violation/i,
    category: 'permission',
    message: 'Access restricted. Contact support if this seems wrong.',
    canRetry: false,
  },

  // Database/Supabase specific errors
  {
    pattern: /PGRST116/i,
    category: 'notFound',
    message: 'The requested item was not found.',
    canRetry: false,
  },
  {
    pattern: /duplicate key|unique.*constraint|PGRST301|already exists/i,
    category: 'conflict',
    message: 'This item already exists.',
    canRetry: false,
  },
  {
    pattern: /foreign key|referenced by|constraint.*violat|PGRST204/i,
    category: 'database',
    message: 'This item is linked to other data and cannot be modified.',
    canRetry: false,
  },
  {
    pattern: /null.*constraint|not.null|required field/i,
    category: 'validation',
    message: 'Please fill in all required fields.',
    canRetry: true,
  },

  // Not found
  {
    pattern: /not found|404|no rows returned|does not exist/i,
    category: 'notFound',
    message: 'The requested item could not be found.',
    canRetry: false,
  },

  // Validation errors
  {
    pattern: /invalid.*format|malformed|parse error/i,
    category: 'validation',
    message: 'Invalid format. Please check your input.',
    canRetry: true,
  },
  {
    pattern: /required|must be|cannot be empty|missing/i,
    category: 'validation',
    message: 'Please check your input and try again.',
    canRetry: true,
  },
  {
    pattern: /too (long|short|large|small)|exceeds|limit/i,
    category: 'validation',
    message: 'Value is out of allowed range.',
    canRetry: true,
  },

  // Server errors
  {
    pattern: /500|internal server|something went wrong on our end/i,
    category: 'unknown',
    message: 'Something went wrong. Please try again.',
    canRetry: true,
  },
];

/**
 * Extract a string message from various error types
 */
function extractErrorMessage(error: unknown): string {
  if (error === null || error === undefined) {
    return 'Unknown error';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  // Handle Supabase error objects
  if (typeof error === 'object') {
    const obj = error as Record<string, unknown>;

    // Supabase errors often have these properties
    if (typeof obj.message === 'string') return obj.message;
    if (typeof obj.error === 'string') return obj.error;
    if (typeof obj.error_description === 'string') return obj.error_description;
    if (typeof obj.details === 'string') return obj.details;
    if (typeof obj.hint === 'string') return obj.hint;

    // Try to stringify
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }

  return String(error);
}

/**
 * Extract technical details for the expandable section
 */
function extractTechnicalDetails(error: unknown): string | undefined {
  if (error === null || error === undefined) {
    return undefined;
  }

  const parts: string[] = [];

  if (error instanceof Error) {
    parts.push(error.message);
    if (error.name && error.name !== 'Error') {
      parts.unshift(`[${error.name}]`);
    }
  } else if (typeof error === 'object') {
    const obj = error as Record<string, unknown>;

    // Collect all error-related fields
    const fields = ['code', 'message', 'error', 'details', 'hint', 'error_description'];
    for (const field of fields) {
      if (obj[field] && typeof obj[field] === 'string') {
        parts.push(`${field}: ${obj[field]}`);
      }
    }

    // If nothing found, stringify the whole thing
    if (parts.length === 0) {
      try {
        parts.push(JSON.stringify(error, null, 2));
      } catch {
        parts.push(String(error));
      }
    }
  } else if (typeof error === 'string') {
    parts.push(error);
  }

  return parts.length > 0 ? parts.join('\n') : undefined;
}

/**
 * Parse an error into a user-friendly format
 */
export function parseError(error: unknown): FriendlyError {
  const rawMessage = extractErrorMessage(error);
  const technicalDetails = extractTechnicalDetails(error);

  // Try to match against known patterns
  for (const { pattern, category, message, canRetry } of errorPatterns) {
    if (pattern.test(rawMessage)) {
      return {
        userMessage: message,
        technicalDetails,
        category,
        canRetry,
      };
    }
  }

  // Default fallback
  return {
    userMessage: 'Something went wrong. Please try again.',
    technicalDetails,
    category: 'unknown',
    canRetry: true,
  };
}

/**
 * Check if an error is likely a user-facing message (not technical)
 * These can be shown directly without transformation
 */
export function isUserFacingMessage(message: string): boolean {
  // Technical patterns that indicate this is NOT user-facing
  const technicalPatterns = [
    /^PGRST\d+/i,
    /^[A-Z_]+Error:/,
    /constraint/i,
    /violat(es|ion)/i,
    /SQL|query|database/i,
    /null|undefined/i,
    /TypeError|ReferenceError|SyntaxError/i,
    /at line \d+/i,
    /stack trace/i,
  ];

  return !technicalPatterns.some(pattern => pattern.test(message));
}
