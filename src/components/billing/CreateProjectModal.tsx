import { useState } from "react";
import { X } from "lucide-react";
import { useBillingStore } from "../../stores/billingStore";

interface CreateProjectModalProps {
  onClose: () => void;
}

export function CreateProjectModal({ onClose }: CreateProjectModalProps) {
  const createProject = useBillingStore((s) => s.createProject);
  const [name, setName] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    const rate = parseFloat(hourlyRate);
    if (isNaN(rate) || rate < 0) {
      setError("Please enter a valid hourly rate");
      return;
    }

    setSubmitting(true);
    try {
      await createProject(name.trim(), rate);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-white/10 rounded-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white/90">
            Create Billing Project
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X size={16} className="text-white/40" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-white/60 mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Client ABC Music Production"
              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white/80 placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-white/60 mb-1.5">
              Hourly Rate ($)
            </label>
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="e.g., 75.00"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded text-white/80 placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white/60 hover:text-white/80 transition-colors"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-3 py-2 text-xs bg-indigo-500 hover:bg-indigo-600 border border-indigo-500 rounded text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
