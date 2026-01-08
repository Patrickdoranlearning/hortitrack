/**
 * Unit tests for plant-health.ts server actions
 */

import {
  createMockSupabaseClient,
  createMockUser,
  factories,
  MockSupabaseQueryBuilder,
} from '@/lib/__tests__/test-utils';

// Mock the dependencies before importing the module under test
const mockSupabase = createMockSupabaseClient();
const mockUser = createMockUser();
const mockOrgId = 'test-org-id';

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

jest.mock('@/server/auth/org', () => ({
  getUserAndOrg: jest.fn(() =>
    Promise.resolve({
      user: mockUser,
      orgId: mockOrgId,
      supabase: mockSupabase,
    })
  ),
}));

// Import after mocks are set up
import {
  applyLocationTreatment,
  logMeasurement,
  flagLocation,
  clearLocation,
  getLocationHealthLogs,
  getBatchHealthLogs,
  createScoutLog,
  scheduleTreatment,
} from '../plant-health';

describe('plant-health actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // applyLocationTreatment
  // ============================================================================
  describe('applyLocationTreatment', () => {
    it('should successfully apply treatment to batches at a location', async () => {
      const mockBatches = [
        factories.batch({ id: 'batch-1' }),
        factories.batch({ id: 'batch-2' }),
      ];

      // Mock finding batches
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({
            data: mockBatches,
            error: null,
          });
        }
        if (table === 'plant_health_logs') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        if (table === 'nursery_locations') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await applyLocationTreatment({
        locationId: 'loc-1',
        productName: 'Neem Oil',
        rate: 5,
        unit: 'ml/L',
        method: 'Foliar Spray',
        reiHours: 4,
        notes: 'Test treatment',
      });

      expect(result.success).toBe(true);
      expect(result.data?.count).toBe(2);
    });

    it('should return error when no batches found at location', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({ data: [], error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await applyLocationTreatment({
        locationId: 'loc-1',
        productName: 'Neem Oil',
        rate: 5,
        unit: 'ml/L',
        method: 'Foliar Spray',
        reiHours: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No active batches');
    });

    it('should handle database error when fetching batches', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'batches') {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Database error' },
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await applyLocationTreatment({
        locationId: 'loc-1',
        productName: 'Neem Oil',
        rate: 5,
        unit: 'ml/L',
        method: 'Foliar Spray',
        reiHours: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to find batches');
    });
  });

  // ============================================================================
  // logMeasurement
  // ============================================================================
  describe('logMeasurement', () => {
    it('should successfully log EC measurement', async () => {
      const mockLog = factories.plantHealthLog({
        id: 'log-1',
        event_type: 'measurement',
        ec_reading: 2.5,
      });

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'plant_health_logs') {
          return new MockSupabaseQueryBuilder({ data: mockLog, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await logMeasurement({
        locationId: 'loc-1',
        ec: 2.5,
      });

      expect(result.success).toBe(true);
      expect(result.data?.logId).toBe('log-1');
    });

    it('should successfully log pH measurement', async () => {
      const mockLog = factories.plantHealthLog({
        id: 'log-2',
        event_type: 'measurement',
        ph_reading: 6.5,
      });

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'plant_health_logs') {
          return new MockSupabaseQueryBuilder({ data: mockLog, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await logMeasurement({
        locationId: 'loc-1',
        ph: 6.5,
      });

      expect(result.success).toBe(true);
      expect(result.data?.logId).toBe('log-2');
    });

    it('should return error when no measurement provided', async () => {
      const result = await logMeasurement({
        locationId: 'loc-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least one measurement');
    });

    it('should handle database error', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'plant_health_logs') {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Insert failed' },
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await logMeasurement({
        locationId: 'loc-1',
        ec: 2.5,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to log measurement');
    });
  });

  // ============================================================================
  // flagLocation
  // ============================================================================
  describe('flagLocation', () => {
    it('should successfully flag a location with an issue', async () => {
      const mockLog = factories.plantHealthLog({
        id: 'log-1',
        event_type: 'scout_flag',
        issue_reason: 'aphids',
        severity: 'medium',
      });

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'plant_health_logs') {
          return new MockSupabaseQueryBuilder({ data: mockLog, error: null });
        }
        if (table === 'nursery_locations') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await flagLocation({
        locationId: 'loc-1',
        issueReason: 'aphids',
        severity: 'medium',
        notes: 'Heavy infestation on bench 3',
      });

      expect(result.success).toBe(true);
      expect(result.data?.logId).toBe('log-1');
    });

    it('should handle critical severity flags', async () => {
      const mockLog = factories.plantHealthLog({
        id: 'log-1',
        event_type: 'scout_flag',
        severity: 'critical',
      });

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'plant_health_logs') {
          return new MockSupabaseQueryBuilder({ data: mockLog, error: null });
        }
        if (table === 'nursery_locations') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await flagLocation({
        locationId: 'loc-1',
        issueReason: 'botrytis',
        severity: 'critical',
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================================
  // clearLocation
  // ============================================================================
  describe('clearLocation', () => {
    it('should successfully clear a location', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await clearLocation({
        locationId: 'loc-1',
        notes: 'All clear after treatment',
      });

      expect(result.success).toBe(true);
    });

    it('should handle database error during clearance', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'plant_health_logs') {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Insert failed' },
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await clearLocation({
        locationId: 'loc-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to log clearance');
    });
  });

  // ============================================================================
  // getLocationHealthLogs
  // ============================================================================
  describe('getLocationHealthLogs', () => {
    it('should return health logs for a location', async () => {
      const mockLogs = [
        factories.plantHealthLog({ id: 'log-1', event_type: 'treatment' }),
        factories.plantHealthLog({ id: 'log-2', event_type: 'measurement' }),
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'plant_health_logs') {
          return new MockSupabaseQueryBuilder({ data: mockLogs, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await getLocationHealthLogs('loc-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('should handle database error', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'plant_health_logs') {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Query failed' },
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await getLocationHealthLogs('loc-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Query failed');
    });
  });

  // ============================================================================
  // getBatchHealthLogs
  // ============================================================================
  describe('getBatchHealthLogs', () => {
    it('should return health logs for a batch', async () => {
      const mockLogs = [
        factories.plantHealthLog({ id: 'log-1', batch_id: 'batch-1', event_type: 'treatment' }),
      ];

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'plant_health_logs') {
          return new MockSupabaseQueryBuilder({ data: mockLogs, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await getBatchHealthLogs('batch-1');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  // ============================================================================
  // createScoutLog
  // ============================================================================
  describe('createScoutLog', () => {
    it('should create an issue log', async () => {
      const mockLog = factories.plantHealthLog({
        id: 'log-1',
        event_type: 'scout_flag',
      });

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'plant_health_logs') {
          return new MockSupabaseQueryBuilder({ data: mockLog, error: null });
        }
        if (table === 'nursery_locations') {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await createScoutLog({
        locationId: 'loc-1',
        logType: 'issue',
        issueReason: 'thrips',
        severity: 'medium',
      });

      expect(result.success).toBe(true);
      expect(result.data?.logId).toBe('log-1');
    });

    it('should create a reading log', async () => {
      const mockLog = factories.plantHealthLog({
        id: 'log-2',
        event_type: 'measurement',
      });

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'plant_health_logs') {
          return new MockSupabaseQueryBuilder({ data: mockLog, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await createScoutLog({
        locationId: 'loc-1',
        logType: 'reading',
        ec: 2.5,
        ph: 6.2,
      });

      expect(result.success).toBe(true);
      expect(result.data?.logId).toBe('log-2');
    });

    it('should return error when issue type is missing reason', async () => {
      const result = await createScoutLog({
        locationId: 'loc-1',
        logType: 'issue',
        severity: 'medium',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Issue reason is required');
    });

    it('should return error when reading type has no measurements', async () => {
      const result = await createScoutLog({
        locationId: 'loc-1',
        logType: 'reading',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('At least one measurement');
    });

    it('should return error when neither location nor batch is provided', async () => {
      const result = await createScoutLog({
        logType: 'issue',
        issueReason: 'aphids',
        severity: 'low',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Either a location or batch is required');
    });
  });

  // ============================================================================
  // scheduleTreatment
  // ============================================================================
  describe('scheduleTreatment', () => {
    it('should schedule a chemical treatment', async () => {
      const mockTreatment = { id: 'treatment-1' };

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'ipm_spot_treatments') {
          return new MockSupabaseQueryBuilder({ data: mockTreatment, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await scheduleTreatment({
        locationId: 'loc-1',
        treatmentType: 'chemical',
        productId: 'product-1',
        productName: 'Neem Oil',
        rate: 5,
        rateUnit: 'ml/L',
        method: 'Foliar Spray',
        scheduledDate: '2024-01-20',
        applicationsTotal: 3,
        applicationIntervalDays: 7,
      });

      expect(result.success).toBe(true);
      expect(result.data?.treatmentId).toBe('treatment-1');
    });

    it('should schedule a mechanical treatment', async () => {
      const mockTreatment = { id: 'treatment-2' };

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'ipm_spot_treatments') {
          return new MockSupabaseQueryBuilder({ data: mockTreatment, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await scheduleTreatment({
        locationId: 'loc-1',
        treatmentType: 'mechanical',
        mechanicalAction: 'trimming',
        scheduledDate: '2024-01-20',
      });

      expect(result.success).toBe(true);
      expect(result.data?.treatmentId).toBe('treatment-2');
    });

    it('should schedule a feeding treatment', async () => {
      const mockTreatment = { id: 'treatment-3' };

      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'ipm_spot_treatments') {
          return new MockSupabaseQueryBuilder({ data: mockTreatment, error: null });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await scheduleTreatment({
        locationId: 'loc-1',
        treatmentType: 'feeding',
        fertilizerName: '20-20-20',
        fertilizerRate: 1,
        fertilizerUnit: 'g/L',
        scheduledDate: '2024-01-20',
      });

      expect(result.success).toBe(true);
      expect(result.data?.treatmentId).toBe('treatment-3');
    });

    it('should handle database error', async () => {
      mockSupabase.from = jest.fn((table: string) => {
        if (table === 'ipm_spot_treatments') {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Insert failed' },
          });
        }
        return new MockSupabaseQueryBuilder({ data: null, error: null });
      });

      const result = await scheduleTreatment({
        locationId: 'loc-1',
        treatmentType: 'chemical',
        scheduledDate: '2024-01-20',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insert failed');
    });
  });
});




