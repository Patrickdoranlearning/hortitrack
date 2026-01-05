/**
 * Unit tests for MaterialConsumptionPreview component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Mock SWR
const mockUseSWR = jest.fn();
jest.mock('swr', () => ({
  __esModule: true,
  default: (key: string | null, fetcher: any, options?: any) => mockUseSWR(key, fetcher, options),
}));

// Mock fetchJson
jest.mock('@/lib/http/fetchJson', () => ({
  fetchJson: jest.fn(),
}));

// Import after mocks
import { MaterialConsumptionPreview } from '../MaterialConsumptionPreview';

describe('MaterialConsumptionPreview', () => {
  const mockBatches = [
    { batchId: 'batch-1', sizeId: 'size-1', sizeName: '2L Pot', quantity: 100 },
    { batchId: 'batch-2', sizeId: 'size-1', sizeName: '2L Pot', quantity: 50 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSWR.mockReset();
  });

  describe('rendering states', () => {
    it('should return null when no batches provided', () => {
      mockUseSWR.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      const { container } = render(<MaterialConsumptionPreview batches={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it('should show loading state', () => {
      mockUseSWR.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(<MaterialConsumptionPreview batches={mockBatches} />);

      expect(screen.getByText('Loading materials...')).toBeInTheDocument();
    });

    it('should show error state', () => {
      mockUseSWR.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Failed to fetch'),
      });

      render(<MaterialConsumptionPreview batches={mockBatches} />);

      expect(screen.getByText('Unable to load material preview')).toBeInTheDocument();
    });

    it('should show empty state when no materials linked', () => {
      mockUseSWR.mockReturnValue({
        data: { preview: [] },
        isLoading: false,
        error: null,
      });

      render(<MaterialConsumptionPreview batches={mockBatches} />);

      expect(screen.getByText('No materials linked to these sizes.')).toBeInTheDocument();
      expect(
        screen.getByText('Link materials in the Materials Catalog to enable auto-consumption.')
      ).toBeInTheDocument();
    });
  });

  describe('material display', () => {
    it('should display materials with consumption data', () => {
      mockUseSWR.mockReturnValue({
        data: {
          preview: [
            {
              materialId: 'mat-1',
              materialName: 'Black Pot',
              partNumber: 'M-POT-001',
              baseUom: 'each',
              quantityRequired: 150,
              quantityAvailable: 500,
              isShortage: false,
            },
            {
              materialId: 'mat-2',
              materialName: 'Potting Soil',
              partNumber: 'M-SOI-001',
              baseUom: 'litre',
              quantityRequired: 300,
              quantityAvailable: 1000,
              isShortage: false,
            },
          ],
        },
        isLoading: false,
        error: null,
      });

      render(<MaterialConsumptionPreview batches={mockBatches} />);

      expect(screen.getByText('Material Consumption')).toBeInTheDocument();
      expect(screen.getByText('Black Pot')).toBeInTheDocument();
      expect(screen.getByText('(M-POT-001)')).toBeInTheDocument();
      expect(screen.getByText('150 each')).toBeInTheDocument();
      expect(screen.getByText('Potting Soil')).toBeInTheDocument();
      expect(screen.getByText('(M-SOI-001)')).toBeInTheDocument();
      expect(screen.getByText('300 litre')).toBeInTheDocument();
    });

    it('should show OK badge for materials with sufficient stock', () => {
      mockUseSWR.mockReturnValue({
        data: {
          preview: [
            {
              materialId: 'mat-1',
              materialName: 'Black Pot',
              partNumber: 'M-POT-001',
              baseUom: 'each',
              quantityRequired: 100,
              quantityAvailable: 500,
              isShortage: false,
            },
          ],
        },
        isLoading: false,
        error: null,
      });

      render(<MaterialConsumptionPreview batches={mockBatches} />);

      expect(screen.getByText('OK')).toBeInTheDocument();
    });

    it('should show shortage badge for materials with insufficient stock', () => {
      mockUseSWR.mockReturnValue({
        data: {
          preview: [
            {
              materialId: 'mat-1',
              materialName: 'Black Pot',
              partNumber: 'M-POT-001',
              baseUom: 'each',
              quantityRequired: 100,
              quantityAvailable: 50,
              isShortage: true,
            },
          ],
        },
        isLoading: false,
        error: null,
      });

      render(<MaterialConsumptionPreview batches={mockBatches} />);

      expect(screen.getByText('Shortage')).toBeInTheDocument();
    });
  });

  describe('shortage warnings', () => {
    it('should show warning alert when there are shortages', () => {
      mockUseSWR.mockReturnValue({
        data: {
          preview: [
            {
              materialId: 'mat-1',
              materialName: 'Black Pot',
              partNumber: 'M-POT-001',
              baseUom: 'each',
              quantityRequired: 100,
              quantityAvailable: 20,
              isShortage: true,
            },
          ],
        },
        isLoading: false,
        error: null,
      });

      render(<MaterialConsumptionPreview batches={mockBatches} />);

      expect(
        screen.getByText(/Some materials have insufficient stock/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/stock levels will go negative/)
      ).toBeInTheDocument();
    });

    it('should not show warning alert when no shortages', () => {
      mockUseSWR.mockReturnValue({
        data: {
          preview: [
            {
              materialId: 'mat-1',
              materialName: 'Black Pot',
              partNumber: 'M-POT-001',
              baseUom: 'each',
              quantityRequired: 100,
              quantityAvailable: 500,
              isShortage: false,
            },
          ],
        },
        isLoading: false,
        error: null,
      });

      render(<MaterialConsumptionPreview batches={mockBatches} />);

      expect(
        screen.queryByText(/Some materials have insufficient stock/)
      ).not.toBeInTheDocument();
    });
  });

  describe('batch aggregation', () => {
    it('should aggregate batches by size', () => {
      const batchesWithSameSize = [
        { batchId: 'batch-1', sizeId: 'size-1', sizeName: '2L Pot', quantity: 100 },
        { batchId: 'batch-2', sizeId: 'size-1', sizeName: '2L Pot', quantity: 50 },
        { batchId: 'batch-3', sizeId: 'size-1', sizeName: '2L Pot', quantity: 25 },
      ];

      mockUseSWR.mockReturnValue({
        data: { preview: [] },
        isLoading: false,
        error: null,
      });

      render(<MaterialConsumptionPreview batches={batchesWithSameSize} />);

      // The SWR key should aggregate quantities: 100 + 50 + 25 = 175
      expect(mockUseSWR).toHaveBeenCalledWith(
        expect.stringContaining('quantity=175'),
        expect.any(Function),
        expect.any(Object)
      );
    });
  });

  describe('table structure', () => {
    it('should render table headers correctly', () => {
      mockUseSWR.mockReturnValue({
        data: {
          preview: [
            {
              materialId: 'mat-1',
              materialName: 'Black Pot',
              partNumber: 'M-POT-001',
              baseUom: 'each',
              quantityRequired: 100,
              quantityAvailable: 500,
              isShortage: false,
            },
          ],
        },
        isLoading: false,
        error: null,
      });

      render(<MaterialConsumptionPreview batches={mockBatches} />);

      expect(screen.getByText('Material')).toBeInTheDocument();
      expect(screen.getByText('Required')).toBeInTheDocument();
      expect(screen.getByText('Available')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('should apply className to card', () => {
      mockUseSWR.mockReturnValue({
        data: {
          preview: [
            {
              materialId: 'mat-1',
              materialName: 'Black Pot',
              partNumber: 'M-POT-001',
              baseUom: 'each',
              quantityRequired: 100,
              quantityAvailable: 500,
              isShortage: false,
            },
          ],
        },
        isLoading: false,
        error: null,
      });

      const { container } = render(
        <MaterialConsumptionPreview batches={mockBatches} className="custom-class" />
      );

      // The Card component should have the custom class
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('note footer', () => {
    it('should display informational note', () => {
      mockUseSWR.mockReturnValue({
        data: {
          preview: [
            {
              materialId: 'mat-1',
              materialName: 'Black Pot',
              partNumber: 'M-POT-001',
              baseUom: 'each',
              quantityRequired: 100,
              quantityAvailable: 500,
              isShortage: false,
            },
          ],
        },
        isLoading: false,
        error: null,
      });

      render(<MaterialConsumptionPreview batches={mockBatches} />);

      expect(
        screen.getByText(/Materials will be automatically deducted from stock/)
      ).toBeInTheDocument();
    });
  });
});


