import { useSessionStore } from "../../stores/sessionStore";
import {
  formatTimestamp,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatDuration,
} from "../../lib/formatters";

export function EventStream() {
  const { pollingStatus, recentTicks } = useSessionStore();

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-white/5 bg-[#111111]">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              pollingStatus.is_tracking
                ? "bg-emerald-400 animate-pulse"
                : pollingStatus.is_running
                ? "bg-amber-400"
                : "bg-gray-500"
            }`}
          />
          <span className="text-sm text-white/70">
            {pollingStatus.is_tracking
              ? "Tracking"
              : pollingStatus.is_running
              ? "Watching"
              : "Paused"}
          </span>
        </div>

        {pollingStatus.current_daw && (
          <span className="text-sm text-white/50">
            {pollingStatus.current_daw}
          </span>
        )}

        {pollingStatus.current_track && (
          <span className="text-sm font-medium text-white/90">
            {pollingStatus.current_track}
          </span>
        )}

        {pollingStatus.is_tracking && (
          <>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor:
                  (CATEGORY_COLORS[pollingStatus.current_category] || "#4b5563") + "33",
                color:
                  CATEGORY_COLORS[pollingStatus.current_category] || "#9ca3af",
              }}
            >
              {CATEGORY_LABELS[pollingStatus.current_category] ||
                pollingStatus.current_category}
            </span>
            <span className="text-sm text-white/50 ml-auto">
              {formatDuration(pollingStatus.session_duration_secs)}
            </span>
          </>
        )}
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {recentTicks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-white/30 text-sm">
            Waiting for activity... Open a DAW to start tracking.
          </div>
        ) : (
          <div className="space-y-1">
            {recentTicks.map((tick, i) => (
              <div
                key={`${tick.timestamp}-${i}`}
                className="flex items-center gap-3 py-1.5 text-xs font-mono"
              >
                <span className="text-white/30 w-16 shrink-0">
                  {formatTimestamp(tick.timestamp)}
                </span>
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[tick.status.current_category] || "#4b5563",
                  }}
                />
                <span
                  className="text-xs w-20 shrink-0 truncate"
                  style={{
                    color:
                      CATEGORY_COLORS[tick.status.current_category] || "#6b7280",
                  }}
                >
                  {CATEGORY_LABELS[tick.status.current_category] ||
                    tick.status.current_category}
                </span>
                {tick.detected_plugin ? (
                  <span className="text-emerald-400/80 truncate w-36 shrink-0">
                    {tick.detected_plugin}
                  </span>
                ) : (
                  <span className="text-white/40 truncate w-36 shrink-0">
                    {tick.process_name}
                  </span>
                )}
                <span className="text-white/60 truncate flex-1">
                  {tick.window_title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
