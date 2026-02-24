import { create } from "zustand";
import { getBillingProjectDetail } from "../lib/tauri";
import type { BillingProjectDetail } from "../types/billing";

interface BillingDetailStore {
  detail: BillingProjectDetail | null;
  loading: boolean;
  isOpen: boolean;
  openProject: (projectId: number) => Promise<void>;
  closeProject: () => void;
  refresh: () => Promise<void>;
}

export const useBillingDetailStore = create<BillingDetailStore>((set, get) => ({
  detail: null,
  loading: false,
  isOpen: false,

  openProject: async (projectId) => {
    set({ loading: true, isOpen: true });
    try {
      const detail = await getBillingProjectDetail(projectId);
      set({ detail, loading: false });
    } catch (error) {
      console.error("Failed to fetch billing project detail:", error);
      set({ loading: false });
    }
  },

  closeProject: () => {
    set({ isOpen: false, detail: null });
  },

  refresh: async () => {
    const currentId = get().detail?.project.id;
    if (currentId) {
      set({ loading: true });
      try {
        const detail = await getBillingProjectDetail(currentId);
        set({ detail, loading: false });
      } catch (error) {
        console.error("Failed to refresh billing project detail:", error);
        set({ loading: false });
      }
    }
  },
}));
