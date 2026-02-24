import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { Track } from "../types/session";

export type { Track };

interface TracksState {
  tracks: Track[];
  loading: boolean;
  searchQuery: string;
  fetchTracks: () => Promise<void>;
  setSearchQuery: (q: string) => void;
}

export const useTracksStore = create<TracksState>((set) => ({
  tracks: [],
  loading: false,
  searchQuery: "",

  fetchTracks: async () => {
    set({ loading: true });
    try {
      const tracks = await invoke<Track[]>("get_all_tracks");
      set({ tracks, loading: false });
    } catch (e) {
      console.error("Failed to fetch tracks:", e);
      set({ loading: false });
    }
  },

  setSearchQuery: (q: string) => {
    set({ searchQuery: q });
  },
}));
