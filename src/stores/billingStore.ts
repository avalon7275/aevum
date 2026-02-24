import { create } from "zustand";
import {
  getAllBillingProjects,
  createBillingProject as createBillingProjectCmd,
  updateBillingProject as updateBillingProjectCmd,
  deleteBillingProject as deleteBillingProjectCmd,
} from "../lib/tauri";
import type { BillingProject } from "../types/billing";

interface BillingStore {
  projects: BillingProject[];
  loading: boolean;
  searchQuery: string;
  fetchProjects: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  createProject: (name: string, hourlyRate: number) => Promise<void>;
  updateProject: (id: number, name: string, hourlyRate: number) => Promise<void>;
  deleteProject: (id: number) => Promise<void>;
}

export const useBillingStore = create<BillingStore>((set, get) => ({
  projects: [],
  loading: false,
  searchQuery: "",

  fetchProjects: async () => {
    set({ loading: true });
    try {
      const projects = await getAllBillingProjects();
      set({ projects, loading: false });
    } catch (error) {
      console.error("Failed to fetch billing projects:", error);
      set({ loading: false });
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  createProject: async (name, hourlyRate) => {
    await createBillingProjectCmd(name, hourlyRate);
    await get().fetchProjects();
  },

  updateProject: async (id, name, hourlyRate) => {
    await updateBillingProjectCmd(id, name, hourlyRate);
    await get().fetchProjects();
  },

  deleteProject: async (id) => {
    await deleteBillingProjectCmd(id);
    await get().fetchProjects();
  },
}));
