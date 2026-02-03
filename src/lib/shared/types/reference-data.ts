/**
 * Shared Reference Data Types
 *
 * Common types for reference data (varieties, sizes, locations)
 * used by both main app and worker app.
 */

/**
 * Minimal variety representation for selectors
 */
export interface VarietyOption {
  id: string;
  name: string;
  family: string | null;
}

/**
 * Minimal size representation for selectors
 */
export interface SizeOption {
  id: string;
  name: string;
  cellMultiple: number;
  containerType: string | null;
}

/**
 * Minimal location representation for selectors
 */
export interface LocationOption {
  id: string;
  name: string;
  nurserySite: string | null;
}

/**
 * Combined reference data for forms
 */
export interface FormReferenceData {
  varieties: VarietyOption[];
  sizes: SizeOption[];
  locations: LocationOption[];
}
