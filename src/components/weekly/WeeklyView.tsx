import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  FolderOpen,
} from "lucide-react";
import {
  useWeeklyStore,
  getMonday,
  type DayTotal,
  type HeatmapDay,
} from "../../stores/weeklyStore";
import { WeeklyComparison } from "./WeeklyComparison";
import { formatDuration, todayStr, toDateStr } from "../../lib/formatters";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const sameMonth = s.getMonth() === e.getMonth();
  if (sameMonth) {
    return `${s.toLocaleDateString([], { month: "long", day: "numeric" })} - ${e.getDate()}, ${e.getFullYear()}`;
  }
  return `${s.toLocaleDateString([], { month: "short", day: "numeric" })} - ${e.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}`;
}

export function WeeklyView() {
  const {
    weekStart,
    weekSummary,
    weekComparison,
    heatmapDays,
    loading,
    fetchWeekSummary,
    fetchHeatmap,
    goToPrevWeek,
    goToNextWeek,
    goToThisWeek,
    setWeekStart,
  } = useWeeklyStore();

  useEffect(() => {
    fetchWeekSummary(weekStart);
  }, [weekStart, fetchWeekSummary]);

  // Fetch heatmap on mount
  useEffect(() => {
    fetchHeatmap();
  }, [fetchHeatmap]);

  // Auto-refresh if current week
  useEffect(() => {
    const thisMonday = getMonday();
    if (weekStart !== thisMonday) return;
    const interval = setInterval(() => {
      fetchWeekSummary(weekStart);
      fetchHeatmap();
    }, 30000);
    return () => clearInterval(interval);
  }, [weekStart, fetchWeekSummary, fetchHeatmap]);

  const isCurrentWeek = weekStart === getMonday();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#111111]">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevWeek}
            className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
          >
            <ChevronLeft size={16} />
          </button>

          <span className="text-sm font-medium text-white/80 min-w-[180px] text-center">
            {weekSummary
              ? formatWeekRange(weekSummary.week_start, weekSummary.week_end)
              : weekStart}
          </span>

          <button
            onClick={goToNextWeek}
            disabled={isCurrentWeek}
            className={`p-1 rounded transition-colors ${
              isCurrentWeek
                ? "text-white/10 cursor-not-allowed"
                : "hover:bg-white/10 text-white/40 hover:text-white/70"
            }`}
          >
            <ChevronRight size={16} />
          </button>

          {!isCurrentWeek && (
            <button
              onClick={goToThisWeek}
              className="ml-2 px-2 py-0.5 text-xs rounded bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/70 transition-colors"
            >
              This Week
            </button>
          )}
        </div>

        {loading && (
          <div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {weekSummary && (
          <>
            <WeeklyStats summary={weekSummary} />
            <WeekAreaChart days={weekSummary.days} />
          </>
        )}

        {weekSummary && weekSummary.total_secs === 0 && (
          <div className="text-center text-white/20 py-12 text-sm">
            No activity recorded this week
          </div>
        )}

        {weekComparison && <WeeklyComparison comparison={weekComparison} />}

        <YearHeatmap
          days={heatmapDays}
          selectedWeek={weekStart}
          onWeekClick={setWeekStart}
        />
      </div>
    </div>
  );
}

function WeeklyStats({
  summary,
}: {
  summary: { total_secs: number; total_sessions: number; unique_tracks: number };
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        icon={<Clock size={16} />}
        label="Total Time"
        value={formatDuration(summary.total_secs)}
      />
      <StatCard
        icon={<Layers size={16} />}
        label="Sessions"
        value={String(summary.total_sessions)}
      />
      <StatCard
        icon={<FolderOpen size={16} />}
        label="Tracks"
        value={String(summary.unique_tracks)}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-3">
      <div className="flex items-center gap-2 text-white/40 mb-1">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-semibold text-white/90 truncate">
        {value}
      </div>
    </div>
  );
}

function WeekAreaChart({ days }: { days: DayTotal[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const maxSecs = Math.max(...days.map((d) => d.total_secs), 1800);
  const maxHrs = Math.max(1, Math.ceil(maxSecs / 3600));
  const ceil = maxHrs * 3600;

  const W = 460;
  const H = 145;
  const pad = { t: 12, r: 14, b: 20, l: 30 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;
  const baseline = pad.t + ch;

  const toX = (i: number) => pad.l + (i / Math.max(days.length - 1, 1)) * cw;
  const toY = (secs: number) => pad.t + ch * (1 - secs / ceil);
  const pts = days.map((d, i) => ({ x: toX(i), y: toY(d.total_secs) }));

  // Catmull-Rom spline -> cubic bezier for smooth curve
  const n = (v: number) => v.toFixed(1);
  let curve = `M${n(pts[0].x)},${n(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    curve += `C${n(p1.x + (p2.x - p0.x) / 6)},${n(p1.y + (p2.y - p0.y) / 6)} ${n(
      p2.x - (p3.x - p1.x) / 6
    )},${n(p2.y - (p3.y - p1.y) / 6)} ${n(p2.x)},${n(p2.y)}`;
  }
  const area = `${curve}L${n(pts[pts.length - 1].x)},${baseline}L${n(pts[0].x)},${baseline}Z`;

  // Y-axis grid
  const step = maxHrs <= 2 ? 1 : maxHrs <= 6 ? 2 : maxHrs <= 12 ? 3 : Math.ceil(maxHrs / 4);
  const grids: { y: number; label: string }[] = [];
  for (let h = 0; h <= maxHrs; h += step) {
    grids.push({ y: toY(h * 3600), label: `${h}h` });
  }

  // Nearest-point hover
  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement!;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = Math.abs(pts[i].x - mx);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHoverIdx(best);
  };

  const hp = hoverIdx !== null ? pts[hoverIdx] : null;
  const hd = hoverIdx !== null ? days[hoverIdx] : null;

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs uppercase tracking-wider text-white/30">Daily Hours</h3>
        {hd && hd.total_secs > 0 && (
          <span className="text-[11px] text-white/50 font-mono tabular-nums">
            {`${DAY_LABELS[hoverIdx!]} \u00B7 ${formatDuration(hd.total_secs)}`}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHoverIdx(null)}
      >
        <defs>
          <linearGradient id="wkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(99,102,241)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="rgb(99,102,241)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid */}
        {grids.map((g, i) => (
          <g key={i}>
            <line
              x1={pad.l}
              y1={g.y}
              x2={W - pad.r}
              y2={g.y}
              stroke="rgba(255,255,255,0.04)"
            />
            <text
              x={pad.l - 4}
              y={g.y}
              textAnchor="end"
              dominantBaseline="middle"
              fill="rgba(255,255,255,0.15)"
              fontSize="8"
              fontFamily="ui-monospace,monospace"
            >
              {g.label}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={area} fill="url(#wkGrad)" />

        {/* Line */}
        <path
          d={curve}
          fill="none"
          stroke="rgb(99,102,241)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover guide line */}
        {hp && (
          <line
            x1={hp.x}
            y1={pad.t}
            x2={hp.x}
            y2={baseline}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="3,3"
          />
        )}

        {/* Dots */}
        {pts.map((p, i) => (
          <g key={i}>
            {hoverIdx === i && (
              <circle cx={p.x} cy={p.y} r="8" fill="rgba(99,102,241,0.12)" />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={hoverIdx === i ? "4" : "2.5"}
              fill={
                days[i].total_secs > 0
                  ? "rgb(99,102,241)"
                  : "rgba(255,255,255,0.08)"
              }
              stroke={hoverIdx === i ? "rgba(255,255,255,0.9)" : "none"}
              strokeWidth="1.5"
            />
          </g>
        ))}

        {/* Hover zone */}
        <rect
          x={pad.l - 10}
          y={pad.t}
          width={cw + 20}
          height={ch + pad.b}
          fill="transparent"
          onMouseMove={onMove}
          style={{ cursor: "crosshair" }}
        />

        {/* X labels */}
        {pts.map((p, i) => {
          const isToday = days[i].date === todayStr();
          return (
            <text
              key={`xl-${i}`}
              x={p.x}
              y={baseline + 14}
              textAnchor="middle"
              fill={isToday ? "rgb(129,140,248)" : "rgba(255,255,255,0.22)"}
              fontSize="7"
              fontWeight={isToday ? "600" : "400"}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {DAY_LABELS[i]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Year Heatmap ─────────────────────────────────────────────────────────────

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HEAT_ROW_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

function getHeatColor(secs: number, maxSecs: number): string {
  if (secs === 0) return "rgba(255,255,255,0.03)";
  const ratio = Math.min(secs / maxSecs, 1);
  // 4-stop indigo gradient
  if (ratio < 0.25) return "rgba(99,102,241,0.2)";
  if (ratio < 0.5) return "rgba(99,102,241,0.4)";
  if (ratio < 0.75) return "rgba(99,102,241,0.65)";
  return "rgba(99,102,241,0.9)";
}

function YearHeatmap({
  days,
  selectedWeek,
  onWeekClick,
}: {
  days: HeatmapDay[];
  selectedWeek: string;
  onWeekClick: (weekStart: string) => void;
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  if (days.length === 0) return null;

  // Build the grid: weeks as columns, days as rows (Mon=0 .. Sun=6)
  const maxSecs = Math.max(...days.map((d) => d.total_secs), 3600); // min 1h for scale

  // Group days into weeks (each week starts Monday)
  const weeks: HeatmapDay[][] = [];
  let currentWeek: HeatmapDay[] = [];

  for (let i = 0; i < days.length; i++) {
    const d = new Date(days[i].date + "T12:00:00");
    const dow = d.getDay();
    const mondayIdx = dow === 0 ? 6 : dow - 1;

    // If this is Monday and we have a partial week, push it
    if (mondayIdx === 0 && currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    // Pad first week if it doesn't start on Monday
    if (weeks.length === 0 && currentWeek.length === 0 && mondayIdx > 0) {
      for (let j = 0; j < mondayIdx; j++) {
        currentWeek.push({ date: "", total_secs: -1 }); // placeholder
      }
    }

    currentWeek.push(days[i]);
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  // Figure out month label positions (skip labels too close together)
  const monthPositions: { label: string; col: number }[] = [];
  let lastMonth = -1;
  let lastCol = -Infinity;
  const minColGap = 3; // need at least 3 week-columns between labels
  for (let col = 0; col < weeks.length; col++) {
    const firstReal = weeks[col].find((d) => d.date !== "");
    if (!firstReal) continue;
    const month = new Date(firstReal.date + "T12:00:00").getMonth();
    if (month !== lastMonth) {
      if (col - lastCol >= minColGap) {
        monthPositions.push({ label: MONTH_LABELS[month], col });
        lastCol = col;
      } else if (monthPositions.length > 0) {
        // Replace the previous too-close label with this one (prefer the later/newer month)
        monthPositions[monthPositions.length - 1] = { label: MONTH_LABELS[month], col: lastCol };
      }
      lastMonth = month;
    }
  }

  const cellSize = 11;
  const cellGap = 2;
  const step = cellSize + cellGap;
  const labelWidth = 28;

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
      <h3 className="text-xs uppercase tracking-wider text-white/30 mb-3">
        Year Activity
      </h3>

      <div className="relative overflow-x-auto">
        {/* Month labels */}
        <div className="flex" style={{ paddingLeft: labelWidth, marginBottom: 4 }}>
          {monthPositions.map((mp, i) => {
            const nextCol = i < monthPositions.length - 1 ? monthPositions[i + 1].col : weeks.length;
            const span = nextCol - mp.col;
            return (
              <span
                key={mp.label + mp.col}
                className="text-[10px] text-white/30"
                style={{ width: span * step, flexShrink: 0 }}
              >
                {mp.label}
              </span>
            );
          })}
        </div>

        {/* Grid */}
        <div className="flex">
          {/* Row labels */}
          <div className="flex flex-col" style={{ width: labelWidth, flexShrink: 0 }}>
            {HEAT_ROW_LABELS.map((label, i) => (
              <span
                key={i}
                className="text-[10px] text-white/25 flex items-center"
                style={{ height: step }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Cells */}
          <div className="flex gap-[2px]">
            {weeks.map((week, col) => {
              // Determine if this week column matches the selectedWeek
              const weekMonday = week.find((d) => d.date !== "" && d.total_secs >= 0);
              let weekStartDate = "";
              if (weekMonday) {
                const wd = new Date(weekMonday.date + "T12:00:00");
                const dow = wd.getDay();
                const mondayOffset = dow === 0 ? 6 : dow - 1;
                const monday = new Date(wd);
                monday.setDate(monday.getDate() - mondayOffset);
                weekStartDate = toDateStr(monday);
              }
              const isSelected = weekStartDate === selectedWeek;

              return (
                <div key={col} className="flex flex-col gap-[2px]">
                  {Array.from({ length: 7 }).map((_, row) => {
                    const day = week[row];
                    const isEmpty = !day || day.date === "" || day.total_secs < 0;

                    return (
                      <div
                        key={row}
                        className={`rounded-[2px] transition-all ${
                          !isEmpty ? "cursor-pointer" : ""
                        } ${isSelected && !isEmpty ? "ring-1 ring-indigo-400/60" : ""}`}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: isEmpty
                            ? "transparent"
                            : getHeatColor(day.total_secs, maxSecs),
                        }}
                        onClick={() => {
                          if (!isEmpty && weekStartDate) {
                            onWeekClick(weekStartDate);
                          }
                        }}
                        onMouseEnter={(e) => {
                          if (isEmpty) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const hrs = (day.total_secs / 3600).toFixed(1);
                          const dateLabel = new Date(day.date + "T12:00:00").toLocaleDateString([], {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          });
                          setTooltip({
                            x: rect.left + rect.width / 2,
                            y: rect.top - 4,
                            text: day.total_secs > 0 ? `${dateLabel}: ${hrs}h` : `${dateLabel}: No activity`,
                          });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 mt-3 justify-end">
          <span className="text-[10px] text-white/25">Less</span>
          {[0, 0.15, 0.35, 0.65, 0.9].map((v, i) => (
            <div
              key={i}
              className="rounded-[2px]"
              style={{
                width: cellSize,
                height: cellSize,
                backgroundColor:
                  v === 0 ? "rgba(255,255,255,0.03)" : `rgba(99,102,241,${v})`,
              }}
            />
          ))}
          <span className="text-[10px] text-white/25">More</span>
        </div>
      </div>

      {/* Tooltip portal */}
      {tooltip && (
        <div
          className="fixed z-50 px-2 py-1 rounded bg-black/90 border border-white/10 text-[11px] text-white/80 pointer-events-none whitespace-nowrap"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(-50%, -100%)",
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
