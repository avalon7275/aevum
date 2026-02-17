import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface Project {
  id: number;
  name: string;
  daw: string;
  first_seen: number;
  last_seen: number;
  total_seconds: number;
  notes: string;
  archived: boolean;
}

interface ProjectsState {
  projects: Project[];
  loading: boolean;
  searchQuery: string;
  fetchProjects: () => Promise<void>;
  setSearchQuery: (q: string) => void;
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: [],
  loading: false,
  searchQuery: "",

  fetchProjects: async () => {
    set({ loading: true });
    try {
      const projects = await invoke<Project[]>("get_all_projects");
      set({ projects, loading: false });
    } catch (e) {
      console.error("Failed to fetch projects:", e);
      set({ loading: false });
    }
  },

  setSearchQuery: (q: string) => {
    set({ searchQuery: q });
  },
}));
