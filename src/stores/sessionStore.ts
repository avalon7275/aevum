import { create } from "zustand";
import type { PollingStatus, PollingTick } from "../types/session";

interface SessionState {
  pollingStatus: PollingStatus;
  recentTicks: PollingTick[];
  setPollingTick: (tick: PollingTick) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  pollingStatus: {
    is_running: false,
    is_tracking: false,
    current_daw: null,
    current_track: null,
    session_duration_secs: 0,
    current_category: "idle",
  },
  recentTicks: [],
  setPollingTick: (tick) =>
    set((state) => ({
      pollingStatus: tick.status,
      recentTicks: [tick, ...state.recentTicks].slice(0, 200),
    })),
}));
