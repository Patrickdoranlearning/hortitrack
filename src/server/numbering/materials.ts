import { getUserAndOrg } from "@/server/auth/org";

/**
 * Generate a part number for a new material
 * Format: M-{CATEGORY_CODE}-{SEQUENCE}
 * Example: M-POT-001, M-TRY-042
 */
export async function generatePartNumber(categoryCode: string): Promise<string> {
  const { supabase, orgId } = await getUserAndOrg();
  const key = `material-${categoryCode}`;

  const { data, error } = await supabase.rpc("increment_counter", {
    p_org_id: orgId,
    p_key: key,
  });

  if (error) {
    throw new Error(`Part number generation failed: ${error.message}`);
  }

  const seq = String(data as number).padStart(3, "0");
  return `M-${categoryCode}-${seq}`;
}

/**
 * Generate a PO number for a new purchase order
 * Format: PO-{YEAR}-{SEQUENCE}
 * Example: PO-2025-00001
 */
export async function generatePONumber(): Promise<string> {
  const { supabase, orgId } = await getUserAndOrg();
  const year = new Date().getFullYear();
  const key = `po-${year}`;

  const { data, error } = await supabase.rpc("increment_counter", {
    p_org_id: orgId,
    p_key: key,
  });

  if (error) {
    throw new Error(`PO number generation failed: ${error.message}`);
  }

  const seq = String(data as number).padStart(5, "0");
  return `PO-${year}-${seq}`;
}

/**
 * Generate internal barcode for a material
 * Format: HT:{ORG_PREFIX}:{PART_NUMBER}
 * Example: HT:abc12345:M-POT-001
 */
export function generateInternalBarcode(orgId: string, partNumber: string): string {
  const orgPrefix = orgId.slice(0, 8);
  return `HT:${orgPrefix}:${partNumber}`;
}
