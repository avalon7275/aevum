import { Clock, Layers, FolderOpen } from "lucide-react";
import { formatDuration } from "../../lib/formatters";
import type { DaySummary } from "../../stores/dashboardStore";

interface Props {
  summary: DaySummary;
  onNavigate?: (view: string) => void;
}

export function DailySummaryPanel({ summary, onNavigate }: Props) {
  const topProject = summary.projects[0];

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
        value={String(summary.session_count)}
        onClick={onNavigate ? () => onNavigate("projects") : undefined}
      />
      <StatCard
        icon={<FolderOpen size={16} />}
        label="Top Project"
        value={topProject ? topProject.name : "None"}
        onClick={onNavigate ? () => onNavigate("projects") : undefined}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`bg-white/[0.03] border border-white/5 rounded-lg px-3 py-3${
        onClick ? " cursor-pointer hover:bg-white/[0.05] transition-colors" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 text-white/40 mb-1">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-lg font-semibold truncate ${onClick ? "text-white/90 group-hover:text-indigo-400" : "text-white/90"}`}>
        {value}
      </div>
    </div>
  );
}
