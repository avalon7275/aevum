import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface TimelineBlock {
  category: string;
  start_ts: number;
  end_ts: number;
  duration_secs: number;
}

interface CategoryTotal {
  category: string;
  total_secs: number;
}

interface ProjectTotal {
  id: number;
  name: string;
  daw: string;
  total_secs: number;
}

interface FocusPeriod {
  start_ts: number;
  end_ts: number;
  duration_secs: number;
  focused: boolean;
}

interface FocusReport {
  daw_secs: number;
  away_secs: number;
  total_secs: number;
  periods: FocusPeriod[];
  insights: string[];
}

interface PluginUsage {
  name: string;
  category: string;
  total_secs: number;
}

interface PluginCategoryUsage {
  category: string;
  label: string;
  total_secs: number;
  plugin_count: number;
}

interface PluginReport {
  top_plugins: PluginUsage[];
  categories: PluginCategoryUsage[];
  insights: string[];
}

export interface DaySummary {
  total_secs: number;
  session_count: number;
  category_totals: CategoryTotal[];
  projects: ProjectTotal[];
  timeline: TimelineBlock[];
  focus: FocusReport;
  plugins: PluginReport;
}

interface DayGoalStatus {
  date: string;
  total_secs: number;
  goal_met: boolean;
}

export interface GoalStreak {
  today_secs: number;
  goal_secs: number;
  streak_days: number;
  last_14_days: DayGoalStatus[];
}

interface DashboardState {
  selectedDate: string;
  daySummary: DaySummary | null;
  goalStreak: GoalStreak | null;
  dailyGoalMinutes: number;
  loading: boolean;
  setSelectedDate: (date: string) => void;
  fetchDaySummary: (date: string) => Promise<void>;
  fetchGoalStreak: () => Promise<void>;
  saveDailyGoal: (minutes: number) => Promise<void>;
  goToPrevDay: () => void;
  goToNextDay: () => void;
  goToToday: () => void;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  selectedDate: todayStr(),
  daySummary: null,
  goalStreak: null,
  dailyGoalMinutes: 240,
  loading: false,

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    get().fetchDaySummary(date);
  },

  fetchDaySummary: async (date) => {
    set({ loading: true });
    try {
      const summary = await invoke<DaySummary>("get_day_summary", { date });
      set({ daySummary: summary, loading: false });
      // Also refresh goal streak when today
      if (date === todayStr()) {
        get().fetchGoalStreak();
      }
    } catch (e) {
      console.error("Failed to fetch day summary:", e);
      set({ loading: false });
    }
  },

  fetchGoalStreak: async () => {
    try {
      const streak = await invoke<GoalStreak>("get_goal_streak", {
        dailyGoalMinutes: get().dailyGoalMinutes,
      });
      set({ goalStreak: streak });
    } catch (e) {
      console.error("Failed to fetch goal streak:", e);
    }
  },

  saveDailyGoal: async (minutes: number) => {
    set({ dailyGoalMinutes: minutes });
    try {
      await invoke("save_goal_settings", { dailyGoalMinutes: minutes });
      get().fetchGoalStreak();
    } catch (e) {
      console.error("Failed to save goal settings:", e);
    }
  },

  goToPrevDay: () => {
    const prev = addDays(get().selectedDate, -1);
    get().setSelectedDate(prev);
  },

  goToNextDay: () => {
    const next = addDays(get().selectedDate, 1);
    if (next <= todayStr()) {
      get().setSelectedDate(next);
    }
  },

  goToToday: () => {
    get().setSelectedDate(todayStr());
  },
}));
