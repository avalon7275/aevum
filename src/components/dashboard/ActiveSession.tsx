import { useSessionStore } from "../../stores/sessionStore";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatDuration,
} from "../../lib/formatters";

export function ActiveSession() {
  const { pollingStatus } = useSessionStore();

  if (!pollingStatus.is_tracking) {
    return (
      <div className="bg-white/[0.03] border border-white/5 rounded-lg px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-sm text-white/50">
            {pollingStatus.is_running
              ? "Watching for DAW activity..."
              : "Paused"}
          </span>
        </div>
      </div>
    );
  }

  const catColor =
    CATEGORY_COLORS[pollingStatus.current_category] || "#4b5563";
  const catLabel =
    CATEGORY_LABELS[pollingStatus.current_category] ||
    pollingStatus.current_category;

  return (
    <div
      className="border rounded-lg px-4 py-3"
      style={{
        backgroundColor: catColor + "08",
        borderColor: catColor + "30",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: catColor }}
          />
          <div>
            <div className="text-sm font-medium text-white/90">
              {pollingStatus.current_project}
            </div>
            <div className="text-xs text-white/40">
              {pollingStatus.current_daw}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: catColor + "33",
              color: catColor,
            }}
          >
            {catLabel}
          </span>
          <span className="text-lg font-mono text-white/80">
            {formatDuration(pollingStatus.session_duration_secs)}
          </span>
        </div>
      </div>
    </div>
  );
}
