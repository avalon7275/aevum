import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { supabase } from "../lib/supabase";

interface CoachAnalysis {
  summary: string;
  highlights: string[];
  concerns: string[];
  tip: string;
  hours_grade: "healthy" | "light" | "heavy" | "overwork";
}

interface CachedWeek {
  analysis: CoachAnalysis;
  generatedAt: string;
}

interface CoachState {
  analysis: CoachAnalysis | null;
  weekStart: string;
  loading: boolean;
  error: string | null;
  lastGenerated: string | null;
  alreadyGenerated: boolean;
  loadCachedWeek: (weekStart: string) => void;
  generate: (weekStart: string) => Promise<void>;
}

const CACHE_KEY = "aevum_coach_cache_v2";

function readCache(): Record<string, CachedWeek> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeCache(weekStart: string, entry: CachedWeek) {
  const cache = readCache();
  cache[weekStart] = entry;
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

export const useCoachStore = create<CoachState>((set) => ({
  analysis: null,
  weekStart: "",
  loading: false,
  error: null,
  lastGenerated: null,
  alreadyGenerated: false,

  loadCachedWeek: (weekStart: string) => {
    const cache = readCache();
    const entry = cache[weekStart];
    if (entry) {
      set({
        analysis: entry.analysis,
        weekStart,
        lastGenerated: entry.generatedAt,
        alreadyGenerated: true,
        error: null,
      });
    } else {
      set({
        analysis: null,
        weekStart: "",
        lastGenerated: null,
        alreadyGenerated: false,
        error: null,
      });
    }
  },

  generate: async (weekStart: string) => {
    // Check if already generated for this week
    const cache = readCache();
    if (cache[weekStart]) {
      set({
        error: "Report already generated for this week.",
        loading: false,
      });
      return;
    }

    set({ loading: true, error: null });

    try {
      // 1. Get coach data from local DB via Tauri
      const coachData = await invoke("get_coach_data", { weekStart });

      // 2. Get auth token
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        set({ loading: false, error: "Not signed in" });
        return;
      }

      // 3. Send to Supabase Edge Function (30s timeout)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-analyze`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ coach_data: coachData }),
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        set({ loading: false, error: err.error || `Error ${res.status}` });
        return;
      }

      const { analysis } = await res.json();
      const now = new Date().toISOString();

      // 4. Cache per-week
      writeCache(weekStart, { analysis, generatedAt: now });

      set({
        analysis,
        weekStart,
        lastGenerated: now,
        alreadyGenerated: true,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "AbortError"
          ? "Analysis timed out. Please try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong";
      set({ loading: false, error: message });
    }
  },
}));
