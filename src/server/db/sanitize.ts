/**
 * Input Sanitization Utilities for PostgREST Queries
 *
 * PostgREST uses special characters in filter strings that can be exploited
 * if user input is not properly escaped. This module provides utilities to
 * sanitize user input for safe use in PostgREST queries.
 *
 * Security Note:
 * - PostgREST ilike/like filters interpret % as wildcard (any characters)
 * - _ is interpreted as single character wildcard
 * - * is interpreted as wildcard in some contexts
 * - Backslashes need escaping too
 *
 * Usage:
 *   import { safeIlikePattern, escapePostgrestFilter } from '@/server/db/sanitize';
 *
 *   // For contains-style search:
 *   const pattern = safeIlikePattern(userInput);
 *   query.ilike("name", pattern);
 *
 *   // For .or() filter strings:
 *   const escaped = escapePostgrestFilter(userInput);
 *   query.or(`name.ilike.%${escaped}%`);
 */

/**
 * Escapes special characters for PostgREST filter strings.
 *
 * This prevents SQL injection attacks where user input containing
 * special characters (%, _, *, \) could manipulate query behavior.
 *
 * @param input - Raw user input to escape
 * @returns Escaped string safe for use in PostgREST filters
 *
 * @example
 * escapePostgrestFilter("test%drop")    // Returns "test\\%drop"
 * escapePostgrestFilter("user_name")    // Returns "user\\_name"
 * escapePostgrestFilter("100% complete") // Returns "100\\% complete"
 */
export function escapePostgrestFilter(input: string): string {
  if (!input) return "";

  return input
    .replace(/\\/g, "\\\\") // Escape backslashes first (must be first!)
    .replace(/%/g, "\\%") // Escape percent (wildcard)
    .replace(/_/g, "\\_") // Escape underscore (single char wildcard)
    .replace(/\*/g, "\\*"); // Escape asterisk (wildcard in some contexts)
}

/**
 * Creates a safe ilike pattern from user input.
 *
 * Escapes special characters in the input and wraps with % for
 * contains-style matching. Use this for standard search fields.
 *
 * @param input - Raw user input for search
 * @returns Escaped pattern like "%safe_input%" for use with .ilike()
 *
 * @example
 * const pattern = safeIlikePattern("test");
 * query.ilike("name", pattern); // Searches for names containing "test"
 *
 * // User tries injection:
 * const pattern = safeIlikePattern("test%--");
 * // Returns "%test\\%--%" - the % is escaped, no injection possible
 */
export function safeIlikePattern(input: string): string {
  return `%${escapePostgrestFilter(input)}%`;
}

/**
 * Creates a safe starts-with pattern from user input.
 *
 * @param input - Raw user input for search
 * @returns Escaped pattern like "safe_input%" for use with .ilike()
 */
export function safeStartsWithPattern(input: string): string {
  return `${escapePostgrestFilter(input)}%`;
}

/**
 * Creates a safe ends-with pattern from user input.
 *
 * @param input - Raw user input for search
 * @returns Escaped pattern like "%safe_input" for use with .ilike()
 */
export function safeEndsWithPattern(input: string): string {
  return `%${escapePostgrestFilter(input)}`;
}

/**
 * Creates a safe exact match pattern (no wildcards).
 *
 * @param input - Raw user input for exact match
 * @returns Escaped string safe for equality checks
 */
export function safeExactMatch(input: string): string {
  return escapePostgrestFilter(input);
}
