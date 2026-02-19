import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { useDashboardStore } from "../../stores/dashboardStore";
import { useSessionStore } from "../../stores/sessionStore";
import { DateNavigation } from "./DateNavigation";
import { ActiveSession } from "./ActiveSession";
import { DailySummaryPanel } from "./DailySummary";
import { CategoryBreakdown } from "./CategoryBreakdown";
import { DailyTimeline } from "./DailyTimeline";
import { GoalProgress } from "./GoalProgress";
import { ArrowUpRight } from "lucide-react";

interface DashboardPageProps {
  onNavigate?: (view: string) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { selectedDate, daySummary, loading, fetchDaySummary } =
    useDashboardStore();
  const isTracking = useSessionStore((s) => s.pollingStatus.is_tracking);

  // Promo pulse every 30s
  const [promoPulse, setPromoPulse] = useState(false);
  useEffect(() => {
    const interval = setInterval(() => {
      setPromoPulse(true);
      setTimeout(() => setPromoPulse(false), 3000);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch on mount and when date changes
  useEffect(() => {
    fetchDaySummary(selectedDate);
  }, [selectedDate, fetchDaySummary]);

  // Auto-refresh every 30s for today
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (selectedDate !== today) return;

    const interval = setInterval(() => {
      fetchDaySummary(selectedDate);
    }, 30000);

    return () => clearInterval(interval);
  }, [selectedDate, fetchDaySummary]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#111111]">
        <DateNavigation />
        {loading && (
          <div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Live session indicator */}
        <ActiveSession />

        {/* Goal progress */}
        <GoalProgress />

        {daySummary && daySummary.total_secs > 0 ? (
          <>
            {/* Stats row */}
            <DailySummaryPanel summary={daySummary} onNavigate={onNavigate} />

            {/* Main content: timeline + breakdown */}
            <div className="grid grid-cols-[80px_1fr] gap-4 min-h-[300px]">
              {/* Timeline */}
              <DailyTimeline summary={daySummary} />

              {/* Category breakdown */}
              <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
                <h3 className="text-xs uppercase tracking-wider text-white/30 mb-3">
                  Activity Breakdown
                </h3>
                <CategoryBreakdown summary={daySummary} isTracking={isTracking} />
              </div>
            </div>
          </>
        ) : (
          !loading && (
            <div className="flex items-center justify-center h-64 text-white/20 text-sm">
              No activity recorded for this day
            </div>
          )
        )}
      </div>

      {/* Promo */}
      <div className="flex items-center justify-end px-4 py-2 shrink-0">
        <button
          onClick={() => open("https://risewithalex.com")}
          className={`promo-link flex items-center gap-1.5 text-[11px]${promoPulse ? " promo-bright" : ""}`}
        >
          Tracking your time is the first step. Turning it into a career is next.
          <ArrowUpRight size={10} className="shrink-0" />
        </button>
      </div>
    </div>
  );
}
