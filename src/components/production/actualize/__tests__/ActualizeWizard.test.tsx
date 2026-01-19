/**
 * Unit tests for ActualizeWizard component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActualizeWizard } from '../ActualizeWizard';
import { ReferenceDataContext } from '@/contexts/ReferenceDataContext';

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the sub-components
jest.mock('../SelectPlannedBatchesStep', () => ({
  SelectPlannedBatchesStep: ({ onComplete }: any) => (
    <div data-testid="select-step">
      <button
        data-testid="complete-selection"
        onClick={() =>
          onComplete({
            selectedBatches: [{ id: 'b1', batchNumber: '2401001', varietyName: 'Petunia', quantity: 100 }],
          })
        }
      >
        Complete Selection
      </button>
    </div>
  ),
}));

jest.mock('../ActualizeByLocationStep', () => ({
  ActualizeByLocationStep: ({ onComplete, onBack }: any) => (
    <div data-testid="actualize-step">
      <button data-testid="back-btn" onClick={onBack}>Back</button>
      <button
        data-testid="complete-actualization"
        onClick={() =>
          onComplete({
            entries: [
              {
                batchId: 'b1',
                actualQuantity: 95,
                actualLocationId: 'l1',
                actualDate: '2024-01-20',
              },
            ],
          })
        }
      >
        Complete Actualization
      </button>
    </div>
  ),
}));

jest.mock('../ActualizeReviewStep', () => ({
  ActualizeReviewStep: ({ onComplete, onBack }: any) => (
    <div data-testid="review-step">
      <button data-testid="back-btn" onClick={onBack}>Back</button>
      <button
        data-testid="complete-review"
        onClick={() =>
          onComplete({
            globalNotes: 'Actualized with small loss',
          })
        }
      >
        Complete Review
      </button>
    </div>
  ),
}));

// Mock global fetch
global.fetch = jest.fn() as jest.Mock;

const mockRefData = {
  data: {
    locations: [{ id: 'l1', name: 'Location 1' }],
  },
  loading: false,
  error: null,
  reload: jest.fn(),
};

describe('ActualizeWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWizard = (props = {}) => {
    return render(
      <ReferenceDataContext.Provider value={mockRefData as any}>
        <ActualizeWizard {...props} />
      </ReferenceDataContext.Provider>
    );
  };

  it('should render select step initially when no initial batches', () => {
    renderWizard();
    expect(screen.getByTestId('select-step')).toBeInTheDocument();
  });

  it('should render actualize step initially when initial batches provided', () => {
    renderWizard({ initialBatches: [{ id: 'b1', batchNumber: '2401001', varietyName: 'Petunia', quantity: 100 }] });
    expect(screen.getByTestId('actualize-step')).toBeInTheDocument();
  });

  it('should navigate through all steps and submit', async () => {
    renderWizard();

    // 1. Selection Step
    fireEvent.click(screen.getByTestId('complete-selection'));
    await waitFor(() => expect(screen.getByTestId('actualize-step')).toBeInTheDocument());

    // 2. Actualization Step
    fireEvent.click(screen.getByTestId('complete-actualization'));
    await waitFor(() => expect(screen.getByTestId('review-step')).toBeInTheDocument());

    // 3. Review Step (leads to submission)
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ actualized: 1 }),
    });

    fireEvent.click(screen.getByTestId('complete-review'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/production/batches/actualize',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"batch_id":"b1"'),
        })
      );
    });
  });

  it('should handle API submission failure', async () => {
    renderWizard();

    // Navigate to final step
    fireEvent.click(screen.getByTestId('complete-selection'));
    fireEvent.click(screen.getByTestId('complete-actualization'));
    await waitFor(() => expect(screen.getByTestId('review-step')).toBeInTheDocument());

    // Mock failure
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Database error' }),
    });

    fireEvent.click(screen.getByTestId('complete-review'));

    const { toast } = require('sonner');
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Actualization failed', expect.any(Object));
    });
  });
});
