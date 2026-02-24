import { ArrowUp, ArrowDown } from "lucide-react";
import type { WeekComparison } from "../../stores/weeklyStore";
import { formatDuration, CATEGORY_COLORS, CATEGORY_LABELS } from "../../lib/formatters";

interface Props {
  comparison: WeekComparison;
}

export function WeeklyComparison({ comparison }: Props) {
  if (comparison.last_week_total === 0 && comparison.this_week_total === 0) {
    return null;
  }

  const hasShifts =
    comparison.category_shifts.length > 0 ||
    comparison.track_shifts.length > 0;

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
      <h3 className="text-xs uppercase tracking-wider text-white/30 mb-3">
        vs Last Week
      </h3>

      {/* Insight text */}
      <p className="text-sm text-white/50 italic mb-4">{comparison.insight}</p>

      {hasShifts && (
        <div className="space-y-3">
          {/* Category shifts */}
          {comparison.category_shifts.slice(0, 4).map((shift) => {
            const maxSecs = Math.max(
              shift.this_week_secs,
              shift.last_week_secs,
              1
            );
            const thisPct = (shift.this_week_secs / maxSecs) * 100;
            const lastPct = (shift.last_week_secs / maxSecs) * 100;
            const color = CATEGORY_COLORS[shift.category] || "#4b5563";
            const label =
              CATEGORY_LABELS[shift.category] || shift.category;

            return (
              <div key={shift.category} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs text-white/60">{label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {shift.direction === "up" ? (
                      <ArrowUp size={12} className="text-emerald-400/70" />
                    ) : (
                      <ArrowDown size={12} className="text-red-400/70" />
                    )}
                    <span className="text-xs text-white/40">
                      {formatDuration(Math.abs(shift.delta_secs))}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-0.5">
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${thisPct}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 opacity-40"
                        style={{
                          width: `${lastPct}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-[10px] text-white/25 w-8 text-right shrink-0">
                    <div>now</div>
                    <div>prev</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
