import { CATEGORY_COLORS, CATEGORY_LABELS } from "../../lib/formatters";
import type { DaySummary } from "../../stores/dashboardStore";

interface Props {
  summary: DaySummary;
}

export function DailyTimeline({ summary }: Props) {
  const blocks = summary.timeline;

  if (blocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/20 text-sm">
        No activity recorded
      </div>
    );
  }

  // Find the time range for the day
  const firstTs = blocks[0].start_ts;
  const lastTs = blocks[blocks.length - 1].end_ts;
  const totalSpan = Math.max(lastTs - firstTs, 60); // At least 1 minute span

  // Generate hour markers
  const firstHour = Math.floor(firstTs / 3600) * 3600;
  const lastHour = Math.ceil(lastTs / 3600) * 3600;
  const hourMarkers: number[] = [];
  for (let h = firstHour; h <= lastHour; h += 3600) {
    if (h >= firstTs && h <= lastTs) {
      hourMarkers.push(h);
    }
  }

  return (
    <div className="flex h-full gap-2">
      {/* Time labels */}
      <div className="relative w-10 shrink-0">
        {hourMarkers.map((h) => {
          const pct = ((h - firstTs) / totalSpan) * 100;
          const time = new Date(h * 1000);
          const label = time.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          return (
            <div
              key={h}
              className="absolute text-[10px] text-white/30 leading-none"
              style={{ top: `${pct}%`, transform: "translateY(-50%)" }}
            >
              {label}
            </div>
          );
        })}
      </div>

      {/* Timeline bar */}
      <div className="relative flex-1 bg-white/[0.02] rounded-lg overflow-hidden border border-white/5">
        {blocks.map((block, i) => {
          const top = ((block.start_ts - firstTs) / totalSpan) * 100;
          const height = Math.max(
            ((block.end_ts - block.start_ts) / totalSpan) * 100,
            0.5
          );
          const color = CATEGORY_COLORS[block.category] || "#4b5563";
          const label = CATEGORY_LABELS[block.category] || block.category;

          return (
            <div
              key={`${block.start_ts}-${i}`}
              className="absolute left-0 right-0 group cursor-default"
              style={{
                top: `${top}%`,
                height: `${height}%`,
                minHeight: "2px",
              }}
            >
              <div
                className="w-full h-full rounded-sm opacity-70 hover:opacity-100 transition-opacity"
                style={{ backgroundColor: color }}
              />
              {/* Tooltip on hover */}
              <div className="absolute left-full ml-2 top-0 hidden group-hover:block z-10 bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-xs whitespace-nowrap">
                <span style={{ color }}>{label}</span>
                <span className="text-white/40 ml-2">
                  {formatTime(block.start_ts)} - {formatTime(block.end_ts)}
                </span>
              </div>
            </div>
          );
        })}

        {/* Hour grid lines */}
        {hourMarkers.map((h) => {
          const pct = ((h - firstTs) / totalSpan) * 100;
          return (
            <div
              key={`line-${h}`}
              className="absolute left-0 right-0 border-t border-white/5"
              style={{ top: `${pct}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
