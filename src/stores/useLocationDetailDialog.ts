import { create } from "zustand";

type TabKey = "summary" | "batches" | "history";

type State = {
  isOpen: boolean;
  locationId?: string;
  initialTab?: TabKey;
  open: (locationId: string, initialTab?: TabKey) => void;
  close: () => void;
};

export const useLocationDetailDialog = create<State>((set) => ({
  isOpen: false,
  locationId: undefined,
  initialTab: "summary",
  open: (locationId, initialTab = "summary") => {
    if (!locationId) {
      console.warn("useLocationDetailDialog.open called without locationId");
      return;
    }
    set({
      isOpen: true,
      locationId,
      initialTab,
    });
  },
  close: () => set({ isOpen: false, locationId: undefined }),
}));





