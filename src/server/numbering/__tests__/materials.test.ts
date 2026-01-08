/**
 * Unit tests for numbering/materials.ts
 */

import {
  createMockSupabaseClient,
  createMockUser,
  MockSupabaseQueryBuilder,
} from '@/lib/__tests__/test-utils';

// Mock dependencies
const mockSupabase = createMockSupabaseClient();
const mockUser = createMockUser();
const mockOrgId = 'test-org-id';

jest.mock('@/server/auth/org', () => ({
  getUserAndOrg: jest.fn(() =>
    Promise.resolve({
      user: mockUser,
      orgId: mockOrgId,
      supabase: mockSupabase,
    })
  ),
}));

// Import after mocks
import {
  generatePartNumber,
  generatePONumber,
  generateInternalBarcode,
} from '../materials';

describe('numbering/materials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // generatePartNumber
  // ============================================================================
  describe('generatePartNumber', () => {
    it('should generate part number with correct format: M-{CODE}-{SEQ}', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: 1, error: null })
      );

      const result = await generatePartNumber('POT');

      expect(result).toBe('M-POT-001');
      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_counter', {
        p_org_id: mockOrgId,
        p_key: 'material-POT',
      });
    });

    it('should pad sequence numbers correctly', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: 42, error: null })
      );

      const result = await generatePartNumber('TRY');

      expect(result).toBe('M-TRY-042');
    });

    it('should handle large sequence numbers', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: 999, error: null })
      );

      const result = await generatePartNumber('SOI');

      expect(result).toBe('M-SOI-999');
    });

    it('should handle sequence numbers over 999', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: 1234, error: null })
      );

      const result = await generatePartNumber('LBL');

      expect(result).toBe('M-LBL-1234');
    });

    it('should throw error on RPC failure', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: null, error: { message: 'RPC failed' } })
      );

      await expect(generatePartNumber('POT')).rejects.toThrow(
        'Part number generation failed: RPC failed'
      );
    });

    it('should use category code in counter key', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: 1, error: null })
      );

      await generatePartNumber('FRT');

      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_counter', {
        p_org_id: mockOrgId,
        p_key: 'material-FRT',
      });
    });
  });

  // ============================================================================
  // generatePONumber
  // ============================================================================
  describe('generatePONumber', () => {
    it('should generate PO number with correct format: PO-{YEAR}-{SEQ}', async () => {
      const currentYear = new Date().getFullYear();
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: 1, error: null })
      );

      const result = await generatePONumber();

      expect(result).toBe(`PO-${currentYear}-00001`);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_counter', {
        p_org_id: mockOrgId,
        p_key: `po-${currentYear}`,
      });
    });

    it('should pad sequence numbers to 5 digits', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: 123, error: null })
      );

      const result = await generatePONumber();
      const currentYear = new Date().getFullYear();

      expect(result).toBe(`PO-${currentYear}-00123`);
    });

    it('should handle large sequence numbers', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: 99999, error: null })
      );

      const result = await generatePONumber();
      const currentYear = new Date().getFullYear();

      expect(result).toBe(`PO-${currentYear}-99999`);
    });

    it('should throw error on RPC failure', async () => {
      mockSupabase.rpc = jest.fn(() =>
        Promise.resolve({ data: null, error: { message: 'RPC failed' } })
      );

      await expect(generatePONumber()).rejects.toThrow(
        'PO number generation failed: RPC failed'
      );
    });
  });

  // ============================================================================
  // generateInternalBarcode
  // ============================================================================
  describe('generateInternalBarcode', () => {
    it('should generate barcode with correct format: HT:{ORG_PREFIX}:{PART_NUMBER}', () => {
      const result = generateInternalBarcode('abc12345-6789-0123', 'M-POT-001');

      expect(result).toBe('HT:abc12345:M-POT-001');
    });

    it('should use first 8 characters of org ID', () => {
      const result = generateInternalBarcode('12345678-9abc-defg', 'M-TRY-042');

      expect(result).toBe('HT:12345678:M-TRY-042');
    });

    it('should handle short org IDs', () => {
      const result = generateInternalBarcode('short', 'M-SOI-001');

      expect(result).toBe('HT:short:M-SOI-001');
    });

    it('should handle various part number formats', () => {
      const result1 = generateInternalBarcode('testorg1', 'M-POT-001');
      const result2 = generateInternalBarcode('testorg1', 'M-FRT-999');
      const result3 = generateInternalBarcode('testorg1', 'M-BIO-1234');

      expect(result1).toBe('HT:testorg1:M-POT-001');
      expect(result2).toBe('HT:testorg1:M-FRT-999');
      expect(result3).toBe('HT:testorg1:M-BIO-1234');
    });

    it('should be a pure function (no side effects)', () => {
      const orgId = 'testorgid-1234';
      const partNumber = 'M-POT-001';

      const result1 = generateInternalBarcode(orgId, partNumber);
      const result2 = generateInternalBarcode(orgId, partNumber);

      expect(result1).toBe(result2);
    });
  });
});




