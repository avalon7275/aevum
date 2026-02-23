import { useEffect, useState } from "react";
import { useCoachStore } from "../../stores/coachStore";
import { toDateStr } from "../../lib/formatters";
import {
  Brain,
  RefreshCw,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Lock,
} from "lucide-react";

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(12, 0, 0, 0);
  return d;
}

function formatDateRange(weekStart: string): string {
  const start = new Date(weekStart + "T12:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} \u2013 ${end.toLocaleDateString(undefined, opts)}`;
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

const GRADE_CONFIG = {
  light: { label: "Light", color: "text-blue-300", bg: "bg-blue-500/15" },
  healthy: { label: "Healthy", color: "text-green-300", bg: "bg-green-500/15" },
  heavy: { label: "Heavy", color: "text-amber-300", bg: "bg-amber-500/15" },
  overwork: { label: "Overwork", color: "text-red-300", bg: "bg-red-500/15" },
} as const;

export function CoachPage() {
  const { analysis, weekStart, loading, error, lastGenerated, alreadyGenerated, loadCachedWeek, generate } =
    useCoachStore();

  const [selectedWeek, setSelectedWeek] = useState(() => {
    const lastMonday = getMonday(new Date());
    lastMonday.setDate(lastMonday.getDate() - 7);
    return toDateStr(lastMonday);
  });

  // Load cached report whenever the selected week changes
  useEffect(() => {
    loadCachedWeek(selectedWeek);
  }, [selectedWeek, loadCachedWeek]);

  const handleGenerate = () => {
    generate(selectedWeek);
  };

  const navigateWeek = (dir: -1 | 1) => {
    const d = new Date(selectedWeek + "T12:00:00");
    d.setDate(d.getDate() + dir * 7);
    const lastMonday = getMonday(new Date());
    lastMonday.setDate(lastMonday.getDate() - 7);
    if (d > lastMonday) return;
    setSelectedWeek(toDateStr(d));
  };

  const isCurrentAnalysis = weekStart === selectedWeek;
  const grade = analysis?.hours_grade
    ? GRADE_CONFIG[analysis.hours_grade as keyof typeof GRADE_CONFIG] || GRADE_CONFIG.healthy
    : null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#111111]">
        <div className="flex items-center gap-3">
          <Brain size={16} className="text-indigo-400/60" />
          <span className="text-sm font-medium text-white/70">Production Coach</span>
        </div>
        {loading && (
          <div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Week Selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-white/60 font-medium min-w-[160px] text-center">
              {formatDateRange(selectedWeek)}
            </span>
            <button
              onClick={() => navigateWeek(1)}
              className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {alreadyGenerated ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/20">
              <Lock size={10} />
              Generated
            </div>
          ) : (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              {loading ? "Analyzing..." : "Generate"}
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {/* Analysis Content */}
        {isCurrentAnalysis && analysis ? (
          <>
            {/* Summary + Grade */}
            <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider">
                  Weekly Summary
                </h3>
                {grade && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${grade.bg} ${grade.color}`}
                  >
                    {grade.label}
                  </span>
                )}
              </div>
              <p className="text-sm text-white/70 leading-relaxed">{analysis.summary}</p>
              {lastGenerated && (
                <p className="text-[10px] text-white/20 mt-3">
                  Generated {formatRelative(lastGenerated)}
                </p>
              )}
            </div>

            {/* Highlights */}
            {analysis.highlights.length > 0 && (
              <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp size={14} className="text-white/30" />
                  <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider">
                    Highlights
                  </h3>
                </div>
                <ul className="space-y-2">
                  {analysis.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/60 mt-1.5 shrink-0" />
                      <span className="text-sm text-white/60 leading-relaxed">{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Concerns */}
            {analysis.concerns.length > 0 && (
              <div className="bg-amber-500/[0.05] border border-amber-500/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={14} className="text-amber-400/60" />
                  <h3 className="text-xs font-medium text-amber-300/60 uppercase tracking-wider">
                    Heads Up
                  </h3>
                </div>
                <ul className="space-y-2">
                  {analysis.concerns.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60 mt-1.5 shrink-0" />
                      <span className="text-sm text-amber-200/60 leading-relaxed">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tip */}
            {analysis.tip && (
              <div className="bg-indigo-500/[0.05] border border-indigo-500/10 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb size={14} className="text-indigo-400/60" />
                  <h3 className="text-xs font-medium text-indigo-300/60 uppercase tracking-wider">
                    Tip for Next Week
                  </h3>
                </div>
                <p className="text-sm text-indigo-200/60 leading-relaxed">{analysis.tip}</p>
              </div>
            )}
          </>
        ) : !loading ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center mb-5">
              <Brain size={24} className="text-indigo-400/40" />
            </div>
            <h2 className="text-base font-medium text-white/60 mb-2">
              No analysis for this week
            </h2>
            <p className="text-xs text-white/30 mb-5 max-w-[260px] text-center leading-relaxed">
              Generate an AI analysis of your production sessions to get personalized coaching insights.
            </p>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-colors"
            >
              <Brain size={14} />
              Generate Analysis
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
