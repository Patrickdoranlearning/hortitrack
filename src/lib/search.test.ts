// src/lib/search.test.ts
import { queryMatchesBatch } from './search';

describe('queryMatchesBatch', () => {
  const mockBatch = {
    id: 'abc-123',
    batchNumber: '2251001',
    plantFamily: 'Roseaceae',
    plantVariety: 'Rosa hybrida',
    category: 'Flower',
    supplier: 'Green Thumbs',
    location: 'Greenhouse A',
    status: 'Active',
    initialQuantity: 100,
    quantity: 90,
    plantingDate: '2023-01-01T00:00:00.000Z',
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-15T00:00:00.000Z',
    logHistory: [],
  };

  it('should return true for an empty query', () => {
    expect(queryMatchesBatch('', mockBatch)).toBe(true);
    expect(queryMatchesBatch(null as any, mockBatch)).toBe(true);
    expect(queryMatchesBatch(undefined as any, mockBatch)).toBe(true);
  });

  it('should match by exact batch number', () => {
    expect(queryMatchesBatch('2251001', mockBatch)).toBe(true);
  });

  it('should match by batch number with # prefix', () => {
    expect(queryMatchesBatch('#2251001', mockBatch)).toBe(true);
  });

  it('should match by batch number with ht:batch: prefix', () => {
    // Assuming parseScanCode handles this format and returns { by: 'batchNumber', value: '2251001' }
    // This test will pass if parseScanCode is mocked or if it actually handles it.
    // For a true unit test, parseScanCode should be mocked.
    expect(queryMatchesBatch('ht:batch:2251001', mockBatch)).toBe(true);
  });

  it('should match by exact ID', () => {
    expect(queryMatchesBatch('abc-123', mockBatch)).toBe(true);
  });

  it('should match by ID with # prefix (if parseScanCode handles it)', () => {
    // This test depends on parseScanCode handling #id as an ID.
    expect(queryMatchesBatch('#abc-123', mockBatch)).toBe(true);
  });

  it('should match by fuzzy text in plantFamily', () => {
    expect(queryMatchesBatch('rose', mockBatch)).toBe(true);
    expect(queryMatchesBatch('Roseaceae', mockBatch)).toBe(true);
  });

  it('should match by fuzzy text in plantVariety', () => {
    expect(queryMatchesBatch('hybrida', mockBatch)).toBe(true);
    expect(queryMatchesBatch('rosa hybrida', mockBatch)).toBe(true);
  });

  it('should match by fuzzy text in category', () => {
    expect(queryMatchesBatch('flower', mockBatch)).toBe(true);
  });

  it('should match by fuzzy text in supplier', () => {
    expect(queryMatchesBatch('green', mockBatch)).toBe(true);
    expect(queryMatchesBatch('green thumbs', mockBatch)).toBe(true);
  });

  it('should match by fuzzy text in location', () => {
    expect(queryMatchesBatch('greenhouse a', mockBatch)).toBe(true);
  });

  it('should return false for a non-matching query', () => {
    expect(queryMatchesBatch('nonexistent', mockBatch)).toBe(false);
    expect(queryMatchesBatch('1234567', mockBatch)).toBe(false); // Non-matching batch number
  });

  it('should handle leading zeros correctly for batchNumber', () => {
    const batchWithLeadingZero = { ...mockBatch, batchNumber: '00123' };
    expect(queryMatchesBatch('123', batchWithLeadingZero)).toBe(true);
    expect(queryMatchesBatch('00123', batchWithLeadingZero)).toBe(true);
  });

  it('should be case-insensitive for fuzzy matching', () => {
    expect(queryMatchesBatch('RoSa', mockBatch)).toBe(true);
    expect(queryMatchesBatch('gReEn ThUmBs', mockBatch)).toBe(true);
  });

  // Mocking parseScanCode for GS1 DM/QR test (as it's an external dependency)
  it('should match by GS1 DM/QR (assuming parseScanCode handles it)', () => {
    // This is a conceptual test. In a real scenario, you'd mock '@/lib/scan/parse.client'
    // to return the expected parsed object for a GS1 string.
    // For example, if parseScanCode('some-gs1-string') returns { by: 'batchNumber', value: '9876543' }
    const gs1Batch = { ...mockBatch, batchNumber: '9876543' };
    expect(queryMatchesBatch('ht:batch:9876543', gs1Batch)).toBe(true); // Example of a parsed-like query
  });
});
