/**
 * Unified toast API with automatic error transformation
 *
 * Usage:
 * ```ts
 * import { toast } from "@/lib/toast";
 *
 * // Simple success
 * toast.success("Changes saved");
 *
 * // Error with automatic friendly message
 * toast.error(error);
 *
 * // Error with custom fallback
 * toast.error(error, { fallback: "Could not save batch" });
 *
 * // Other types
 * toast.info("New update available");
 * toast.warning("Low stock warning");
 * ```
 */

import { toast as sonnerToast, type ExternalToast } from "sonner"
import { createElement } from "react"
import { parseError, isUserFacingMessage } from "./errors/toast-error"
import { ExpandableError } from "@/components/ui/sonner"

type ToastOptions = ExternalToast & {
  /** Custom fallback message if error parsing produces a generic message */
  fallback?: string
  /** Whether to show the "Show details" option. Defaults to true when technical details exist */
  showDetails?: boolean
}

/**
 * Show an error toast with automatic message transformation
 *
 * @param error - The error to display. Can be an Error object, string, or Supabase error
 * @param options - Toast options including optional fallback message
 */
function showError(error: unknown, options?: ToastOptions) {
  const { fallback, showDetails = true, ...toastOptions } = options ?? {}

  // If error is already a user-facing string, show it directly
  if (typeof error === "string" && isUserFacingMessage(error)) {
    return sonnerToast.error(error, toastOptions)
  }

  // Parse the error to get friendly message and details
  const parsed = parseError(error)

  // Use fallback if provided and the parsed message is generic
  const userMessage =
    fallback && parsed.category === "unknown" ? fallback : parsed.userMessage

  // Show expandable error if we have technical details
  if (showDetails && parsed.technicalDetails) {
    return sonnerToast.error(
      createElement(ExpandableError, {
        message: userMessage,
        details: parsed.technicalDetails,
      }),
      toastOptions
    )
  }

  return sonnerToast.error(userMessage, toastOptions)
}

/**
 * Show a success toast
 */
function showSuccess(message: string, options?: ExternalToast) {
  return sonnerToast.success(message, options)
}

/**
 * Show an info toast
 */
function showInfo(message: string, options?: ExternalToast) {
  return sonnerToast.info(message, options)
}

/**
 * Show a warning toast
 */
function showWarning(message: string, options?: ExternalToast) {
  return sonnerToast.warning(message, options)
}

/**
 * Show a loading toast
 */
function showLoading(message: string, options?: ExternalToast) {
  return sonnerToast.loading(message, options)
}

/**
 * Dismiss a toast by ID, or all toasts if no ID provided
 */
function dismiss(toastId?: string | number) {
  return sonnerToast.dismiss(toastId)
}

export const toast = {
  error: showError,
  success: showSuccess,
  info: showInfo,
  warning: showWarning,
  loading: showLoading,
  dismiss,
  /**
   * Promise-based toast for async operations
   * Shows loading, success, or error based on promise result
   *
   * @example
   * toast.promise(saveData(), {
   *   loading: "Saving...",
   *   success: "Saved!",
   *   error: "Could not save"
   * })
   */
  promise: sonnerToast.promise,
  /**
   * Custom toast (for advanced use cases)
   */
  custom: sonnerToast.custom,
  /**
   * Message toast (neutral)
   */
  message: sonnerToast.message,
}
