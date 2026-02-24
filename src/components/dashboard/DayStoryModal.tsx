import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { X, Download, Copy, Check } from "lucide-react";
import {
  formatDuration,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from "../../lib/formatters";
import type { DaySummary } from "../../stores/dashboardStore";

interface Props {
  summary: DaySummary;
  date: string;
  onClose: () => void;
}

function formatDatePretty(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function DayStoryModal({ summary, date, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const captureCard = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    try {
      return await toPng(cardRef.current, {
        backgroundColor: "#09090b",
        pixelRatio: 2,
      });
    } catch (e) {
      console.error("Failed to capture card:", e);
      return null;
    }
  };

  const handleDownload = async () => {
    if (exporting) return;
    setExporting(true);
    const dataUrl = await captureCard();
    if (dataUrl) {
      const link = document.createElement("a");
      link.download = `aevum-${date}.png`;
      link.href = dataUrl;
      link.click();
    }
    setExporting(false);
  };

  const handleCopyImage = async () => {
    if (copied) return;
    const dataUrl = await captureCard();
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy image:", e);
    }
  };

  const totals = summary.category_totals.filter(
    (c) => c.category !== "idle" && c.category !== "break"
  );
  const productiveSecs = totals.reduce((sum, c) => sum + c.total_secs, 0);
  const topTrack = summary.tracks[0];

  // Focus percentage from the focus report
  const focusPct =
    summary.focus.total_secs > 0
      ? Math.round(
          (summary.focus.daw_secs / summary.focus.total_secs) * 100
        )
      : 0;

  // Longest focused period
  const longestFocus = summary.focus.periods
    .filter((p) => p.focused)
    .reduce((max, p) => Math.max(max, p.duration_secs), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[480px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>

        {/* ─── The Card (capturable) ─── */}
        <div
          ref={cardRef}
          className="rounded-2xl overflow-hidden border border-white/[0.08]"
          style={{
            background: "linear-gradient(180deg, #0f0f14 0%, #09090b 100%)",
          }}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between px-6 pt-5 pb-1">
            <span
              className="text-[11px] font-bold tracking-[0.25em] uppercase"
              style={{ color: "#7c6cf0" }}
            >
              Aevum
            </span>
            <span className="text-[11px] text-white/25">
              {formatDatePretty(date)}
            </span>
          </div>

          {/* ─── Ring (left) + Stats (right) ─── */}
          <div className="flex items-center gap-4 px-6 py-3">
            <div className="shrink-0">
              <StoryRing
                totals={totals}
                totalSecs={productiveSecs}
                size={160}
                strokeWidth={18}
              />
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <StatBox value={`${focusPct}%`} label="Focus" />
              <StatBox
                value={
                  longestFocus >= 60 ? formatDuration(longestFocus) : "--"
                }
                label="Deep Flow"
              />
              <StatBox
                value={String(summary.session_count)}
                label={summary.session_count === 1 ? "Session" : "Sessions"}
              />
              {topTrack && (
                <div className="mt-1">
                  <div className="text-[10px] text-white/20 uppercase tracking-wider mb-0.5">
                    Top Track
                  </div>
                  <div className="text-xs font-medium text-white/70 truncate">
                    {topTrack.name}
                  </div>
                  <div className="text-[10px] text-white/30">
                    {DAW_LABELS[topTrack.daw] || topTrack.daw}{" "}
                    <span className="text-white/15 mx-0.5">|</span>
                    {formatDuration(topTrack.total_secs)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── Flow Timeline ─── */}
          {summary.timeline.length > 0 && (
            <div className="px-6 py-3">
              <div className="text-[10px] text-white/20 uppercase tracking-wider mb-2">
                Session Flow
              </div>
              <FlowBar blocks={summary.timeline} />
            </div>
          )}

          {/* ─── Top Plugins ─── */}
          {summary.plugins.top_plugins.length > 0 && (
            <div className="px-6 py-3">
              <div className="text-[10px] text-white/20 uppercase tracking-wider mb-2">
                Top Plugins
              </div>
              <div className="flex flex-wrap gap-1.5">
                {summary.plugins.top_plugins.slice(0, 6).map((p) => (
                  <span
                    key={p.name}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-white/[0.06] text-white/45"
                    style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
                  >
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ─── Category Legend ─── */}
          <div className="px-6 pt-2 pb-4">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {totals.map((cat) => {
                const pct = Math.round(
                  (cat.total_secs / productiveSecs) * 100
                );
                return (
                  <div
                    key={cat.category}
                    className="flex items-center gap-1.5"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          CATEGORY_COLORS[cat.category] || "#4b5563",
                      }}
                    />
                    <span className="text-[11px] text-white/40">
                      {CATEGORY_LABELS[cat.category] || cat.category} {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-white/[0.04]">
            <span className="text-[9px] text-white/10 tracking-[0.15em] uppercase">
              Tracked with Aevum
            </span>
          </div>
        </div>

        {/* ─── Action Buttons (outside capture) ─── */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={handleDownload}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-colors disabled:opacity-40"
          >
            <Download size={13} />
            {exporting ? "Saving..." : "Save PNG"}
          </button>
          <button
            onClick={handleCopyImage}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-white/[0.06] hover:bg-white/10 text-white/50 hover:text-white/70 rounded-lg transition-colors border border-white/5"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy Image"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

const DAW_LABELS: Record<string, string> = {
  fl_studio: "FL Studio",
  ableton: "Ableton Live",
  logic: "Logic Pro",
  cubase: "Cubase",
  studio_one: "Studio One",
  reaper: "Reaper",
  bitwig: "Bitwig Studio",
  pro_tools: "Pro Tools",
};

function StoryRing({
  totals,
  totalSecs,
  size,
  strokeWidth,
}: {
  totals: { category: string; total_secs: number }[];
  totalSecs: number;
  size: number;
  strokeWidth: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size}>
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth={strokeWidth}
      />
      {totals.map((cat) => {
        const pct = cat.total_secs / totalSecs;
        const gap = totals.length > 1 ? 2 : 0;
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
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
      })}
      <text
        x={size / 2}
        y={size / 2 - 8}
        textAnchor="middle"
        fill="rgba(255,255,255,0.9)"
        fontWeight="600"
        fontSize={size >= 200 ? "32" : "24"}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {formatDuration(totalSecs)}
      </text>
      <text
        x={size / 2}
        y={size / 2 + 12}
        textAnchor="middle"
        fill="rgba(255,255,255,0.3)"
        fontSize={size >= 200 ? "13" : "10"}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        productive
      </text>
    </svg>
  );
}

function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.06]">
      <span className="text-[10px] text-white/30 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-sm font-semibold text-white/85">{value}</span>
    </div>
  );
}

interface TimelineBlock {
  category: string;
  start_ts: number;
  end_ts: number;
  duration_secs: number;
}

function FlowBar({ blocks }: { blocks: TimelineBlock[] }) {
  if (blocks.length === 0) return null;

  const totalStart = blocks[0].start_ts;
  const totalEnd = blocks[blocks.length - 1].end_ts;
  const totalSpan = Math.max(totalEnd - totalStart, 1);

  return (
    <div className="flex h-4 rounded-full overflow-hidden gap-[1px]" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
      {blocks
        .filter((b) => b.category !== "idle")
        .map((seg, i) => {
          const width = Math.max(
            ((seg.end_ts - seg.start_ts) / totalSpan) * 100,
            0.3
          );
          const color = CATEGORY_COLORS[seg.category] || "#4b5563";
          return (
            <div
              key={i}
              className="h-full rounded-sm"
              style={{
                width: `${width}%`,
                backgroundColor: color,
                opacity: seg.category === "break" ? 0.3 : 0.75,
              }}
            />
          );
        })}
    </div>
  );
}
