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

export interface TrackDetail {
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

interface TrackDetailState {
  selectedTrackId: number | null;
  trackDetail: TrackDetail | null;
  loading: boolean;
  openTrack: (id: number) => void;
  closeTrack: () => void;
}

export const useTrackDetailStore = create<TrackDetailState>((set) => ({
  selectedTrackId: null,
  trackDetail: null,
  loading: false,

  openTrack: async (id: number) => {
    set({ selectedTrackId: id, loading: true });
    try {
      const detail = await invoke<TrackDetail>("get_track_detail", {
        trackId: id,
      });
      set({ trackDetail: detail, loading: false });
    } catch (e) {
      console.error("Failed to fetch track detail:", e);
      set({ loading: false });
    }
  },

  closeTrack: () => {
    set({ selectedTrackId: null, trackDetail: null });
  },
}));
