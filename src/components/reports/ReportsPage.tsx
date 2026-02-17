import { useEffect } from "react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { DateNavigation } from "../dashboard/DateNavigation";
import { formatDuration } from "../../lib/formatters";
import type { DaySummary } from "../../stores/dashboardStore";

export function ReportsPage() {
  const { selectedDate, daySummary, loading, fetchDaySummary } =
    useDashboardStore();

  useEffect(() => {
    fetchDaySummary(selectedDate);
  }, [selectedDate, fetchDaySummary]);

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
        {daySummary && daySummary.total_secs > 0 ? (
          <>
            <FocusSection summary={daySummary} />
            <PluginsSection summary={daySummary} />
          </>
        ) : (
          !loading && (
            <div className="flex items-center justify-center h-64 text-white/20 text-sm">
              No activity recorded for this day
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Focus Section ──────────────────────────────────────────────

function FocusSection({ summary }: { summary: DaySummary }) {
  const { focus } = summary;

  if (focus.total_secs === 0) {
    return (
      <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
        <h3 className="text-xs uppercase tracking-wider text-white/30 mb-3">
          Focus
        </h3>
        <div className="text-sm text-white/20">No focus data yet</div>
      </div>
    );
  }

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
      <h3 className="text-xs uppercase tracking-wider text-white/30 mb-4">
        Focus
      </h3>

      {/* Timeline: the main visual */}
      <FocusTimeline summary={summary} />

      {/* Text insights */}
      {focus.insights.length > 0 && (
        <div className="mt-4 space-y-1.5">
          {focus.insights.map((insight, i) => (
            <p key={i} className="text-sm text-white/60 leading-relaxed">
              {insight}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function FocusTimeline({ summary }: { summary: DaySummary }) {
  const { focus } = summary;
  const { periods } = focus;

  if (periods.length === 0) return null;

  const dayStart = periods[0].start_ts;
  const dayEnd = periods[periods.length - 1].end_ts;
  const totalSpan = dayEnd - dayStart;
  if (totalSpan <= 0) return null;

  return (
    <div>
      {/* The bar */}
      <div className="h-6 bg-white/5 rounded-lg overflow-hidden flex">
        {periods.map((period, i) => {
          const width = Math.max(
            ((period.end_ts - period.start_ts) / totalSpan) * 100,
            0.3
          );
          return (
            <div
              key={i}
              className="h-full transition-all duration-300 relative group"
              style={{
                width: `${width}%`,
                backgroundColor: period.focused
                  ? "rgba(99, 102, 241, 0.45)"
                  : "rgba(239, 68, 68, 0.25)",
              }}
            >
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                <div className="bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-[10px] text-white/70 whitespace-nowrap">
                  {period.focused ? "In DAW" : "Away"} /{" "}
                  {formatDuration(period.duration_secs)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time labels + legend */}
      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-white/25">
          {formatTime(dayStart)}
        </span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-white/25">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500/45" /> In DAW
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/25">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500/25" /> Away
          </span>
        </div>
        <span className="text-[10px] text-white/25">
          {formatTime(dayEnd)}
        </span>
      </div>
    </div>
  );
}

// ── Plugins Section ────────────────────────────────────────────

function PluginsSection({ summary }: { summary: DaySummary }) {
  const { plugins } = summary;

  if (plugins.top_plugins.length === 0) {
    return (
      <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
        <h3 className="text-xs uppercase tracking-wider text-white/30 mb-3">
          Plugins
        </h3>
        <div className="text-sm text-white/20">
          No plugin usage detected yet.
        </div>
      </div>
    );
  }

  const maxPluginSecs = plugins.top_plugins[0]?.total_secs || 1;
  const maxCatSecs = plugins.categories[0]?.total_secs || 1;

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
      <h3 className="text-xs uppercase tracking-wider text-white/30 mb-4">
        Plugins
      </h3>

      {/* Text insights */}
      {plugins.insights.length > 0 && (
        <div className="space-y-1.5 mb-5">
          {plugins.insights.map((insight, i) => (
            <p key={i} className="text-sm text-white/60 leading-relaxed">
              {insight}
            </p>
          ))}
        </div>
      )}

      {/* Two columns: categories + top plugins */}
      <div className="grid grid-cols-2 gap-4">
        {/* Plugin categories */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/20 mb-2">
            By Category
          </div>
          <div className="space-y-2">
            {plugins.categories.map((cat) => {
              const pct = Math.round((cat.total_secs / maxCatSecs) * 100);
              return (
                <div key={cat.category} className="flex items-center gap-2">
                  <span className="text-xs text-white/60 w-28 truncate shrink-0">
                    {cat.label}
                  </span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-violet-500/50 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/30 w-12 text-right shrink-0">
                    {formatDuration(cat.total_secs)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top plugins */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/20 mb-2">
            Top Plugins
          </div>
          <div className="space-y-2">
            {plugins.top_plugins.slice(0, 10).map((plugin) => {
              const pct = Math.round(
                (plugin.total_secs / maxPluginSecs) * 100
              );
              return (
                <div key={plugin.name} className="flex items-center gap-2">
                  <span className="text-xs text-white/60 w-28 truncate shrink-0">
                    {plugin.name}
                  </span>
                  <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500/50 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/30 w-12 text-right shrink-0">
                    {formatDuration(plugin.total_secs)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
