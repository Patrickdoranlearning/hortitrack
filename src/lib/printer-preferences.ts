/**
 * Workstation-specific printer preferences stored in localStorage.
 * This allows each workstation/browser to have its own default printer,
 * independent of the organization-wide default.
 */

const STORAGE_KEY = "hortitrack_printer_prefs";

export type LabelType = "batch" | "sale" | "location" | "trolley";

export interface PrinterPreferences {
  /** Global workstation default printer ID */
  defaultPrinterId?: string;
  /** Per-label-type overrides */
  labelTypeDefaults?: Partial<Record<LabelType, string>>;
  /** Timestamp of last update */
  updatedAt?: string;
}

/**
 * Get the current printer preferences from localStorage.
 */
export function getPrinterPreferences(): PrinterPreferences {
  if (typeof window === "undefined") return {};

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    console.warn("[printer-preferences] Failed to read preferences:", e);
    return {};
  }
}

/**
 * Save printer preferences to localStorage.
 */
function savePrinterPreferences(prefs: PrinterPreferences): void {
  if (typeof window === "undefined") return;

  try {
    prefs.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn("[printer-preferences] Failed to save preferences:", e);
  }
}

/**
 * Set the default printer for this workstation.
 * If labelType is provided, sets the default for that specific label type.
 * Otherwise, sets the global workstation default.
 */
export function setPrinterPreference(
  printerId: string,
  labelType?: LabelType
): void {
  const prefs = getPrinterPreferences();

  if (labelType) {
    prefs.labelTypeDefaults = prefs.labelTypeDefaults || {};
    prefs.labelTypeDefaults[labelType] = printerId;
  } else {
    prefs.defaultPrinterId = printerId;
  }

  savePrinterPreferences(prefs);
}

/**
 * Clear the workstation default printer.
 * If labelType is provided, clears only that label type's default.
 * Otherwise, clears the global workstation default.
 */
export function clearPrinterPreference(labelType?: LabelType): void {
  const prefs = getPrinterPreferences();

  if (labelType) {
    if (prefs.labelTypeDefaults) {
      delete prefs.labelTypeDefaults[labelType];
    }
  } else {
    delete prefs.defaultPrinterId;
  }

  savePrinterPreferences(prefs);
}

/**
 * Clear all workstation printer preferences.
 */
export function clearAllPrinterPreferences(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("[printer-preferences] Failed to clear preferences:", e);
  }
}

/**
 * Printer type for selection.
 */
export interface PrinterOption {
  id: string;
  name: string;
  is_default?: boolean;
  connection_type?: string;
  agent_id?: string;
}

/**
 * Get the preferred printer for a given context.
 *
 * Priority order:
 * 1. Label-type specific workstation preference (if labelType provided)
 * 2. Global workstation preference
 * 3. Organization default (is_default = true)
 * 4. First available printer
 *
 * Returns undefined if no printers are available.
 */
export function getPreferredPrinter<T extends PrinterOption>(
  printers: T[],
  labelType?: LabelType
): T | undefined {
  if (!printers || printers.length === 0) {
    return undefined;
  }

  const prefs = getPrinterPreferences();

  // 1. Check label-type specific preference
  if (labelType && prefs.labelTypeDefaults?.[labelType]) {
    const printer = printers.find(
      (p) => p.id === prefs.labelTypeDefaults![labelType]
    );
    if (printer) return printer;
  }

  // 2. Check global workstation preference
  if (prefs.defaultPrinterId) {
    const printer = printers.find((p) => p.id === prefs.defaultPrinterId);
    if (printer) return printer;
  }

  // 3. Check organization default
  const orgDefault = printers.find((p) => p.is_default);
  if (orgDefault) return orgDefault;

  // 4. Return first available printer
  return printers[0];
}

/**
 * Get the preferred printer ID for a given context.
 * This is a convenience function that returns just the ID.
 */
export function getPreferredPrinterId(
  printers: PrinterOption[],
  labelType?: LabelType
): string | undefined {
  return getPreferredPrinter(printers, labelType)?.id;
}

/**
 * Check if a specific printer is set as the workstation default.
 */
export function isWorkstationDefault(
  printerId: string,
  labelType?: LabelType
): boolean {
  const prefs = getPrinterPreferences();

  if (labelType) {
    return prefs.labelTypeDefaults?.[labelType] === printerId;
  }

  return prefs.defaultPrinterId === printerId;
}

/**
 * Hook-friendly function to determine if we should show "Remember" checkbox.
 * Returns true if the selected printer is different from the current preference.
 */
export function shouldShowRememberOption(
  selectedPrinterId: string | undefined,
  printers: PrinterOption[],
  labelType?: LabelType
): boolean {
  if (!selectedPrinterId) return false;

  const preferred = getPreferredPrinter(printers, labelType);
  return preferred?.id !== selectedPrinterId;
}
