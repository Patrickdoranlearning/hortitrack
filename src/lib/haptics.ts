/**
 * Haptic Feedback Utilities
 *
 * Provides haptic feedback for mobile devices that support the Vibration API.
 * Gracefully degrades when not available.
 */

// =============================================================================
// FEATURE DETECTION
// =============================================================================

/**
 * Check if the Vibration API is available
 */
function isVibrationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'vibrate' in navigator;
}

/**
 * Safely trigger vibration with a pattern
 * @param pattern - Duration(s) in milliseconds, or array of durations (vibrate, pause, vibrate...)
 */
function vibrate(pattern: number | number[]): boolean {
  if (!isVibrationSupported()) return false;

  try {
    return navigator.vibrate(pattern);
  } catch {
    // Vibration may fail in certain contexts (e.g., background tabs)
    return false;
  }
}

// =============================================================================
// HAPTIC PATTERNS
// =============================================================================

/**
 * Short success vibration - single quick pulse
 * Use when: task completed, item added, action succeeded
 */
export function vibrateSuccess(): boolean {
  return vibrate(50);
}

/**
 * Error vibration - two quick pulses
 * Use when: validation error, action failed, something went wrong
 */
export function vibrateError(): boolean {
  return vibrate([50, 50, 50]);
}

/**
 * Light tap vibration - very subtle
 * Use when: button press, selection change, minor interaction
 */
export function vibrateTap(): boolean {
  return vibrate(10);
}

/**
 * Warning vibration - medium pulse followed by short pause and another pulse
 * Use when: important action about to happen, confirmation needed
 */
export function vibrateWarning(): boolean {
  return vibrate([100, 50, 50]);
}

/**
 * Heavy vibration - longer single pulse
 * Use when: critical action, major state change
 */
export function vibrateHeavy(): boolean {
  return vibrate(200);
}

/**
 * Notification vibration - attention-getting pattern
 * Use when: new notification, alert
 */
export function vibrateNotification(): boolean {
  return vibrate([100, 100, 100, 100, 100]);
}

/**
 * Custom vibration pattern
 * @param pattern - Array of durations [vibrate, pause, vibrate, pause, ...]
 */
export function vibratePattern(pattern: number[]): boolean {
  return vibrate(pattern);
}

/**
 * Stop any ongoing vibration
 */
export function stopVibration(): boolean {
  return vibrate(0);
}

// =============================================================================
// HAPTIC FEEDBACK HOOK SUPPORT
// =============================================================================

export interface HapticOptions {
  /** Whether haptics are enabled (default: true) */
  enabled?: boolean;
  /** Intensity multiplier 0-1 (affects pattern durations) */
  intensity?: number;
}

const DEFAULT_OPTIONS: HapticOptions = {
  enabled: true,
  intensity: 1,
};

/**
 * Create a haptic feedback function with options
 * Useful for creating scoped haptic handlers with consistent settings
 */
export function createHapticHandler(options: HapticOptions = {}) {
  const { enabled, intensity } = { ...DEFAULT_OPTIONS, ...options };

  const scalePattern = (pattern: number | number[]): number | number[] => {
    const scale = intensity ?? 1;
    if (scale === 1) return pattern;
    if (typeof pattern === 'number') {
      return Math.round(pattern * scale);
    }
    return pattern.map((p, i) =>
      // Scale vibration durations, keep pauses the same
      i % 2 === 0 ? Math.round(p * scale) : p
    );
  };

  return {
    success: () => enabled && vibrate(scalePattern(50)),
    error: () => enabled && vibrate(scalePattern([50, 50, 50])),
    tap: () => enabled && vibrate(scalePattern(10)),
    warning: () => enabled && vibrate(scalePattern([100, 50, 50])),
    heavy: () => enabled && vibrate(scalePattern(200)),
    notification: () => enabled && vibrate(scalePattern([100, 100, 100, 100, 100])),
    custom: (pattern: number[]) => enabled && vibrate(scalePattern(pattern)),
    stop: () => stopVibration(),
  };
}
