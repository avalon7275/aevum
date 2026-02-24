import { useEffect, useState } from "react";
import { Search, Music, Archive, ArchiveRestore } from "lucide-react";
import { useTracksStore } from "../../stores/tracksStore";
import { useTrackDetailStore } from "../../stores/trackDetailStore";
import { formatDuration, formatDate } from "../../lib/formatters";
import { archiveTrack, unarchiveTrack } from "../../lib/tauri";

export function TracksPage() {
  const { tracks, loading, searchQuery, fetchTracks, setSearchQuery } =
    useTracksStore();
  const openTrack = useTrackDetailStore((s) => s.openTrack);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  const handleArchive = async (trackId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await archiveTrack(trackId);
    fetchTracks();
  };

  const handleUnarchive = async (trackId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await unarchiveTrack(trackId);
    fetchTracks();
  };

  const filtered = tracks
    .filter((t) => t.archived === showArchived)
    .filter((t) =>
      searchQuery
        ? t.name.toLowerCase().includes(searchQuery.toLowerCase())
        : true
    );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#111111]">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-white/90">Tracks</h1>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white/60 hover:text-white/80 transition-colors"
          >
            {showArchived ? "Active" : "Archived"}
          </button>
        </div>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25"
          />
          <input
            type="text"
            placeholder="Search tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-52 pl-8 pr-3 py-1.5 text-xs bg-white/5 border border-white/5 rounded-md text-white/80 placeholder:text-white/20 focus:outline-none focus:border-white/15"
          />
        </div>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && tracks.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-white/20">
            <Music size={32} className="mb-3 opacity-50" />
            <span className="text-sm">
              {searchQuery ? "No tracks match your search" : "No tracks yet"}
            </span>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((track) => (
              <div
                key={track.id}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors group"
              >
                <button
                  onClick={() => openTrack(track.id)}
                  className="flex-1 flex items-center gap-4 text-left min-w-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/80 group-hover:text-indigo-400 transition-colors truncate">
                        {track.name}
                      </span>
                      <span className="text-[10px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded shrink-0">
                        {track.daw}
                      </span>
                    </div>
                    <span className="text-xs text-white/25">
                      Last opened {formatDate(track.last_seen)}
                    </span>
                  </div>
                  <span className="text-sm text-white/50 font-mono shrink-0">
                    {formatDuration(track.total_seconds)}
                  </span>
                </button>
                <button
                  onClick={(e) =>
                    showArchived
                      ? handleUnarchive(track.id, e)
                      : handleArchive(track.id, e)
                  }
                  className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded transition-all"
                  title={showArchived ? "Unarchive" : "Archive"}
                >
                  {showArchived ? (
                    <ArchiveRestore size={14} className="text-white/40" />
                  ) : (
                    <Archive size={14} className="text-white/40" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
