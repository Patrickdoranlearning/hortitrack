// src/stores/use-picking-wizard-store.ts
import { create } from 'zustand';
import type { PickList, PickItem, PickItemStatus } from '@/server/sales/picking';

export type PickingStep = 'start' | 'labels' | 'pick' | 'qc' | 'trolley' | 'complete';

export interface QCChecklistState {
  quantitiesCorrect: boolean;
  varietiesCorrect: boolean;
  qualityAcceptable: boolean;
  labelsAttached: boolean;
}

export interface TrolleyInfo {
  trolleyType: 'tag6' | 'dc' | 'danish' | 'dutch' | 'pallet';
  count: number;
  shelves?: number;
  trolleyNumbers?: string[];
}

export interface PickedItemUpdate {
  pickItemId: string;
  pickedQty: number;
  pickedBatchId?: string;
  status: PickItemStatus;
  substitutionReason?: string;
}

interface PickingWizardState {
  // Current step
  currentStep: PickingStep;
  
  // Pick list data
  pickList: PickList | null;
  items: PickItem[];
  
  // Labels state
  labelsPrinted: boolean;
  
  // QC state
  qcChecklist: QCChecklistState;
  qcNotes: string;
  flaggedItems: string[]; // Item IDs with issues
  
  // Trolley state
  trolleyInfo: TrolleyInfo;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setPickList: (pickList: PickList) => void;
  setItems: (items: PickItem[]) => void;
  updateItem: (itemId: string, updates: Partial<PickItem>) => void;
  
  goToStep: (step: PickingStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  
  setLabelsPrinted: (printed: boolean) => void;
  
  setQCChecklist: (checklist: Partial<QCChecklistState>) => void;
  setQCNotes: (notes: string) => void;
  toggleFlaggedItem: (itemId: string) => void;
  
  setTrolleyInfo: (info: Partial<TrolleyInfo>) => void;
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  reset: () => void;
  
  // Computed
  canProceed: () => boolean;
  getProgress: () => { picked: number; total: number; percentage: number };
}

const STEP_ORDER: PickingStep[] = ['start', 'labels', 'pick', 'qc', 'trolley', 'complete'];

const initialQCChecklist: QCChecklistState = {
  quantitiesCorrect: false,
  varietiesCorrect: false,
  qualityAcceptable: false,
  labelsAttached: false,
};

const initialTrolleyInfo: TrolleyInfo = {
  trolleyType: 'tag6',
  count: 0,
  shelves: undefined,
  trolleyNumbers: [],
};

export const usePickingWizardStore = create<PickingWizardState>((set, get) => ({
  // Initial state
  currentStep: 'start',
  pickList: null,
  items: [],
  labelsPrinted: false,
  qcChecklist: { ...initialQCChecklist },
  qcNotes: '',
  flaggedItems: [],
  trolleyInfo: { ...initialTrolleyInfo },
  isLoading: false,
  error: null,
  
  // Actions
  setPickList: (pickList) => set({ pickList }),
  
  setItems: (items) => set({ items }),
  
  updateItem: (itemId, updates) => set((state) => ({
    items: state.items.map((item) =>
      item.id === itemId ? { ...item, ...updates } : item
    ),
  })),
  
  goToStep: (step) => set({ currentStep: step }),
  
  nextStep: () => set((state) => {
    const currentIndex = STEP_ORDER.indexOf(state.currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      return { currentStep: STEP_ORDER[currentIndex + 1] };
    }
    return state;
  }),
  
  prevStep: () => set((state) => {
    const currentIndex = STEP_ORDER.indexOf(state.currentStep);
    if (currentIndex > 0) {
      return { currentStep: STEP_ORDER[currentIndex - 1] };
    }
    return state;
  }),
  
  setLabelsPrinted: (printed) => set({ labelsPrinted: printed }),
  
  setQCChecklist: (checklist) => set((state) => ({
    qcChecklist: { ...state.qcChecklist, ...checklist },
  })),
  
  setQCNotes: (notes) => set({ qcNotes: notes }),
  
  toggleFlaggedItem: (itemId) => set((state) => ({
    flaggedItems: state.flaggedItems.includes(itemId)
      ? state.flaggedItems.filter((id) => id !== itemId)
      : [...state.flaggedItems, itemId],
  })),
  
  setTrolleyInfo: (info) => set((state) => ({
    trolleyInfo: { ...state.trolleyInfo, ...info },
  })),
  
  setLoading: (loading) => set({ isLoading: loading }),
  
  setError: (error) => set({ error }),
  
  reset: () => set({
    currentStep: 'start',
    pickList: null,
    items: [],
    labelsPrinted: false,
    qcChecklist: { ...initialQCChecklist },
    qcNotes: '',
    flaggedItems: [],
    trolleyInfo: { ...initialTrolleyInfo },
    isLoading: false,
    error: null,
  }),
  
  // Computed
  canProceed: () => {
    const state = get();
    const { currentStep, items, labelsPrinted, qcChecklist, flaggedItems, trolleyInfo } = state;
    
    switch (currentStep) {
      case 'start':
        return true;
      case 'labels':
        return true; // Can skip or proceed after printing
      case 'pick':
        // All items must be picked (not pending)
        return items.every((item) => item.status !== 'pending');
      case 'qc':
        // All checklist items must be checked and no flagged items
        return Object.values(qcChecklist).every(Boolean) && flaggedItems.length === 0;
      case 'trolley':
        return trolleyInfo.count > 0;
      case 'complete':
        return true;
      default:
        return false;
    }
  },
  
  getProgress: () => {
    const { items } = get();
    const total = items.length;
    const picked = items.filter((item) => item.status !== 'pending').length;
    const percentage = total > 0 ? Math.round((picked / total) * 100) : 0;
    return { picked, total, percentage };
  },
}));





