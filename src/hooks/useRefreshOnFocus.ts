"use client";

import { useEffect, useRef } from "react";

/**
 * Hook that triggers a callback when the browser tab regains focus.
 * Useful for refreshing data after the user returns from creating
 * a new entity in another tab.
 *
 * @param onFocus - Callback to execute when the tab regains focus
 * @param enabled - Whether the hook is active (defaults to true)
 *
 * @example
 * ```tsx
 * const { reload } = useContext(ReferenceDataContext);
 * useRefreshOnFocus(reload);
 * ```
 */
export function useRefreshOnFocus(
  onFocus: () => void,
  enabled: boolean = true
): void {
  const callbackRef = useRef(onFocus);

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = onFocus;
  }, [onFocus]);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        callbackRef.current();
      }
    };

    const handleFocus = () => {
      callbackRef.current();
    };

    // Use both visibilitychange and focus for better browser support
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [enabled]);
}
