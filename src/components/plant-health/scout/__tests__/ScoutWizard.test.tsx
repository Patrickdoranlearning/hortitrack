/**
 * Unit tests for ScoutWizard component
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the server actions
jest.mock('@/app/actions/plant-health', () => ({
  createScoutLog: jest.fn(),
  scheduleTreatment: jest.fn(),
}));

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the sub-components to simplify testing
jest.mock('../ScanStep', () => ({
  ScanStep: ({ onTargetSelected }: { onTargetSelected: (target: any) => void }) => (
    <div data-testid="scan-step">
      <button
        data-testid="select-location"
        onClick={() =>
          onTargetSelected({
            type: 'location',
            location: {
              id: 'loc-1',
              name: 'Greenhouse A',
              batches: [{ id: 'b1', batchNumber: '2401001', variety: 'Petunia' }],
            },
          })
        }
      >
        Select Location
      </button>
      <button
        data-testid="select-batch"
        onClick={() =>
          onTargetSelected({
            type: 'batch',
            batch: { id: 'b2', batchNumber: '2401002', variety: 'Marigold' },
          })
        }
      >
        Select Batch
      </button>
    </div>
  ),
}));

jest.mock('../ScoutLogStep', () => ({
  ScoutLogStep: ({
    onComplete,
    onBack,
  }: {
    locationId: string;
    locationName: string;
    batches: any[];
    onComplete: (data: any) => void;
    onBack: () => void;
  }) => (
    <div data-testid="log-step">
      <button data-testid="back-btn" onClick={onBack}>
        Back
      </button>
      <button
        data-testid="complete-issue"
        onClick={() =>
          onComplete({
            locationId: 'loc-1',
            logType: 'issue',
            issue: { reason: 'aphids', severity: 'medium', notes: 'Heavy infestation' },
            selectedBatchIds: ['b1'],
          })
        }
      >
        Complete Issue
      </button>
      <button
        data-testid="complete-reading"
        onClick={() =>
          onComplete({
            locationId: 'loc-1',
            logType: 'reading',
            reading: { ec: 2.5, ph: 6.2, notes: 'Normal' },
          })
        }
      >
        Complete Reading
      </button>
      <button
        data-testid="complete-low-ec"
        onClick={() =>
          onComplete({
            locationId: 'loc-1',
            logType: 'reading',
            reading: { ec: 0.3, ph: 6.0 },
          })
        }
      >
        Complete Low EC
      </button>
    </div>
  ),
}));

jest.mock('../TreatmentStep', () => ({
  TreatmentStep: ({
    onComplete,
    onSkip,
    onBack,
  }: {
    locationId: string;
    locationName: string;
    batches: any[];
    logData: any;
    suggestedType: string | null;
    onComplete: (data: any) => void;
    onSkip: () => void;
    onBack: () => void;
  }) => (
    <div data-testid="treatment-step">
      <button data-testid="treatment-back" onClick={onBack}>
        Back
      </button>
      <button data-testid="skip-treatment" onClick={onSkip}>
        Skip
      </button>
      <button
        data-testid="complete-treatment"
        onClick={() =>
          onComplete({
            type: 'chemical',
            productId: 'p1',
            productName: 'Neem Oil',
            rate: 5,
            rateUnit: 'ml/L',
            scheduledDate: '2024-01-20',
          })
        }
      >
        Complete Treatment
      </button>
    </div>
  ),
}));

import { ScoutWizard } from '../ScoutWizard';
import { createScoutLog, scheduleTreatment } from '@/app/actions/plant-health';
import { toast } from '@/lib/toast';

const mockCreateScoutLog = createScoutLog as jest.Mock;
const mockScheduleTreatment = scheduleTreatment as jest.Mock;

describe('ScoutWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateScoutLog.mockResolvedValue({ success: true, data: { logId: 'log-1' } });
    mockScheduleTreatment.mockResolvedValue({ success: true, data: { treatmentId: 'treat-1' } });
  });

  describe('Initial Render', () => {
    it('should render scan step initially', () => {
      render(<ScoutWizard />);

      expect(screen.getByTestId('scan-step')).toBeInTheDocument();
      expect(screen.queryByTestId('log-step')).not.toBeInTheDocument();
      expect(screen.queryByTestId('treatment-step')).not.toBeInTheDocument();
    });

    it('should show step indicators', () => {
      render(<ScoutWizard />);

      expect(screen.getByText('Scan')).toBeInTheDocument();
      expect(screen.getByText('Log')).toBeInTheDocument();
    });
  });

  describe('Step Navigation', () => {
    it('should navigate to log step after selecting a location', async () => {
      render(<ScoutWizard />);

      fireEvent.click(screen.getByTestId('select-location'));

      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('scan-step')).not.toBeInTheDocument();
    });

    it('should navigate to log step after selecting a batch', async () => {
      render(<ScoutWizard />);

      fireEvent.click(screen.getByTestId('select-batch'));

      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });
    });

    it('should show target summary after selection', async () => {
      render(<ScoutWizard />);

      fireEvent.click(screen.getByTestId('select-location'));

      await waitFor(() => {
        expect(screen.getByText('Greenhouse A')).toBeInTheDocument();
        expect(screen.getByText('1 batches')).toBeInTheDocument();
      });
    });

    it('should navigate back to scan step from log step', async () => {
      render(<ScoutWizard />);

      fireEvent.click(screen.getByTestId('select-location'));
      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('back-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('scan-step')).toBeInTheDocument();
      });
    });
  });

  describe('Scout Log Submission', () => {
    it('should call createScoutLog when completing an issue log', async () => {
      render(<ScoutWizard />);

      fireEvent.click(screen.getByTestId('select-location'));
      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('complete-issue'));

      await waitFor(() => {
        expect(mockCreateScoutLog).toHaveBeenCalledWith(
          expect.objectContaining({
            locationId: 'loc-1',
            logType: 'issue',
            issueReason: 'aphids',
            severity: 'medium',
          })
        );
      });
    });

    it('should call createScoutLog when completing a reading log', async () => {
      render(<ScoutWizard />);

      fireEvent.click(screen.getByTestId('select-location'));
      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('complete-reading'));

      await waitFor(() => {
        expect(mockCreateScoutLog).toHaveBeenCalledWith(
          expect.objectContaining({
            locationId: 'loc-1',
            logType: 'reading',
            ec: 2.5,
            ph: 6.2,
          })
        );
      });
    });

    it('should navigate to treatment step for medium/critical issues', async () => {
      render(<ScoutWizard />);

      fireEvent.click(screen.getByTestId('select-location'));
      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('complete-issue'));

      await waitFor(() => {
        expect(screen.getByTestId('treatment-step')).toBeInTheDocument();
      });
    });

    it('should navigate to treatment step for low EC readings', async () => {
      render(<ScoutWizard />);

      fireEvent.click(screen.getByTestId('select-location'));
      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('complete-low-ec'));

      await waitFor(() => {
        expect(screen.getByTestId('treatment-step')).toBeInTheDocument();
      });
    });

    it('should complete wizard without treatment for normal readings', async () => {
      const onComplete = jest.fn();
      render(<ScoutWizard onComplete={onComplete} />);

      fireEvent.click(screen.getByTestId('select-location'));
      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('complete-reading'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Scout log saved', expect.any(Object));
        expect(onComplete).toHaveBeenCalled();
      });
    });

    it('should show error toast when createScoutLog fails', async () => {
      mockCreateScoutLog.mockResolvedValue({ success: false, error: 'Database error' });

      render(<ScoutWizard />);

      fireEvent.click(screen.getByTestId('select-location'));
      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('complete-reading'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to save', expect.any(Object));
      });
    });
  });

  describe('Treatment Scheduling', () => {
    it('should schedule treatment when completing treatment step', async () => {
      render(<ScoutWizard />);

      // Navigate to treatment step
      fireEvent.click(screen.getByTestId('select-location'));
      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('complete-issue'));
      await waitFor(() => {
        expect(screen.getByTestId('treatment-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('complete-treatment'));

      await waitFor(() => {
        expect(mockScheduleTreatment).toHaveBeenCalledWith(
          expect.objectContaining({
            locationId: 'loc-1',
            treatmentType: 'chemical',
            productId: 'p1',
            productName: 'Neem Oil',
          })
        );
      });
    });

    it('should allow skipping treatment', async () => {
      const onComplete = jest.fn();
      render(<ScoutWizard onComplete={onComplete} />);

      fireEvent.click(screen.getByTestId('select-location'));
      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('complete-issue'));
      await waitFor(() => {
        expect(screen.getByTestId('treatment-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('skip-treatment'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Scout complete', expect.any(Object));
        expect(onComplete).toHaveBeenCalled();
      });
    });

    it('should navigate back from treatment to log step', async () => {
      render(<ScoutWizard />);

      fireEvent.click(screen.getByTestId('select-location'));
      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('complete-issue'));
      await waitFor(() => {
        expect(screen.getByTestId('treatment-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('treatment-back'));

      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });
    });

    it('should show error toast when scheduleTreatment fails', async () => {
      mockScheduleTreatment.mockResolvedValue({ success: false, error: 'Scheduling failed' });

      render(<ScoutWizard />);

      fireEvent.click(screen.getByTestId('select-location'));
      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('complete-issue'));
      await waitFor(() => {
        expect(screen.getByTestId('treatment-step')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('complete-treatment'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to schedule treatment', expect.any(Object));
      });
    });
  });

  describe('Wizard Reset', () => {
    it('should reset wizard when clicking close button on target summary', async () => {
      render(<ScoutWizard />);

      fireEvent.click(screen.getByTestId('select-location'));
      await waitFor(() => {
        expect(screen.getByTestId('log-step')).toBeInTheDocument();
      });

      // Find and click the X button to reset
      const closeButton = screen.getByRole('button', { name: '' }); // X icon button
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.getByTestId('scan-step')).toBeInTheDocument();
      });
    });
  });
});




