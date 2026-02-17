import { CATEGORY_COLORS, CATEGORY_LABELS, formatDuration } from "../../lib/formatters";
import type { DaySummary } from "../../stores/dashboardStore";

interface Props {
  summary: DaySummary;
  isTracking?: boolean;
}

export function CategoryBreakdown({ summary, isTracking }: Props) {
  const totals = summary.category_totals.filter(
    (c) => c.category !== "idle" && c.category !== "break"
  );
  const totalSecs = totals.reduce((sum, c) => sum + c.total_secs, 0);

  if (totalSecs === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/20 text-sm">
        No activity yet
      </div>
    );
  }

  // SVG donut chart
  const size = 200;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <div
        className="shrink-0 rounded-full transition-shadow duration-700"
        style={
          isTracking
            ? {
                boxShadow: "0 0 40px rgba(99, 102, 241, 0.15)",
                animation: "glow-pulse 3s ease-in-out infinite",
              }
            : undefined
        }
      >
        <style>{`
          @keyframes glow-pulse {
            0%, 100% { box-shadow: 0 0 30px rgba(99, 102, 241, 0.1); }
            50% { box-shadow: 0 0 50px rgba(99, 102, 241, 0.25); }
          }
        `}</style>
        <svg width={size} height={size}>
        {totals.map((cat) => {
          const pct = cat.total_secs / totalSecs;
          const gap = totals.length > 1 ? 1.5 : 0;
          const dashLength = Math.max(pct * circumference - gap, 0);
          const dashOffset = -(offset * circumference + gap / 2);
          offset += pct;

          return (
            <circle
              key={cat.category}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={CATEGORY_COLORS[cat.category] || "#4b5563"}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className="transition-all duration-500"
            />
          );
        })}
        <text
          x={size / 2}
          y={size / 2 - 8}
          textAnchor="middle"
          className="fill-white/90 font-semibold"
          fontSize="24"
        >
          {formatDuration(totalSecs)}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 14}
          textAnchor="middle"
          className="fill-white/40"
          fontSize="12"
        >
          productive
        </text>
      </svg>
      </div>

      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {totals.map((cat) => {
          const pct = Math.round((cat.total_secs / totalSecs) * 100);
          return (
            <div key={cat.category} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{
                  backgroundColor: CATEGORY_COLORS[cat.category] || "#4b5563",
                }}
              />
              <span className="text-xs text-white/60 w-24 truncate">
                {CATEGORY_LABELS[cat.category] || cat.category}
              </span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor:
                      CATEGORY_COLORS[cat.category] || "#4b5563",
                  }}
                />
              </div>
              <span className="text-xs text-white/40 w-12 text-right">
                {formatDuration(cat.total_secs)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
