import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { toDateStr } from "../lib/formatters";

interface CategoryTotal {
  category: string;
  total_secs: number;
}

interface TrackTotal {
  name: string;
  daw: string;
  total_secs: number;
}

export interface DayTotal {
  date: string;
  total_secs: number;
  session_count: number;
  tracks: TrackTotal[];
  category_totals: CategoryTotal[];
}

export interface WeekSummary {
  week_start: string;
  week_end: string;
  total_secs: number;
  total_sessions: number;
  unique_tracks: number;
  days: DayTotal[];
}

function getMonday(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return toDateStr(d);
}

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + weeks * 7);
  return toDateStr(d);
}

export interface HeatmapDay {
  date: string;
  total_secs: number;
}

interface CategoryShift {
  category: string;
  this_week_secs: number;
  last_week_secs: number;
  delta_secs: number;
  direction: string;
}

interface TrackShift {
  name: string;
  this_week_secs: number;
  last_week_secs: number;
  delta_secs: number;
  direction: string;
}

export interface WeekComparison {
  this_week_total: number;
  last_week_total: number;
  category_shifts: CategoryShift[];
  track_shifts: TrackShift[];
  insight: string;
}

interface WeeklyState {
  weekStart: string;
  weekSummary: WeekSummary | null;
  weekComparison: WeekComparison | null;
  heatmapDays: HeatmapDay[];
  loading: boolean;
  setWeekStart: (date: string) => void;
  fetchWeekSummary: (weekStart: string) => Promise<void>;
  fetchWeekComparison: (weekStart: string) => Promise<void>;
  fetchHeatmap: () => Promise<void>;
  goToPrevWeek: () => void;
  goToNextWeek: () => void;
  goToThisWeek: () => void;
}

export const useWeeklyStore = create<WeeklyState>((set, get) => ({
  weekStart: getMonday(),
  weekSummary: null,
  weekComparison: null,
  heatmapDays: [],
  loading: false,

  setWeekStart: (date: string) => {
    set({ weekStart: date });
    get().fetchWeekSummary(date);
  },

  fetchWeekSummary: async (weekStart: string) => {
    set({ loading: true });
    try {
      const summary = await invoke<WeekSummary>("get_week_summary", {
        weekStart,
      });
      set({ weekSummary: summary, loading: false });
      get().fetchWeekComparison(weekStart);
    } catch (e) {
      console.error("Failed to fetch week summary:", e);
      set({ loading: false });
    }
  },

  fetchWeekComparison: async (weekStart: string) => {
    try {
      const comparison = await invoke<WeekComparison>("get_week_comparison", {
        weekStart,
      });
      set({ weekComparison: comparison });
    } catch (e) {
      console.error("Failed to fetch week comparison:", e);
    }
  },

  fetchHeatmap: async () => {
    try {
      const days = await invoke<HeatmapDay[]>("get_year_heatmap");
      set({ heatmapDays: days });
    } catch (e) {
      console.error("Failed to fetch heatmap:", e);
    }
  },

  goToPrevWeek: () => {
    const prev = addWeeks(get().weekStart, -1);
    get().setWeekStart(prev);
  },

  goToNextWeek: () => {
    const next = addWeeks(get().weekStart, 1);
    const thisMonday = getMonday();
    if (next <= thisMonday) {
      get().setWeekStart(next);
    }
  },

  goToThisWeek: () => {
    get().setWeekStart(getMonday());
  },
}));

export { getMonday };
