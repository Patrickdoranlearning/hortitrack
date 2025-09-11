import { create } from "zustand";

type TabKey = "summary" | "log" | "photos" | "ancestry" | "ai";

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
      history: prev ? [...s.history, prev] : s.history,
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
