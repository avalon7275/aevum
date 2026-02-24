import { X, Clock, Layers, Calendar } from "lucide-react";
import {
  useTrackDetailStore,
  type TrackDetail,
} from "../../stores/trackDetailStore";
import {
  formatDuration,
  formatDate,
  formatTimestamp,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from "../../lib/formatters";

export function TrackDetailView() {
  const { selectedTrackId, trackDetail, loading, closeTrack } =
    useTrackDetailStore();

  if (!selectedTrackId) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={closeTrack}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[380px] bg-[#0e0e0e] border-l border-white/5 z-50 flex flex-col overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#111111]">
          <div className="flex-1 min-w-0">
            {trackDetail ? (
              <>
                <h2 className="text-sm font-semibold text-white/90 truncate">
                  {trackDetail.name}
                </h2>
                <span className="text-xs text-white/30">
                  {trackDetail.daw}
                </span>
              </>
            ) : (
              <span className="text-sm text-white/40">Loading...</span>
            )}
          </div>
          <button
            onClick={closeTrack}
            className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors ml-2"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
            </div>
          )}

          {trackDetail && !loading && (
            <>
              <TrackStats detail={trackDetail} />
              <TrackCategories detail={trackDetail} />
              <RecentSessions detail={trackDetail} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function TrackStats({ detail }: { detail: TrackDetail }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-3">
        <div className="flex items-center gap-2 text-white/40 mb-1">
          <Clock size={14} />
          <span className="text-xs uppercase tracking-wider">Total Time</span>
        </div>
        <div className="text-base font-semibold text-white/90">
          {formatDuration(detail.total_seconds)}
        </div>
      </div>
      <div className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-3">
        <div className="flex items-center gap-2 text-white/40 mb-1">
          <Layers size={14} />
          <span className="text-xs uppercase tracking-wider">Sessions</span>
        </div>
        <div className="text-base font-semibold text-white/90">
          {detail.session_count}
        </div>
      </div>
      <div className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-3">
        <div className="flex items-center gap-2 text-white/40 mb-1">
          <Calendar size={14} />
          <span className="text-xs uppercase tracking-wider">First Seen</span>
        </div>
        <div className="text-sm font-medium text-white/70">
          {formatDate(detail.first_seen)}
        </div>
      </div>
      <div className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-3">
        <div className="flex items-center gap-2 text-white/40 mb-1">
          <Calendar size={14} />
          <span className="text-xs uppercase tracking-wider">Last Seen</span>
        </div>
        <div className="text-sm font-medium text-white/70">
          {formatDate(detail.last_seen)}
        </div>
      </div>
    </div>
  );
}

function TrackCategories({ detail }: { detail: TrackDetail }) {
  const totals = detail.category_totals.filter(
    (c) => c.category !== "idle" && c.category !== "break"
  );
  const totalSecs = totals.reduce((sum, c) => sum + c.total_secs, 0);

  if (totalSecs === 0) return null;

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
      <h3 className="text-xs uppercase tracking-wider text-white/30 mb-3">
        Activity Breakdown
      </h3>
      <div className="flex flex-col gap-1.5">
        {totals.map((cat) => {
          const pct = Math.round((cat.total_secs / totalSecs) * 100);
          return (
            <div key={cat.category} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{
                  backgroundColor:
                    CATEGORY_COLORS[cat.category] || "#4b5563",
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

function RecentSessions({ detail }: { detail: TrackDetail }) {
  if (detail.recent_sessions.length === 0) return null;

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
      <h3 className="text-xs uppercase tracking-wider text-white/30 mb-3">
        Recent Sessions
      </h3>
      <div className="space-y-2">
        {detail.recent_sessions.map((session) => (
          <div
            key={session.id}
            className="flex items-center justify-between text-sm"
          >
            <div className="text-white/50">
              {formatDate(session.started_at)}
              <span className="text-white/25 ml-1.5">
                {formatTimestamp(session.started_at)}
              </span>
            </div>
            <span className="text-white/60 font-mono text-xs">
              {formatDuration(session.duration_secs)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
