import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface CategoryTotal {
  category: string;
  total_secs: number;
}

interface SessionSummary {
  id: number;
  started_at: number;
  ended_at: number | null;
  duration_secs: number;
}

export interface ProjectDetail {
  id: number;
  name: string;
  daw: string;
  first_seen: number;
  last_seen: number;
  total_seconds: number;
  session_count: number;
  category_totals: CategoryTotal[];
  recent_sessions: SessionSummary[];
}

interface ProjectDetailState {
  selectedProjectId: number | null;
  projectDetail: ProjectDetail | null;
  loading: boolean;
  openProject: (id: number) => void;
  closeProject: () => void;
}

export const useProjectDetailStore = create<ProjectDetailState>((set) => ({
  selectedProjectId: null,
  projectDetail: null,
  loading: false,

  openProject: async (id: number) => {
    set({ selectedProjectId: id, loading: true });
    try {
      const detail = await invoke<ProjectDetail>("get_project_detail", {
        projectId: id,
      });
      set({ projectDetail: detail, loading: false });
    } catch (e) {
      console.error("Failed to fetch project detail:", e);
      set({ loading: false });
    }
  },

  closeProject: () => {
    set({ selectedProjectId: null, projectDetail: null });
  },
}));
