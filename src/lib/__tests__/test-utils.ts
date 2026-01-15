/**
 * Shared test utilities for mocking Supabase, Auth, and other services
 */

import type { SupabaseClient, User } from '@supabase/supabase-js';

// ============================================================================
// Mock User Factory
// ============================================================================

export const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'test-user-id',
  app_metadata: {},
  user_metadata: { full_name: 'Test User' },
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00.000Z',
  email: 'test@example.com',
  ...overrides,
});

// ============================================================================
// Mock Supabase Query Builder
// ============================================================================

type MockQueryResult<T> = {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number;
};

export class MockSupabaseQueryBuilder<T = any> {
  private _result: MockQueryResult<T> = { data: null, error: null };
  private _filters: Record<string, any> = {};

  constructor(result?: MockQueryResult<T>) {
    if (result) {
      this._result = result;
    }
  }

  setResult(result: MockQueryResult<T>) {
    this._result = result;
    return this;
  }

  select(query?: string) {
    return this;
  }

  insert(data: any) {
    return this;
  }

  update(data: any) {
    return this;
  }

  delete() {
    return this;
  }

  upsert(data: any, options?: any) {
    return this;
  }

  eq(column: string, value: any) {
    this._filters[column] = value;
    return this;
  }

  neq(column: string, value: any) {
    return this;
  }

  gt(column: string, value: any) {
    return this;
  }

  gte(column: string, value: any) {
    return this;
  }

  lt(column: string, value: any) {
    return this;
  }

  lte(column: string, value: any) {
    return this;
  }

  like(column: string, pattern: string) {
    return this;
  }

  ilike(column: string, pattern: string) {
    return this;
  }

  is(column: string, value: any) {
    return this;
  }

  in(column: string, values: any[]) {
    return this;
  }

  contains(column: string, value: any) {
    return this;
  }

  or(filters: string) {
    return this;
  }

  not(column: string, operator: string, value: any) {
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    return this;
  }

  limit(count: number) {
    return this;
  }

  range(from: number, to: number) {
    return this;
  }

  single() {
    return Promise.resolve(this._result);
  }

  maybeSingle() {
    return Promise.resolve(this._result);
  }

  then(resolve: (value: MockQueryResult<T>) => any) {
    return Promise.resolve(this._result).then(resolve);
  }

  async execute() {
    return this._result;
  }
}

// ============================================================================
// Mock Supabase Client Factory
// ============================================================================

export type MockSupabaseConfig = {
  tableResults?: Record<string, MockQueryResult<any>>;
  rpcResults?: Record<string, any>;
  authUser?: User | null;
  authError?: { message: string } | null;
};

export const createMockSupabaseClient = (
  config: MockSupabaseConfig = {}
): jest.Mocked<SupabaseClient> => {
  const { tableResults = {}, rpcResults = {}, authUser = createMockUser(), authError = null } = config;

  const mockClient = {
    from: jest.fn((table: string) => {
      const result = tableResults[table] || { data: [], error: null };
      return new MockSupabaseQueryBuilder(result);
    }),
    rpc: jest.fn((fn: string, params?: any) => {
      const result = rpcResults[fn];
      if (result instanceof Error) {
        return Promise.resolve({ data: null, error: { message: result.message } });
      }
      return Promise.resolve({ data: result, error: null });
    }),
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({
          data: { user: authUser },
          error: authError,
        })
      ),
      admin: {
        getUserById: jest.fn((id: string) =>
          Promise.resolve({
            data: { user: authUser },
            error: authError,
          })
        ),
      },
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn(),
        download: jest.fn(),
        remove: jest.fn(),
        getPublicUrl: jest.fn(() => ({ data: { publicUrl: 'https://example.com/file.jpg' } })),
      })),
    },
  } as unknown as jest.Mocked<SupabaseClient>;

  return mockClient;
};

// ============================================================================
// Mock getUserAndOrg Helper
// ============================================================================

export const createMockGetUserAndOrg = (
  overrides: {
    user?: Partial<User>;
    orgId?: string;
    supabase?: Partial<SupabaseClient>;
  } = {}
) => {
  const user = createMockUser(overrides.user);
  const orgId = overrides.orgId || 'test-org-id';
  const supabase = createMockSupabaseClient() as SupabaseClient;

  return jest.fn().mockResolvedValue({ user, orgId, supabase });
};

// ============================================================================
// Test Data Factories
// ============================================================================

export const factories = {
  location: (overrides: Record<string, any> = {}) => ({
    id: 'loc-1',
    org_id: 'test-org-id',
    name: 'Greenhouse A',
    type: 'greenhouse',
    health_status: 'clean',
    restricted_until: null,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  batch: (overrides: Record<string, any> = {}) => ({
    id: 'batch-1',
    org_id: 'test-org-id',
    batch_number: '2401001',
    location_id: 'loc-1',
    variety_id: 'var-1',
    status: 'Active',
    quantity: 100,
    initial_quantity: 100,
    planted_at: '2024-01-01',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  ipmProduct: (overrides: Record<string, any> = {}) => ({
    id: 'product-1',
    org_id: 'test-org-id',
    name: 'Neem Oil',
    pcs_number: 'PCS-001',
    active_ingredient: 'Azadirachtin',
    target_pests: ['aphids', 'whiteflies'],
    suggested_rate: 5,
    suggested_rate_unit: 'ml/L',
    max_rate: 10,
    rei_hours: 4,
    use_restriction: 'both',
    application_methods: ['Foliar Spray'],
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  ipmProgram: (overrides: Record<string, any> = {}) => ({
    id: 'program-1',
    org_id: 'test-org-id',
    name: 'Standard IPM Program',
    description: 'Weekly spray rotation',
    interval_days: 7,
    duration_weeks: 8,
    schedule_type: 'interval_based',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  plantHealthLog: (overrides: Record<string, any> = {}) => ({
    id: 'log-1',
    org_id: 'test-org-id',
    location_id: 'loc-1',
    batch_id: null,
    event_type: 'treatment',
    product_name: 'Neem Oil',
    rate: 5,
    unit: 'ml/L',
    method: 'Foliar Spray',
    recorded_by: 'test-user-id',
    event_at: '2024-01-15T10:00:00.000Z',
    created_at: '2024-01-15T10:00:00.000Z',
    ...overrides,
  }),

  ipmBottle: (overrides: Record<string, any> = {}) => ({
    id: 'bottle-1',
    org_id: 'test-org-id',
    product_id: 'product-1',
    bottle_code: 'BTL-001',
    volume_ml: 1000,
    remaining_ml: 800,
    status: 'open',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  ipmTask: (overrides: Record<string, any> = {}) => ({
    id: 'task-1',
    org_id: 'test-org-id',
    batch_id: 'batch-1',
    location_id: 'loc-1',
    program_id: 'program-1',
    product_id: 'product-1',
    product_name: 'Neem Oil',
    rate: 5,
    rate_unit: 'ml/L',
    method: 'Foliar Spray',
    scheduled_date: '2024-01-15',
    week_number: 1,
    calendar_week: 3,
    status: 'pending',
    is_tank_mix: false,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  trial: (overrides: Record<string, any> = {}) => ({
    id: 'trial-1',
    org_id: 'test-org-id',
    trial_number: 'TRL-2024-001',
    name: 'Fertilizer Comparison Trial',
    description: 'Testing different fertilizer rates',
    hypothesis: 'Higher rates will increase growth',
    status: 'draft',
    start_date: '2024-01-01',
    planned_end_date: '2024-03-01',
    measurement_frequency_days: 7,
    created_by: 'test-user-id',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  trialGroup: (overrides: Record<string, any> = {}) => ({
    id: 'group-1',
    trial_id: 'trial-1',
    name: 'Control',
    group_type: 'control',
    sort_order: 0,
    target_plant_count: 3,
    label_color: '#808080',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  trialSubject: (overrides: Record<string, any> = {}) => ({
    id: 'subject-1',
    group_id: 'group-1',
    subject_number: 1,
    label: 'Control-1',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  trialMeasurement: (overrides: Record<string, any> = {}) => ({
    id: 'measurement-1',
    subject_id: 'subject-1',
    measurement_date: '2024-01-08',
    week_number: 1,
    height_cm: 15.5,
    leaf_count: 6,
    vigor_score: 4,
    overall_health_score: 4,
    recorded_by: 'test-user-id',
    created_at: '2024-01-08T10:00:00.000Z',
    ...overrides,
  }),

  // Sales module factories
  customer: (overrides: Record<string, any> = {}) => ({
    id: 'customer-1',
    org_id: 'test-org-id',
    name: 'Test Customer',
    code: 'CUST001',
    email: 'customer@example.com',
    phone: '+353 1 234 5678',
    vat_number: 'IE1234567T',
    notes: null,
    default_price_list_id: null,
    store: null,
    accounts_email: null,
    pricing_tier: null,
    currency: 'EUR',
    country_code: 'IE',
    payment_terms_days: 30,
    credit_limit: null,
    account_code: null,
    delivery_preferences: null,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  customerAddress: (overrides: Record<string, any> = {}) => ({
    id: 'address-1',
    customer_id: 'customer-1',
    label: 'Main Address',
    store_name: null,
    line1: '123 Main Street',
    line2: null,
    city: 'Dublin',
    county: 'Dublin',
    eircode: 'D01 ABC1',
    country_code: 'IE',
    is_default_shipping: true,
    is_default_billing: true,
    contact_name: null,
    contact_email: null,
    contact_phone: null,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  customerContact: (overrides: Record<string, any> = {}) => ({
    id: 'contact-1',
    customer_id: 'customer-1',
    name: 'John Smith',
    email: 'john@example.com',
    phone: '+353 1 234 5678',
    mobile: '+353 87 123 4567',
    role: 'Buyer',
    is_primary: true,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  product: (overrides: Record<string, any> = {}) => ({
    id: 'product-1',
    org_id: 'test-org-id',
    name: 'Test Product',
    sku_id: 'sku-1',
    description: 'A test product',
    hero_image_url: null,
    default_status: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  sku: (overrides: Record<string, any> = {}) => ({
    id: 'sku-1',
    org_id: 'test-org-id',
    code: 'SKU-0001',
    display_name: 'Test SKU',
    description: null,
    barcode: '1234567890',
    default_vat_rate: 13.5,
    plant_variety_id: 'var-1',
    size_id: 'size-1',
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  order: (overrides: Record<string, any> = {}) => ({
    id: 'order-1',
    org_id: 'test-org-id',
    customer_id: 'customer-1',
    order_number: 'ORD-1704067200000',
    status: 'confirmed',
    currency: 'EUR',
    requested_delivery_date: '2024-01-15',
    ship_to_address_id: 'address-1',
    subtotal_ex_vat: 100.00,
    vat_amount: 13.50,
    total_inc_vat: 113.50,
    notes: null,
    confirmation_sent_at: null,
    dispatch_email_sent_at: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  orderItem: (overrides: Record<string, any> = {}) => ({
    id: 'order-item-1',
    order_id: 'order-1',
    product_id: 'product-1',
    sku_id: 'sku-1',
    quantity: 10,
    unit_price_ex_vat: 10.00,
    vat_rate: 13.5,
    line_total_ex_vat: 100.00,
    line_vat_amount: 13.50,
    description: 'Test Product',
    required_variety_id: null,
    required_batch_id: null,
    rrp: null,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  invoice: (overrides: Record<string, any> = {}) => ({
    id: 'invoice-1',
    org_id: 'test-org-id',
    customer_id: 'customer-1',
    order_id: 'order-1',
    invoice_number: 'INV-1704067200000',
    currency: 'EUR',
    status: 'issued',
    issue_date: '2024-01-01',
    due_date: '2024-01-31',
    subtotal_ex_vat: 100.00,
    vat_amount: 13.50,
    total_inc_vat: 113.50,
    balance_due: 113.50,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  priceList: (overrides: Record<string, any> = {}) => ({
    id: 'price-list-1',
    org_id: 'test-org-id',
    name: 'Default Price List',
    description: null,
    is_default: true,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  productPrice: (overrides: Record<string, any> = {}) => ({
    id: 'product-price-1',
    org_id: 'test-org-id',
    product_id: 'product-1',
    price_list_id: 'price-list-1',
    unit_price_ex_vat: 10.00,
    currency: 'EUR',
    min_qty: 1,
    valid_from: null,
    valid_to: null,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  pickList: (overrides: Record<string, any> = {}) => ({
    id: 'pick-list-1',
    org_id: 'test-org-id',
    order_id: 'order-1',
    assigned_team_id: null,
    assigned_user_id: null,
    sequence: 1,
    status: 'pending',
    started_at: null,
    completed_at: null,
    started_by: null,
    completed_by: null,
    notes: null,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  pickItem: (overrides: Record<string, any> = {}) => ({
    id: 'pick-item-1',
    pick_list_id: 'pick-list-1',
    order_item_id: 'order-item-1',
    target_qty: 10,
    picked_qty: 0,
    status: 'pending',
    original_batch_id: 'batch-1',
    picked_batch_id: null,
    substitution_reason: null,
    notes: null,
    picked_at: null,
    picked_by: null,
    location_hint: null,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  batchAllocation: (overrides: Record<string, any> = {}) => ({
    id: 'batch-allocation-1',
    org_id: 'test-org-id',
    order_item_id: 'order-item-1',
    batch_id: 'batch-1',
    quantity: 10,
    status: 'allocated',
    note: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  // B2B module factories
  b2bCartItem: (overrides: Record<string, any> = {}) => ({
    productId: 'product-1',
    skuId: 'sku-1',
    productName: 'Test Product',
    varietyName: 'Test Variety',
    sizeName: '2L Pot',
    sizeId: 'size-1',
    family: 'Lamiaceae',
    quantity: 10,
    unitPriceExVat: 5.00,
    vatRate: 13.5,
    requiredVarietyId: undefined,
    requiredVarietyName: undefined,
    requiredBatchId: undefined,
    batchId: undefined,
    batchNumber: undefined,
    batchAllocations: undefined,
    rrp: undefined,
    multibuyPrice2: undefined,
    multibuyQty2: undefined,
    ...overrides,
  }),

  impersonationSession: (overrides: Record<string, any> = {}) => ({
    id: 'impersonation-1',
    org_id: 'test-org-id',
    staff_user_id: 'staff-user-id',
    customer_id: 'customer-1',
    started_at: '2024-01-01T00:00:00.000Z',
    ended_at: null,
    notes: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  // Dispatch module factories
  deliveryRun: (overrides: Record<string, any> = {}) => ({
    id: 'delivery-run-1',
    org_id: 'test-org-id',
    run_number: 'DR-20240115-001',
    run_date: '2024-01-15',
    load_name: '4L',
    week_number: 3,
    haulier_id: 'haulier-1',
    vehicle_id: 'vehicle-1',
    driver_name: 'John Driver',
    vehicle_registration: '241-D-12345',
    vehicle_type: 'van',
    planned_departure_time: '2024-01-15T08:00:00.000Z',
    actual_departure_time: null,
    estimated_return_time: '2024-01-15T18:00:00.000Z',
    actual_return_time: null,
    status: 'planned',
    trolleys_loaded: 0,
    trolleys_returned: 0,
    route_notes: null,
    display_order: 0,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    created_by: 'test-user-id',
    ...overrides,
  }),

  deliveryItem: (overrides: Record<string, any> = {}) => ({
    id: 'delivery-item-1',
    org_id: 'test-org-id',
    delivery_run_id: 'delivery-run-1',
    order_id: 'order-1',
    sequence_number: 1,
    estimated_delivery_time: null,
    actual_delivery_time: null,
    delivery_window_start: '09:00',
    delivery_window_end: '12:00',
    status: 'pending',
    trolleys_delivered: 2,
    trolleys_returned: 0,
    trolleys_outstanding: 2,
    recipient_name: null,
    recipient_signature_url: null,
    delivery_notes: null,
    delivery_photo_url: null,
    failure_reason: null,
    rescheduled_to: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  haulier: (overrides: Record<string, any> = {}) => ({
    id: 'haulier-1',
    org_id: 'test-org-id',
    name: 'Fast Delivery Co',
    contact_name: 'Mike Manager',
    contact_phone: '+353 1 234 5678',
    contact_email: 'mike@fastdelivery.ie',
    notes: null,
    trolley_capacity: 20,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  haulierVehicle: (overrides: Record<string, any> = {}) => ({
    id: 'vehicle-1',
    org_id: 'test-org-id',
    haulier_id: 'haulier-1',
    name: 'Van 1',
    registration: '241-D-12345',
    vehicle_type: 'van',
    trolley_capacity: 10,
    is_active: true,
    notes: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  orderPacking: (overrides: Record<string, any> = {}) => ({
    id: 'packing-1',
    org_id: 'test-org-id',
    order_id: 'order-1',
    status: 'not_started',
    trolleys_used: 0,
    total_units: null,
    verified_by: null,
    verified_at: null,
    packing_notes: null,
    special_instructions: null,
    packing_started_at: null,
    packing_completed_at: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  trolley: (overrides: Record<string, any> = {}) => ({
    id: 'trolley-1',
    org_id: 'test-org-id',
    trolley_number: 'T001',
    trolley_type: 'danish',
    status: 'available',
    current_location: null,
    customer_id: null,
    delivery_run_id: null,
    condition_notes: null,
    last_inspection_date: null,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  trolleyTransaction: (overrides: Record<string, any> = {}) => ({
    id: 'trolley-transaction-1',
    org_id: 'test-org-id',
    trolley_id: 'trolley-1',
    transaction_type: 'loaded',
    quantity: 1,
    customer_id: null,
    delivery_run_id: 'delivery-run-1',
    delivery_item_id: null,
    notes: null,
    recorded_by: 'test-user-id',
    transaction_date: '2024-01-15T08:00:00.000Z',
    created_at: '2024-01-15T08:00:00.000Z',
    ...overrides,
  }),

  growerMember: (overrides: Record<string, any> = {}) => ({
    id: 'grower-1',
    name: 'Jane Picker',
    email: 'jane@example.com',
    ...overrides,
  }),

  // Materials module factories
  materialCategory: (overrides: Record<string, any> = {}) => ({
    id: 'category-1',
    code: 'POT',
    name: 'Pots',
    parent_group: 'Containers',
    consumption_type: 'per_unit',
    sort_order: 1,
    created_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  material: (overrides: Record<string, any> = {}) => ({
    id: 'material-1',
    org_id: 'test-org-id',
    part_number: 'M-POT-001',
    name: '2L Black Pot',
    description: 'Standard 2 litre black plastic pot',
    category_id: 'category-1',
    linked_size_id: null,
    base_uom: 'each',
    default_supplier_id: null,
    reorder_point: 100,
    reorder_quantity: 500,
    target_stock: 1000,
    standard_cost: 0.25,
    barcode: null,
    internal_barcode: 'HT:test-org:M-POT-001',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  materialStock: (overrides: Record<string, any> = {}) => ({
    id: 'stock-1',
    org_id: 'test-org-id',
    material_id: 'material-1',
    location_id: null,
    quantity_on_hand: 500,
    quantity_reserved: 50,
    quantity_available: 450,
    last_counted_at: null,
    last_movement_at: '2024-01-15T10:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-15T10:00:00.000Z',
    ...overrides,
  }),

  materialTransaction: (overrides: Record<string, any> = {}) => ({
    id: 'transaction-1',
    org_id: 'test-org-id',
    material_id: 'material-1',
    transaction_type: 'receive',
    quantity: 100,
    uom: 'each',
    from_location_id: null,
    to_location_id: null,
    purchase_order_line_id: null,
    batch_id: null,
    quantity_after: 600,
    reference: 'PO-2024-00001',
    notes: null,
    cost_per_unit: 0.25,
    created_by: 'test-user-id',
    created_at: '2024-01-15T10:00:00.000Z',
    ...overrides,
  }),

  materialConsumptionRule: (overrides: Record<string, any> = {}) => ({
    id: 'rule-1',
    org_id: 'test-org-id',
    material_id: 'material-1',
    size_id: 'size-1',
    quantity_per_unit: 1,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }),

  purchaseOrder: (overrides: Record<string, any> = {}) => ({
    id: 'po-1',
    org_id: 'test-org-id',
    po_number: 'PO-2024-00001',
    supplier_id: 'supplier-1',
    status: 'draft',
    order_date: '2024-01-15',
    expected_delivery_date: '2024-01-22',
    subtotal: 100.00,
    tax_amount: 23.00,
    total_amount: 123.00,
    delivery_location_id: null,
    delivery_notes: null,
    supplier_ref: null,
    notes: null,
    created_by: 'test-user-id',
    created_at: '2024-01-15T00:00:00.000Z',
    updated_at: '2024-01-15T00:00:00.000Z',
    submitted_at: null,
    received_at: null,
    ...overrides,
  }),

  purchaseOrderLine: (overrides: Record<string, any> = {}) => ({
    id: 'po-line-1',
    purchase_order_id: 'po-1',
    material_id: 'material-1',
    line_number: 1,
    quantity_ordered: 500,
    quantity_received: 0,
    uom: 'each',
    unit_price: 0.20,
    discount_pct: 0,
    line_total: 100.00,
    notes: null,
    created_at: '2024-01-15T00:00:00.000Z',
    updated_at: '2024-01-15T00:00:00.000Z',
    ...overrides,
  }),
};

// ============================================================================
// Jest Mock Setup Helpers
// ============================================================================

export const setupAuthMocks = (mockSupabase: SupabaseClient) => {
  jest.mock('@/lib/supabase/server', () => ({
    createClient: jest.fn(() => Promise.resolve(mockSupabase)),
  }));

  jest.mock('@/server/db/supabase', () => ({
    getSupabaseAdmin: jest.fn(() => mockSupabase),
  }));
};

// ============================================================================
// Assertion Helpers
// ============================================================================

export const expectSuccess = <T>(result: { success: boolean; data?: T; error?: string }) => {
  expect(result.success).toBe(true);
  expect(result.error).toBeUndefined();
  return result.data;
};

export const expectError = (
  result: { success: boolean; error?: string },
  expectedError?: string | RegExp
) => {
  expect(result.success).toBe(false);
  expect(result.error).toBeDefined();
  if (expectedError) {
    if (typeof expectedError === 'string') {
      expect(result.error).toContain(expectedError);
    } else {
      expect(result.error).toMatch(expectedError);
    }
  }
};

