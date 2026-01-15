/**
 * Unit tests for ipm.ts server actions
 */

import {
  createMockSupabaseClient,
  createMockUser,
  factories,
  MockSupabaseQueryBuilder,
} from '@/lib/__tests__/test-utils';

// Mock the dependencies
const mockSupabase = createMockSupabaseClient() as any;
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

import {
  listIpmProducts,
  getIpmProduct,
  createIpmProduct,
  updateIpmProduct,
  deleteIpmProduct,
  listIpmPrograms,
  getIpmProgram,
  createIpmProgram,
  updateIpmProgram,
  deleteIpmProgram,
  listIpmAssignments,
  createIpmAssignment,
  deactivateIpmAssignment,
  listIpmSpotTreatments,
  createIpmSpotTreatment,
  recordSpotTreatmentApplication,
  cancelSpotTreatment,
  getUpcomingTreatments,
  getPlantFamilies,
  listLocations,
} from '../ipm';

describe('ipm actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // IPM Products CRUD
  // ============================================================================
  describe('IPM Products', () => {
    describe('listIpmProducts', () => {
      it('should return list of IPM products', async () => {
        const mockProducts = [
          factories.ipmProduct({ id: 'p1', name: 'Neem Oil' }),
          factories.ipmProduct({ id: 'p2', name: 'Pyrethrin' }),
        ];

        mockSupabase.from = jest.fn((table: string) => {
          if (table === 'ipm_products') {
            return new MockSupabaseQueryBuilder({ data: mockProducts, error: null });
          }
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await listIpmProducts();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data![0].name).toBe('Neem Oil');
      });

      it('should handle database error', async () => {
        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Query failed' },
          });
        });

        const result: any = await listIpmProducts();

        expect(result.success).toBe(false);
        expect(result.error).toBe('Query failed');
      });
    });

    describe('getIpmProduct', () => {
      it('should return a single IPM product', async () => {
        const mockProduct = factories.ipmProduct({ id: 'p1', name: 'Neem Oil' });

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockProduct, error: null });
        });

        const result: any = await getIpmProduct('p1');

        expect(result.success).toBe(true);
        expect(result.data?.name).toBe('Neem Oil');
        expect(result.data?.reiHours).toBeDefined();
      });

      it('should handle not found error', async () => {
        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Not found', code: 'PGRST116' },
          });
        });

        const result: any = await getIpmProduct('nonexistent');

        expect(result.success).toBe(false);
      });
    });

    describe('createIpmProduct', () => {
      it('should create a new IPM product', async () => {
        const mockProduct = factories.ipmProduct({ id: 'new-product' });

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockProduct, error: null });
        });

        const result: any = await createIpmProduct({
          name: 'New Product',
          pcsNumber: 'PCS-123',
          activeIngredient: 'Spinosad',
          targetPests: ['caterpillars'],
          suggestedRate: 2,
          suggestedRateUnit: 'ml/L',
          reiHours: 12,
        });

        expect(result.success).toBe(true);
        expect(result.data?.id).toBe('new-product');
      });

      it('should handle duplicate name error', async () => {
        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'duplicate key value' },
          });
        });

        const result: any = await createIpmProduct({
          name: 'Existing Product',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('duplicate');
      });
    });

    describe('updateIpmProduct', () => {
      it('should update an IPM product', async () => {
        const mockProduct = factories.ipmProduct({ id: 'p1', name: 'Updated Name' });

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockProduct, error: null });
        });

        const result: any = await updateIpmProduct('p1', { name: 'Updated Name' });

        expect(result.success).toBe(true);
        expect(result.data?.name).toBe('Updated Name');
      });
    });

    describe('deleteIpmProduct', () => {
      it('should delete an IPM product', async () => {
        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await deleteIpmProduct('p1');

        expect(result.success).toBe(true);
      });

      it('should handle foreign key constraint error', async () => {
        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'violates foreign key constraint' },
          });
        });

        const result: any = await deleteIpmProduct('p1');

        expect(result.success).toBe(false);
        expect(result.error).toContain('foreign key');
      });
    });
  });

  // ============================================================================
  // IPM Programs CRUD
  // ============================================================================
  describe('IPM Programs', () => {
    describe('listIpmPrograms', () => {
      it('should return list of IPM programs with steps', async () => {
        const mockPrograms = [
          {
            ...factories.ipmProgram({ id: 'prog1' }),
            ipm_program_steps: [
              {
                id: 'step1',
                program_id: 'prog1',
                product_id: 'p1',
                step_order: 1,
                week_number: 1,
                ipm_products: factories.ipmProduct(),
              },
            ],
          },
        ];

        mockSupabase.from = jest.fn((table: string) => {
          if (table === 'ipm_programs') {
            return new MockSupabaseQueryBuilder({ data: mockPrograms, error: null });
          }
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await listIpmPrograms();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].steps).toHaveLength(1);
      });
    });

    describe('getIpmProgram', () => {
      it('should return a single program with steps', async () => {
        const mockProgram = {
          ...factories.ipmProgram({ id: 'prog1' }),
          ipm_program_steps: [],
        };

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockProgram, error: null });
        });

        const result: any = await getIpmProgram('prog1');

        expect(result.success).toBe(true);
        expect(result.data?.id).toBe('prog1');
      });
    });

    describe('createIpmProgram', () => {
      it('should create a program with steps', async () => {
        const mockProgram = factories.ipmProgram({ id: 'new-prog' });

        let insertCallCount = 0;
        mockSupabase.from = jest.fn((table: string) => {
          if (table === 'ipm_programs') {
            insertCallCount++;
            if (insertCallCount === 1) {
              // First call - insert
              return new MockSupabaseQueryBuilder({ data: mockProgram, error: null });
            }
            // Second call - select for return
            return new MockSupabaseQueryBuilder({
              data: { ...mockProgram, ipm_program_steps: [] },
              error: null,
            });
          }
          if (table === 'ipm_program_steps') {
            return new MockSupabaseQueryBuilder({ data: null, error: null });
          }
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await createIpmProgram({
          name: 'New Program',
          description: 'Test program',
          intervalDays: 7,
          durationWeeks: 8,
          steps: [
            {
              productId: 'p1',
              rate: 5,
              rateUnit: 'ml/L',
              weekNumber: 1,
            },
          ],
        });

        expect(result.success).toBe(true);
      });

      it('should rollback on step insert failure', async () => {
        const mockProgram = factories.ipmProgram({ id: 'new-prog' });

        mockSupabase.from = jest.fn((table: string) => {
          if (table === 'ipm_programs') {
            return new MockSupabaseQueryBuilder({ data: mockProgram, error: null });
          }
          if (table === 'ipm_program_steps') {
            return new MockSupabaseQueryBuilder({
              data: null,
              error: { message: 'Step insert failed' },
            });
          }
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await createIpmProgram({
          name: 'New Program',
          steps: [{ productId: 'p1' }],
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Step insert failed');
      });
    });

    describe('updateIpmProgram', () => {
      it('should update program and replace steps', async () => {
        const mockProgram = {
          ...factories.ipmProgram({ id: 'prog1' }),
          ipm_program_steps: [],
        };

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockProgram, error: null });
        });

        const result: any = await updateIpmProgram('prog1', {
          name: 'Updated Program',
          steps: [{ productId: 'p2', weekNumber: 2 }],
        });

        expect(result.success).toBe(true);
      });
    });

    describe('deleteIpmProgram', () => {
      it('should delete a program', async () => {
        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await deleteIpmProgram('prog1');

        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================================================
  // IPM Assignments
  // ============================================================================
  describe('IPM Assignments', () => {
    describe('listIpmAssignments', () => {
      it('should return assignments with filters', async () => {
        const mockAssignments = [
          {
            id: 'assign1',
            org_id: mockOrgId,
            program_id: 'prog1',
            target_type: 'family',
            target_family: 'Bedding',
            starts_at: '2024-01-01',
            is_active: true,
            ipm_programs: factories.ipmProgram(),
            nursery_locations: null,
          },
        ];

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockAssignments, error: null });
        });

        const result: any = await listIpmAssignments({ activeOnly: true });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].targetType).toBe('family');
      });
    });

    describe('createIpmAssignment', () => {
      it('should create a family assignment', async () => {
        const mockAssignment = {
          id: 'new-assign',
          org_id: mockOrgId,
          program_id: 'prog1',
          target_type: 'family',
          target_family: 'Bedding',
          ipm_programs: factories.ipmProgram(),
          nursery_locations: null,
        };

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockAssignment, error: null });
        });

        const result: any = await createIpmAssignment({
          programId: 'prog1',
          targetType: 'family',
          targetFamily: 'Bedding',
        });

        expect(result.success).toBe(true);
        expect(result.data?.targetFamily).toBe('Bedding');
      });

      it('should create a location assignment with end date', async () => {
        const mockProgram = factories.ipmProgram({ duration_weeks: 8 });
        const mockAssignment = {
          id: 'new-assign',
          org_id: mockOrgId,
          program_id: 'prog1',
          target_type: 'location',
          target_location_id: 'loc-1',
          starts_at: '2024-01-01',
          ends_at: '2024-02-26',
          ipm_programs: mockProgram,
          nursery_locations: { id: 'loc-1', name: 'GH A' },
        };

        mockSupabase.from = jest.fn((table: string) => {
          if (table === 'ipm_programs') {
            return new MockSupabaseQueryBuilder({ data: mockProgram, error: null });
          }
          return new MockSupabaseQueryBuilder({ data: mockAssignment, error: null });
        });

        const result: any = await createIpmAssignment({
          programId: 'prog1',
          targetType: 'location',
          targetLocationId: 'loc-1',
          startsAt: '2024-01-01',
        });

        expect(result.success).toBe(true);
      });
    });

    describe('deactivateIpmAssignment', () => {
      it('should deactivate an assignment', async () => {
        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await deactivateIpmAssignment('assign1');

        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================================================
  // IPM Spot Treatments
  // ============================================================================
  describe('IPM Spot Treatments', () => {
    describe('listIpmSpotTreatments', () => {
      it('should return spot treatments with filters', async () => {
        const mockTreatments = [
          {
            id: 'spot1',
            org_id: mockOrgId,
            product_id: 'p1',
            target_type: 'location',
            target_location_id: 'loc-1',
            applications_total: 3,
            applications_completed: 1,
            status: 'in_progress',
            ipm_products: factories.ipmProduct(),
            nursery_locations: { id: 'loc-1', name: 'GH A' },
            batches: null,
          },
        ];

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockTreatments, error: null });
        });

        const result: any = await listIpmSpotTreatments({ locationId: 'loc-1' });

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data![0].applicationsCompleted).toBe(1);
      });
    });

    describe('createIpmSpotTreatment', () => {
      it('should create a spot treatment for a location', async () => {
        const mockTreatment = {
          id: 'new-spot',
          org_id: mockOrgId,
          product_id: 'p1',
          target_type: 'location',
          target_location_id: 'loc-1',
          applications_total: 3,
          applications_completed: 0,
          status: 'scheduled',
          ipm_products: factories.ipmProduct(),
          nursery_locations: { id: 'loc-1', name: 'GH A' },
          batches: null,
        };

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockTreatment, error: null });
        });

        const result: any = await createIpmSpotTreatment({
          productId: 'p1',
          targetType: 'location',
          targetLocationId: 'loc-1',
          firstApplicationDate: '2024-01-15',
          applicationsTotal: 3,
          applicationIntervalDays: 7,
          rate: 5,
          rateUnit: 'ml/L',
          reason: 'Aphid outbreak',
        });

        expect(result.success).toBe(true);
        expect(result.data?.status).toBe('scheduled');
      });
    });

    describe('recordSpotTreatmentApplication', () => {
      it('should record application and update status', async () => {
        const mockCurrent = {
          id: 'spot1',
          product_id: 'p1',
          target_location_id: 'loc-1',
          applications_total: 3,
          applications_completed: 1,
          ipm_products: factories.ipmProduct(),
        };

        const mockUpdated = {
          ...mockCurrent,
          applications_completed: 2,
          status: 'in_progress',
          nursery_locations: { id: 'loc-1', name: 'GH A' },
          batches: null,
        };

        let callCount = 0;
        mockSupabase.from = jest.fn((table: string) => {
          if (table === 'ipm_spot_treatments') {
            callCount++;
            if (callCount === 1) {
              return new MockSupabaseQueryBuilder({ data: mockCurrent, error: null });
            }
            return new MockSupabaseQueryBuilder({ data: mockUpdated, error: null });
          }
          if (table === 'plant_health_logs') {
            return new MockSupabaseQueryBuilder({ data: null, error: null });
          }
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await recordSpotTreatmentApplication('spot1', 'Application 2');

        expect(result.success).toBe(true);
        expect(result.data?.applicationsCompleted).toBe(2);
      });

      it('should mark as completed when all applications done', async () => {
        const mockCurrent = {
          id: 'spot1',
          product_id: 'p1',
          target_location_id: 'loc-1',
          applications_total: 3,
          applications_completed: 2,
          ipm_products: factories.ipmProduct(),
        };

        const mockUpdated = {
          ...mockCurrent,
          applications_completed: 3,
          status: 'completed',
          nursery_locations: { id: 'loc-1', name: 'GH A' },
          batches: null,
        };

        let callCount = 0;
        mockSupabase.from = jest.fn((table: string) => {
          if (table === 'ipm_spot_treatments') {
            callCount++;
            if (callCount === 1) {
              return new MockSupabaseQueryBuilder({ data: mockCurrent, error: null });
            }
            return new MockSupabaseQueryBuilder({ data: mockUpdated, error: null });
          }
          if (table === 'plant_health_logs') {
            return new MockSupabaseQueryBuilder({ data: null, error: null });
          }
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await recordSpotTreatmentApplication('spot1');

        expect(result.success).toBe(true);
        expect(result.data?.status).toBe('completed');
      });

      it('should handle not found error', async () => {
        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({
            data: null,
            error: { message: 'Not found', code: 'PGRST116' },
          });
        });

        const result: any = await recordSpotTreatmentApplication('nonexistent');

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('cancelSpotTreatment', () => {
      it('should cancel a spot treatment', async () => {
        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: null, error: null });
        });

        const result: any = await cancelSpotTreatment('spot1');

        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================================================
  // Dashboard Queries
  // ============================================================================
  describe('Dashboard Queries', () => {
    describe('getUpcomingTreatments', () => {
      it('should return upcoming treatments within date range', async () => {
        const mockTreatments = [
          {
            id: 'spot1',
            org_id: mockOrgId,
            product_id: 'p1',
            target_type: 'location',
            status: 'scheduled',
            next_application_date: '2024-01-20',
            ipm_products: factories.ipmProduct(),
            nursery_locations: { id: 'loc-1', name: 'GH A' },
            batches: null,
          },
        ];

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockTreatments, error: null });
        });

        const result: any = await getUpcomingTreatments(7);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
      });
    });

    describe('getPlantFamilies', () => {
      it('should return unique plant families', async () => {
        const mockVarieties = [
          { family: 'Bedding' },
          { family: 'Perennial' },
          { family: 'Bedding' }, // Duplicate
          { family: null },
        ];

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockVarieties, error: null });
        });

        const result: any = await getPlantFamilies();

        expect(result.success).toBe(true);
        expect(result.data).toContain('Bedding');
        expect(result.data).toContain('Perennial');
        expect(result.data).toHaveLength(2);
      });
    });

    describe('listLocations', () => {
      it('should return locations with health status', async () => {
        const mockLocations = [
          {
            id: 'loc-1',
            name: 'Greenhouse A',
            health_status: 'clean',
            restricted_until: null,
          },
          {
            id: 'loc-2',
            name: 'Greenhouse B',
            health_status: 'restricted',
            restricted_until: '2024-01-20T18:00:00.000Z',
          },
        ];

        mockSupabase.from = jest.fn((table: string) => {
          return new MockSupabaseQueryBuilder({ data: mockLocations, error: null });
        });

        const result: any = await listLocations();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(result.data![1].healthStatus).toBe('restricted');
      });
    });
  });
});




