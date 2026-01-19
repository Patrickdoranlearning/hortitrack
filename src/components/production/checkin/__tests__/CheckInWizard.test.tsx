/**
 * Unit tests for CheckInWizard component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CheckInWizard } from '../CheckInWizard';
import { ReferenceDataContext } from '@/contexts/ReferenceDataContext';

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the sub-components
jest.mock('../SupplierDeliveryStep', () => ({
  SupplierDeliveryStep: ({ onComplete }: any) => (
    <div data-testid="supplier-step">
      <button
        data-testid="complete-supplier"
        onClick={() =>
          onComplete({
            supplierId: 's1',
            supplierName: 'Test Supplier',
            deliveryDate: '2024-01-20',
            supplierReference: 'REF123',
          })
        }
      >
        Complete Supplier
      </button>
    </div>
  ),
}));

jest.mock('../BatchesStep', () => ({
  BatchesStep: ({ onComplete, onBack }: any) => (
    <div data-testid="batches-step">
      <button data-testid="back-btn" onClick={onBack}>Back</button>
      <button
        data-testid="complete-batches"
        onClick={() =>
          onComplete({
            batches: [
              {
                id: 'b1',
                incomingBatchId: 'ib1',
                varietyId: 'v1',
                sizeId: 'sz1',
                locationId: 'l1',
                quantity: 100,
              },
            ],
          })
        }
      >
        Complete Batches
      </button>
    </div>
  ),
}));

jest.mock('../QualityStep', () => ({
  QualityStep: ({ onComplete, onBack }: any) => (
    <div data-testid="quality-step">
      <button data-testid="back-btn" onClick={onBack}>Back</button>
      <button
        data-testid="complete-quality"
        onClick={() =>
          onComplete({
            overallQuality: 5,
            globalNotes: 'All good',
            batchQualities: [],
          })
        }
      >
        Complete Quality
      </button>
    </div>
  ),
}));

jest.mock('../PhotosStep', () => ({
  PhotosStep: ({ onComplete, onBack }: any) => (
    <div data-testid="photos-step">
      <button data-testid="back-btn" onClick={onBack}>Back</button>
      <button
        data-testid="complete-photos"
        onClick={() =>
          onComplete({
            photos: [],
          })
        }
      >
        Complete Photos
      </button>
    </div>
  ),
}));

// Mock global fetch
global.fetch = jest.fn() as jest.Mock;

const mockRefData = {
  data: {
    suppliers: [{ id: 's1', name: 'Test Supplier' }],
    varieties: [{ id: 'v1', name: 'Variety 1' }],
    sizes: [{ id: 'sz1', name: 'Size 1' }],
    locations: [{ id: 'l1', name: 'Location 1' }],
  },
  loading: false,
  error: null,
  reload: jest.fn(),
};

describe('CheckInWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ batches: [] }),
    });
  });

  const renderWizard = (props = {}) => {
    return render(
      <ReferenceDataContext.Provider value={mockRefData as any}>
        <CheckInWizard {...props} />
      </ReferenceDataContext.Provider>
    );
  };

  it('should render supplier step initially', () => {
    renderWizard();
    expect(screen.getByTestId('supplier-step')).toBeInTheDocument();
  });

  it('should navigate through all steps and submit', async () => {
    renderWizard();

    // 1. Supplier Step
    fireEvent.click(screen.getByTestId('complete-supplier'));
    await waitFor(() => expect(screen.getByTestId('batches-step')).toBeInTheDocument());

    // 2. Batches Step
    fireEvent.click(screen.getByTestId('complete-batches'));
    await waitFor(() => expect(screen.getByTestId('quality-step')).toBeInTheDocument());

    // 3. Quality Step
    fireEvent.click(screen.getByTestId('complete-quality'));
    await waitFor(() => expect(screen.getByTestId('photos-step')).toBeInTheDocument());

    // 4. Photos Step (leads to submission)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    fireEvent.click(screen.getByTestId('complete-photos'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/production/batches/check-in-multi',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"supplier_id":"s1"'),
        })
      );
    });
  });

  it('should allow navigating back between steps', async () => {
    renderWizard();

    // Go to second step
    fireEvent.click(screen.getByTestId('complete-supplier'));
    await waitFor(() => expect(screen.getByTestId('batches-step')).toBeInTheDocument());

    // Go back to first step
    fireEvent.click(screen.getByTestId('back-btn'));
    await waitFor(() => expect(screen.getByTestId('supplier-step')).toBeInTheDocument());
  });

  it('should handle API submission failure', async () => {
    renderWizard();

    // Navigate to final step
    fireEvent.click(screen.getByTestId('complete-supplier'));
    fireEvent.click(screen.getByTestId('complete-batches'));
    fireEvent.click(screen.getByTestId('complete-quality'));
    await waitFor(() => expect(screen.getByTestId('photos-step')).toBeInTheDocument());

    // Mock failure
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Server error' }),
    });

    fireEvent.click(screen.getByTestId('complete-photos'));

    const { toast } = require('sonner');
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Check-in failed', expect.any(Object));
    });
  });
});
