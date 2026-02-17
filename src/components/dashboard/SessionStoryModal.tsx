import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { toPng } from "html-to-image";
import { X, Download, Share2 } from "lucide-react";
import {
  formatDuration,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from "../../lib/formatters";

interface PhaseSegment {
  category: string;
  start_ts: number;
  end_ts: number;
  duration_secs: number;
}

interface StoryPlugin {
  name: string;
  category: string;
  total_secs: number;
}

interface SessionStory {
  session_id: number;
  project_name: string;
  daw: string;
  started_at: number;
  ended_at: number;
  duration_secs: number;
  phases: PhaseSegment[];
  category_totals: [string, number][];
  top_plugins: StoryPlugin[];
  focus_pct: number;
  longest_focus_secs: number;
}

interface Props {
  sessionId: number;
  onClose: () => void;
}

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

function formatClock(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateLong(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SessionStoryModal({ sessionId, onClose }: Props) {
  const [story, setStory] = useState<SessionStory | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    invoke<SessionStory>("get_session_story", { sessionId })
      .then((s) => setStory(s))
      .catch((e) => console.error("Failed to fetch session story:", e))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleDownloadPng = async () => {
    if (!cardRef.current || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: "#0a0a0a",
        pixelRatio: 2,
      });
      const link = document.createElement("a");
      link.download = `session-${story?.project_name || "story"}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Failed to export PNG:", e);
    } finally {
      setExporting(false);
    }
  };

  const shareText = story
    ? `Just wrapped a ${formatDuration(story.duration_secs)} session on "${story.project_name}" with ${Math.round(story.focus_pct)}% focus. Tracked with Aevum.`
    : "";

  const handleShareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    open(url);
  };

  const handleShareLinkedIn = () => {
    const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(shareText)}`;
    open(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[380px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          </div>
        ) : story ? (
          <>
            {/* The Card (capturable for PNG) */}
            <div
              ref={cardRef}
              className="rounded-xl overflow-hidden border border-white/10"
              style={{ backgroundColor: "#0d0d0d" }}
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-indigo-400/80">
                    Aevum
                  </span>
                  <span className="text-[10px] text-white/30">
                    {formatDateLong(story.started_at)}
                  </span>
                </div>

                {/* Project + DAW + Duration */}
                <h2 className="text-lg font-semibold text-white/90 mb-1 leading-tight">
                  {story.project_name}
                </h2>
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <span>{DAW_LABELS[story.daw] || story.daw}</span>
                  <span className="text-white/15">|</span>
                  <span>{formatClock(story.started_at)} - {formatClock(story.ended_at)}</span>
                  <span className="text-white/15">|</span>
                  <span className="text-white/60 font-medium">
                    {formatDuration(story.duration_secs)}
                  </span>
                </div>
              </div>

              {/* Flow Bar */}
              {story.phases.length > 0 && (
                <div className="px-5 py-3">
                  <FlowBar phases={story.phases} />
                </div>
              )}

              {/* Stats Row */}
              <div className="px-5 py-3 grid grid-cols-3 gap-3">
                <StoryStatBox
                  value={`${Math.round(story.focus_pct)}%`}
                  label="Focus"
                />
                <StoryStatBox
                  value={story.longest_focus_secs >= 60 ? formatDuration(story.longest_focus_secs) : "--"}
                  label="Deep Flow"
                />
                <StoryStatBox
                  value={String(story.top_plugins.length)}
                  label="Plugins"
                />
              </div>

              {/* Category Breakdown */}
              {story.category_totals.length > 0 && (
                <div className="px-5 py-3">
                  <CategoryBars totals={story.category_totals} totalSecs={story.duration_secs} />
                </div>
              )}

              {/* Top Plugins */}
              {story.top_plugins.length > 0 && (
                <div className="px-5 pt-2 pb-4">
                  <h4 className="text-[10px] uppercase tracking-wider text-white/25 mb-2">
                    Top Plugins
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {story.top_plugins.slice(0, 6).map((p) => (
                      <span
                        key={p.name}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 border border-white/5"
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer watermark */}
              <div className="px-5 py-3 border-t border-white/5">
                <span className="text-[9px] text-white/15 tracking-wider">
                  Tracked with Aevum
                </span>
              </div>
            </div>

            {/* Share Buttons (outside capturable area) */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                onClick={handleDownloadPng}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/[0.06] hover:bg-white/10 text-white/50 hover:text-white/70 rounded-lg transition-colors border border-white/5 disabled:opacity-40"
              >
                <Download size={12} />
                {exporting ? "Saving..." : "Save PNG"}
              </button>
              <button
                onClick={handleShareTwitter}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/[0.06] hover:bg-white/10 text-white/50 hover:text-white/70 rounded-lg transition-colors border border-white/5"
              >
                <Share2 size={12} />
                Twitter
              </button>
              <button
                onClick={handleShareLinkedIn}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/[0.06] hover:bg-white/10 text-white/50 hover:text-white/70 rounded-lg transition-colors border border-white/5"
              >
                <Share2 size={12} />
                LinkedIn
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-64 text-white/30 text-sm">
            Failed to load session story
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function FlowBar({ phases }: { phases: PhaseSegment[] }) {
  if (phases.length === 0) return null;

  const totalStart = phases[0].start_ts;
  const totalEnd = phases[phases.length - 1].end_ts;
  const totalSpan = Math.max(totalEnd - totalStart, 1);

  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-wider text-white/25 mb-2">
        Session Flow
      </h4>
      <div className="flex h-3 rounded-full overflow-hidden gap-px bg-white/[0.03]">
        {phases.map((seg, i) => {
          const width = Math.max(((seg.end_ts - seg.start_ts) / totalSpan) * 100, 0.5);
          const color = CATEGORY_COLORS[seg.category] || "#4b5563";
          return (
            <div
              key={i}
              className="h-full rounded-sm"
              style={{
                width: `${width}%`,
                backgroundColor: color,
                opacity: 0.8,
              }}
              title={`${CATEGORY_LABELS[seg.category] || seg.category} (${formatDuration(seg.duration_secs)})`}
            />
          );
        })}
      </div>
    </div>
  );
}

function StoryStatBox({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-white/[0.04] rounded-lg px-3 py-2.5 text-center border border-white/5">
      <div className="text-base font-semibold text-white/80">{value}</div>
      <div className="text-[10px] text-white/30 uppercase tracking-wider mt-0.5">
        {label}
      </div>
    </div>
  );
}

function CategoryBars({
  totals,
  totalSecs,
}: {
  totals: [string, number][];
  totalSecs: number;
}) {
  // Filter out break/idle for the visual
  const filtered = totals.filter(
    ([cat]) => cat !== "break" && cat !== "idle"
  );
  if (filtered.length === 0) return null;

  const maxSecs = Math.max(...filtered.map(([, s]) => s), 1);

  return (
    <div>
      <h4 className="text-[10px] uppercase tracking-wider text-white/25 mb-2">
        Activity Breakdown
      </h4>
      <div className="space-y-1.5">
        {filtered.slice(0, 4).map(([cat, secs]) => {
          const pct = (secs / maxSecs) * 100;
          const color = CATEGORY_COLORS[cat] || "#4b5563";
          const label = CATEGORY_LABELS[cat] || cat;
          const timePct = totalSecs > 0 ? Math.round((secs / totalSecs) * 100) : 0;
          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[11px] text-white/50">{label}</span>
                <span className="text-[10px] text-white/30">
                  {formatDuration(secs)} ({timePct}%)
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.7 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
