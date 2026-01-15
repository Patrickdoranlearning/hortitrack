import { create } from "zustand";

type TabKey = "summary" | "log" | "photos" | "ancestry" | "ai";

// Maximum history size to prevent memory leaks
const MAX_HISTORY = 20;

type State = {
  isOpen: boolean;
  batchId?: string;
  initialTab?: TabKey;
  history: string[];
  open: (batchId: string, initialTab?: TabKey) => void;
  close: () => void;
  back: () => void;
};

export const useBatchDetailDialog = create<State>((set, get) => ({
  isOpen: false,
  batchId: undefined,
  initialTab: "summary",
  history: [],
  open: (batchId, initialTab = "summary") => {
    if (!batchId) {
      console.warn("useBatchDetailDialog.open called without batchId");
      return;
    }
    const prev = get().batchId;
    set((s) => ({
      isOpen: true,
      batchId,
      initialTab,
      // Bound history to prevent memory leak from unbounded growth
      history: prev
        ? [...s.history.slice(-(MAX_HISTORY - 1)), prev]
        : s.history,
    }));
  },
  close: () => set({ isOpen: false, batchId: undefined, history: [] }),
  back: () => {
    const h = get().history;
    if (!h.length) return;
    const prev = h[h.length - 1];
    set({ batchId: prev, history: h.slice(0, -1), isOpen: true });
  },
}));
