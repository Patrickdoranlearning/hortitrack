'use server';

import { getUserAndOrg } from '@/server/auth/org';
import { revalidatePath } from 'next/cache';

// ============================================================================
// Types
// ============================================================================

export type IpmBottle = {
  id: string;
  orgId: string;
  productId: string;
  bottleCode: string;
  volumeMl: number;
  remainingMl: number;
  batchNumber?: string;
  expiryDate?: string;
  purchaseDate?: string;
  status: 'sealed' | 'open' | 'empty' | 'disposed' | 'expired';
  openedAt?: string;
  emptiedAt?: string;
  notes?: string;
  createdAt: string;
  product?: {
    id: string;
    name: string;
  };
};

export type IpmStockMovement = {
  id: string;
  bottleId: string;
  productId: string;
  movementType: 'open' | 'usage' | 'adjustment' | 'disposal';
  quantityMl: number;
  remainingAfterMl: number;
  healthLogId?: string;
  locationId?: string;
  notes?: string;
  recordedAt: string;
  recordedBy?: string;
  bottle?: IpmBottle;
  location?: { id: string; name: string };
};

export type IpmStockSummary = {
  productId: string;
  productName: string;
  targetStockBottles: number;
  lowStockThreshold: number;
  defaultBottleVolumeMl: number;
  bottlesInStock: number;
  bottlesSealed: number;
  bottlesOpen: number;
  totalRemainingMl: number;
  isLowStock: boolean;
  usageLast30DaysMl: number;
};

export type CreateBottleInput = {
  productId: string;
  volumeMl: number;
  batchNumber?: string;
  expiryDate?: string;
  purchaseDate?: string;
  notes?: string;
};

export type RecordUsageInput = {
  bottleId: string;
  quantityMl: number;
  locationId?: string;
  healthLogId?: string;
  spotTreatmentId?: string;
  notes?: string;
};

export type StockResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ============================================================================
// Bottle Normalization
// ============================================================================

function normalizeBottle(row: any): IpmBottle {
  return {
    id: row.id,
    orgId: row.org_id,
    productId: row.product_id,
    bottleCode: row.bottle_code,
    volumeMl: row.volume_ml,
    remainingMl: row.remaining_ml,
    batchNumber: row.batch_number,
    expiryDate: row.expiry_date,
    purchaseDate: row.purchase_date,
    status: row.status,
    openedAt: row.opened_at,
    emptiedAt: row.emptied_at,
    notes: row.notes,
    createdAt: row.created_at,
    product: row.ipm_products ? {
      id: row.ipm_products.id,
      name: row.ipm_products.name,
    } : undefined,
  };
}

function normalizeMovement(row: any): IpmStockMovement {
  return {
    id: row.id,
    bottleId: row.bottle_id,
    productId: row.product_id,
    movementType: row.movement_type,
    quantityMl: row.quantity_ml,
    remainingAfterMl: row.remaining_after_ml,
    healthLogId: row.health_log_id,
    locationId: row.location_id,
    notes: row.notes,
    recordedAt: row.recorded_at,
    recordedBy: row.recorded_by,
    bottle: row.ipm_product_bottles ? normalizeBottle(row.ipm_product_bottles) : undefined,
    location: row.nursery_locations ? { id: row.nursery_locations.id, name: row.nursery_locations.name } : undefined,
  };
}

function normalizeStockSummary(row: any): IpmStockSummary {
  return {
    productId: row.product_id,
    productName: row.product_name,
    targetStockBottles: row.target_stock_bottles ?? 5,
    lowStockThreshold: row.low_stock_threshold ?? 2,
    defaultBottleVolumeMl: row.default_bottle_volume_ml ?? 1000,
    bottlesInStock: Number(row.bottles_in_stock) || 0,
    bottlesSealed: Number(row.bottles_sealed) || 0,
    bottlesOpen: Number(row.bottles_open) || 0,
    totalRemainingMl: Number(row.total_remaining_ml) || 0,
    isLowStock: row.is_low_stock ?? false,
    usageLast30DaysMl: Number(row.usage_last_30_days_ml) || 0,
  };
}

// ============================================================================
// Bottle CRUD
// ============================================================================

export async function listBottles(filters?: {
  productId?: string;
  status?: string;
}): Promise<StockResult<IpmBottle[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    let query = supabase
      .from('ipm_product_bottles')
      .select(`*, ipm_products (id, name)`)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (filters?.productId) query = query.eq('product_id', filters.productId);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query;

    if (error) {
      console.error('[listBottles] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(normalizeBottle) };
  } catch (error) {
    console.error('[listBottles] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getBottleByCode(bottleCode: string): Promise<StockResult<IpmBottle>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('ipm_product_bottles')
      .select(`*, ipm_products (id, name)`)
      .eq('org_id', orgId)
      .eq('bottle_code', bottleCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Bottle not found' };
      }
      console.error('[getBottleByCode] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: normalizeBottle(data) };
  } catch (error) {
    console.error('[getBottleByCode] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function createBottles(
  input: CreateBottleInput,
  quantity: number = 1
): Promise<StockResult<IpmBottle[]>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    const bottles: any[] = [];
    
    for (let i = 0; i < quantity; i++) {
      // Generate unique bottle code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_bottle_code', { p_org_id: orgId, p_product_id: input.productId });

      if (codeError) {
        console.error('[createBottles] code generation failed', codeError);
        return { success: false, error: 'Failed to generate bottle code' };
      }

      bottles.push({
        org_id: orgId,
        product_id: input.productId,
        bottle_code: codeData,
        volume_ml: input.volumeMl,
        remaining_ml: input.volumeMl,
        batch_number: input.batchNumber,
        expiry_date: input.expiryDate,
        purchase_date: input.purchaseDate || new Date().toISOString().split('T')[0],
        status: 'sealed',
        notes: input.notes,
        created_by: user.id,
      });
    }

    const { data, error } = await supabase
      .from('ipm_product_bottles')
      .insert(bottles)
      .select(`*, ipm_products (id, name)`);

    if (error) {
      console.error('[createBottles] insert failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/products');
    return { success: true, data: (data || []).map(normalizeBottle) };
  } catch (error) {
    console.error('[createBottles] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function disposeBottle(bottleId: string, notes?: string): Promise<StockResult> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Get bottle info first
    const { data: bottle, error: fetchError } = await supabase
      .from('ipm_product_bottles')
      .select('*')
      .eq('id', bottleId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !bottle) {
      return { success: false, error: 'Bottle not found' };
    }

    // Record disposal movement
    await supabase.from('ipm_stock_movements').insert({
      org_id: orgId,
      bottle_id: bottleId,
      product_id: bottle.product_id,
      movement_type: 'disposal',
      quantity_ml: -bottle.remaining_ml,
      remaining_after_ml: 0,
      notes: notes || 'Disposed',
      recorded_by: user.id,
    });

    // Update bottle status
    const { error: updateError } = await supabase
      .from('ipm_product_bottles')
      .update({ status: 'disposed', remaining_ml: 0, updated_at: new Date().toISOString() })
      .eq('id', bottleId)
      .eq('org_id', orgId);

    if (updateError) {
      console.error('[disposeBottle] update failed', updateError);
      return { success: false, error: updateError.message };
    }

    revalidatePath('/plant-health/products');
    return { success: true };
  } catch (error) {
    console.error('[disposeBottle] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Stock Movements
// ============================================================================

export async function recordUsage(input: RecordUsageInput): Promise<StockResult<IpmStockMovement>> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Get bottle info
    const { data: bottle, error: fetchError } = await supabase
      .from('ipm_product_bottles')
      .select('*')
      .eq('id', input.bottleId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !bottle) {
      return { success: false, error: 'Bottle not found' };
    }

    // Check if bottle needs to be opened first
    if (bottle.status === 'sealed') {
      // First record opening
      await supabase.from('ipm_stock_movements').insert({
        org_id: orgId,
        bottle_id: input.bottleId,
        product_id: bottle.product_id,
        movement_type: 'open',
        quantity_ml: 0,
        remaining_after_ml: bottle.remaining_ml,
        notes: 'Bottle opened for use',
        recorded_by: user.id,
      });
    }

    const remainingAfter = Math.max(0, bottle.remaining_ml - input.quantityMl);

    // Record usage
    const { data, error } = await supabase
      .from('ipm_stock_movements')
      .insert({
        org_id: orgId,
        bottle_id: input.bottleId,
        product_id: bottle.product_id,
        movement_type: 'usage',
        quantity_ml: -input.quantityMl,
        remaining_after_ml: remainingAfter,
        health_log_id: input.healthLogId,
        spot_treatment_id: input.spotTreatmentId,
        location_id: input.locationId,
        notes: input.notes,
        recorded_by: user.id,
      })
      .select(`*, ipm_product_bottles (*, ipm_products (id, name)), nursery_locations (id, name)`)
      .single();

    if (error) {
      console.error('[recordUsage] insert failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/products');
    return { success: true, data: normalizeMovement(data) };
  } catch (error) {
    console.error('[recordUsage] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function adjustBottleLevel(
  bottleId: string,
  newRemainingMl: number,
  notes?: string
): Promise<StockResult> {
  try {
    const { user, orgId, supabase } = await getUserAndOrg();

    // Get bottle info
    const { data: bottle, error: fetchError } = await supabase
      .from('ipm_product_bottles')
      .select('*')
      .eq('id', bottleId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !bottle) {
      return { success: false, error: 'Bottle not found' };
    }

    const difference = newRemainingMl - bottle.remaining_ml;

    // Record adjustment
    const { error } = await supabase.from('ipm_stock_movements').insert({
      org_id: orgId,
      bottle_id: bottleId,
      product_id: bottle.product_id,
      movement_type: 'adjustment',
      quantity_ml: difference,
      remaining_after_ml: newRemainingMl,
      notes: notes || `Manual adjustment from ${bottle.remaining_ml}ml to ${newRemainingMl}ml`,
      recorded_by: user.id,
    });

    if (error) {
      console.error('[adjustBottleLevel] insert failed', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/plant-health/products');
    return { success: true };
  } catch (error) {
    console.error('[adjustBottleLevel] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getMovementsForBottle(bottleId: string): Promise<StockResult<IpmStockMovement[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('ipm_stock_movements')
      .select(`*, ipm_product_bottles (*, ipm_products (id, name)), nursery_locations (id, name)`)
      .eq('org_id', orgId)
      .eq('bottle_id', bottleId)
      .order('recorded_at', { ascending: false });

    if (error) {
      console.error('[getMovementsForBottle] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(normalizeMovement) };
  } catch (error) {
    console.error('[getMovementsForBottle] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Stock Summary
// ============================================================================

export async function getStockSummary(): Promise<StockResult<IpmStockSummary[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('v_ipm_stock_summary')
      .select('*')
      .eq('org_id', orgId);

    if (error) {
      console.error('[getStockSummary] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(normalizeStockSummary) };
  } catch (error) {
    console.error('[getStockSummary] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getProductStockSummary(productId: string): Promise<StockResult<IpmStockSummary>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('v_ipm_stock_summary')
      .select('*')
      .eq('org_id', orgId)
      .eq('product_id', productId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No summary yet, return default
        return {
          success: true,
          data: {
            productId,
            productName: '',
            targetStockBottles: 5,
            lowStockThreshold: 2,
            defaultBottleVolumeMl: 1000,
            bottlesInStock: 0,
            bottlesSealed: 0,
            bottlesOpen: 0,
            totalRemainingMl: 0,
            isLowStock: true,
            usageLast30DaysMl: 0,
          },
        };
      }
      console.error('[getProductStockSummary] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: normalizeStockSummary(data) };
  } catch (error) {
    console.error('[getProductStockSummary] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getLowStockProducts(): Promise<StockResult<IpmStockSummary[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('v_ipm_stock_summary')
      .select('*')
      .eq('org_id', orgId)
      .eq('is_low_stock', true);

    if (error) {
      console.error('[getLowStockProducts] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(normalizeStockSummary) };
  } catch (error) {
    console.error('[getLowStockProducts] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Available Bottles for Treatment
// ============================================================================

export async function getAvailableBottles(productId: string): Promise<StockResult<IpmBottle[]>> {
  try {
    const { orgId, supabase } = await getUserAndOrg();

    const { data, error } = await supabase
      .from('ipm_product_bottles')
      .select(`*, ipm_products (id, name)`)
      .eq('org_id', orgId)
      .eq('product_id', productId)
      .in('status', ['sealed', 'open'])
      .gt('remaining_ml', 0)
      .order('status', { ascending: false }) // Open bottles first
      .order('remaining_ml', { ascending: true }); // Use nearly empty ones first

    if (error) {
      console.error('[getAvailableBottles] query failed', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []).map(normalizeBottle) };
  } catch (error) {
    console.error('[getAvailableBottles] error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

