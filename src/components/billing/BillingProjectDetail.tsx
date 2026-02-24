import { useState, useEffect } from "react";
import { X, Copy, Trash2, Plus, Check } from "lucide-react";
import { useBillingDetailStore } from "../../stores/billingDetailStore";
import { useBillingStore } from "../../stores/billingStore";
import { useTracksStore } from "../../stores/tracksStore";
import { formatTimeAsHoursMinutes } from "../../lib/formatters";
import { assignTrackToBillingProject } from "../../lib/tauri";

export function BillingProjectDetail() {
  const { detail, isOpen, closeProject, refresh } = useBillingDetailStore();
  const deleteProject = useBillingStore((s) => s.deleteProject);
  const { tracks, fetchTracks, loading: tracksLoading } = useTracksStore();

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showAssignTrack, setShowAssignTrack] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRate, setEditRate] = useState("");

  // Fetch tracks when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchTracks();
    }
  }, [isOpen, fetchTracks]);

  if (!isOpen || !detail) return null;

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDelete = async () => {
    if (confirm("Delete this billing project? All tracks will be unassigned.")) {
      await deleteProject(detail.project.id);
      closeProject();
    }
  };

  const handleAssignTrack = async (trackId: number) => {
    await assignTrackToBillingProject(trackId, detail.project.id);
    await refresh();
    await fetchTracks();
    setShowAssignTrack(false);
  };

  const handleUnassignTrack = async (trackId: number) => {
    if (confirm("Unassign this track from the project?")) {
      await assignTrackToBillingProject(trackId, null);
      await refresh();
      await fetchTracks();
    }
  };

  const startEditing = () => {
    setEditName(detail.project.name);
    setEditRate(detail.project.hourly_rate.toString());
    setEditing(true);
  };

  const saveEdit = async () => {
    const rate = parseFloat(editRate);
    if (editName.trim() && !isNaN(rate) && rate >= 0) {
      const { updateProject } = useBillingStore.getState();
      await updateProject(detail.project.id, editName.trim(), rate);
      await refresh();
      setEditing(false);
    }
  };

  // Available tracks (not already assigned to this project)
  const availableTracks = tracks.filter(
    (t) => t.billing_project_id !== detail.project.id && !t.archived
  );

  // Copy all track lines formatted as "Track Name - H:MM"
  const trackLines = detail.tracks
    .map(
      (t) =>
        `${t.name} - ${formatTimeAsHoursMinutes(t.total_seconds)}`
    )
    .join("\n");

  const CopyButton = ({ onClick, fieldName }: { onClick: () => void; fieldName: string }) => {
    const isCopied = copiedField === fieldName;
    return (
      <button
        onClick={onClick}
        className="p-1.5 hover:bg-white/10 rounded transition-colors"
        title={isCopied ? "Copied!" : "Copy to clipboard"}
      >
        {isCopied ? (
          <Check size={14} className="text-green-400" />
        ) : (
          <Copy size={14} className="text-white/40" />
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex-1 flex items-center gap-3 min-w-0">
            {editing ? (
              <>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm bg-white/5 border border-white/10 rounded text-white/80 focus:outline-none focus:border-indigo-500/50"
                  autoFocus
                />
                <input
                  type="number"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  step="0.01"
                  min="0"
                  className="w-24 px-2 py-1 text-sm bg-white/5 border border-white/10 rounded text-white/80 focus:outline-none focus:border-indigo-500/50"
                />
                <button
                  onClick={saveEdit}
                  className="px-2 py-1 text-xs bg-indigo-500 hover:bg-indigo-600 rounded text-white transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded text-white/60 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-white/90 truncate">
                  {detail.project.name}
                </h2>
                <span className="text-xs text-white/40">
                  ${detail.project.hourly_rate.toFixed(2)}/hr
                </span>
                <button
                  onClick={startEditing}
                  className="px-2 py-1 text-xs bg-white/5 hover:bg-white/10 rounded text-white/60 hover:text-white/80 transition-colors"
                >
                  Edit
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              className="p-1.5 hover:bg-red-500/10 rounded transition-colors"
              title="Delete project"
            >
              <Trash2 size={14} className="text-red-400/60 hover:text-red-400" />
            </button>
            <button
              onClick={closeProject}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
            >
              <X size={16} className="text-white/40" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Tracks Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-white/60">
                Assigned Tracks
              </h3>
              <button
                onClick={() => setShowAssignTrack(!showAssignTrack)}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white/60 hover:text-white/80 transition-colors"
              >
                <Plus size={12} />
                Assign Track
              </button>
            </div>

            {showAssignTrack && (
              <div className="mb-3 p-2 bg-white/5 border border-white/10 rounded">
                {tracksLoading ? (
                  <div className="flex items-center justify-center py-3">
                    <div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
                  </div>
                ) : availableTracks.length > 0 ? (
                  <>
                    <div className="text-xs text-white/40 mb-2">
                      Select a track to assign:
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {availableTracks.map((track) => (
                        <button
                          key={track.id}
                          onClick={() => handleAssignTrack(track.id)}
                          className="w-full text-left px-2 py-1.5 text-xs hover:bg-white/10 rounded text-white/70 hover:text-white/90 transition-colors"
                        >
                          {track.name}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-white/40 italic py-2">
                    No available tracks. All tracks are either archived or already assigned to this project.
                  </div>
                )}
              </div>
            )}

            {detail.tracks.length === 0 ? (
              <div className="text-xs text-white/25 italic">
                No tracks assigned yet
              </div>
            ) : (
              <div className="space-y-1">
                {detail.tracks.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center justify-between px-3 py-2 bg-white/[0.02] hover:bg-white/[0.04] rounded group"
                  >
                    <span className="text-sm text-white/70">
                      {track.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40 font-mono">
                        {formatTimeAsHoursMinutes(track.total_seconds)}
                      </span>
                      <button
                        onClick={() => handleUnassignTrack(track.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 rounded transition-all text-xs text-red-400/60 hover:text-red-400"
                        title="Unassign"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary Section */}
          <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
            <h3 className="text-xs font-medium text-white/60 mb-3">Summary</h3>
            <div className="space-y-2">
              {/* Project Name */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Project Name:</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/80 font-mono">
                    {detail.project.name}
                  </span>
                  <CopyButton
                    onClick={() => copyToClipboard(detail.project.name, "name")}
                    fieldName="name"
                  />
                </div>
              </div>

              {/* Total Time */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Total Time:</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/80 font-mono">
                    {formatTimeAsHoursMinutes(detail.total_seconds)}
                  </span>
                  <CopyButton
                    onClick={() =>
                      copyToClipboard(
                        formatTimeAsHoursMinutes(detail.total_seconds),
                        "time"
                      )
                    }
                    fieldName="time"
                  />
                </div>
              </div>

              {/* Hourly Rate */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Hourly Rate:</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white/80 font-mono">
                    ${detail.project.hourly_rate.toFixed(2)}
                  </span>
                  <CopyButton
                    onClick={() =>
                      copyToClipboard(
                        detail.project.hourly_rate.toString(),
                        "rate"
                      )
                    }
                    fieldName="rate"
                  />
                </div>
              </div>

              {/* Total Value */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <span className="text-xs text-white/60 font-medium">
                  Total Value:
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-base text-indigo-400 font-mono font-semibold">
                    ${detail.total_value.toFixed(2)}
                  </span>
                  <CopyButton
                    onClick={() =>
                      copyToClipboard(detail.total_value.toFixed(2), "value")
                    }
                    fieldName="value"
                  />
                </div>
              </div>

              {/* Copy All Tracks */}
              {detail.tracks.length > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                  <span className="text-xs text-white/40">Track Lines:</span>
                  <CopyButton
                    onClick={() => copyToClipboard(trackLines, "tracks")}
                    fieldName="tracks"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
