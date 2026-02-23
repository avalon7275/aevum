import { useState } from "react";
import { Settings } from "lucide-react";
import { useDashboardStore, type GoalStreak } from "../../stores/dashboardStore";
import { formatDuration, todayStr } from "../../lib/formatters";

export function GoalProgress() {
  const { goalStreak, dailyGoalMinutes, fetchGoalStreak, saveDailyGoal } =
    useDashboardStore();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(dailyGoalMinutes / 60));

  // Fetch on first render if not loaded
  if (!goalStreak) {
    fetchGoalStreak();
    return null;
  }

  const progressPct = Math.min(
    (goalStreak.today_secs / goalStreak.goal_secs) * 100,
    100
  );

  const todayHours = (goalStreak.today_secs / 3600).toFixed(1);
  const goalHours = (goalStreak.goal_secs / 3600).toFixed(1);

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wider text-white/30">
          Daily Goal
        </h3>
        <button
          onClick={() => {
            setEditing(!editing);
            setEditValue(String(dailyGoalMinutes / 60));
          }}
          className="p-1 rounded hover:bg-white/10 text-white/25 hover:text-white/50 transition-colors"
        >
          <Settings size={12} />
        </button>
      </div>

      {editing ? (
        <GoalEditor
          value={editValue}
          onChange={setEditValue}
          onSave={() => {
            const hours = parseFloat(editValue);
            if (hours > 0 && hours <= 24) {
              saveDailyGoal(Math.round(hours * 60));
            }
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="flex items-center gap-4">
          <ProgressRing pct={progressPct} todayHours={todayHours} goalHours={goalHours} />
          <div className="flex-1 min-w-0">
            {goalStreak.streak_days > 0 && (
              <div className="text-sm text-white/70 mb-2">
                {goalStreak.streak_days} day streak
              </div>
            )}
            <StreakDots streak={goalStreak} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProgressRing({
  pct,
  todayHours,
  goalHours,
}: {
  pct: number;
  todayHours: string;
  goalHours: string;
}) {
  const size = 80;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashLength = (pct / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0">
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={pct >= 100 ? "#10b981" : "#6366f1"}
        strokeWidth={strokeWidth}
        strokeDasharray={`${dashLength} ${circumference - dashLength}`}
        strokeDashoffset={circumference / 4}
        strokeLinecap="round"
        className="transition-all duration-700"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {/* Center text */}
      <text
        x={size / 2}
        y={size / 2 - 4}
        textAnchor="middle"
        className="fill-white/80"
        fontSize="14"
        fontWeight="600"
      >
        {todayHours}h
      </text>
      <text
        x={size / 2}
        y={size / 2 + 10}
        textAnchor="middle"
        className="fill-white/30"
        fontSize="9"
      >
        / {goalHours}h
      </text>
    </svg>
  );
}

function StreakDots({ streak }: { streak: GoalStreak }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {streak.last_14_days.map((day) => {
        const isToday = day.date === todayStr();
        return (
          <div
            key={day.date}
            title={`${day.date}: ${formatDuration(day.total_secs)}`}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              isToday ? "ring-1 ring-indigo-400/50" : ""
            }`}
            style={{
              backgroundColor: day.goal_met
                ? "#10b981"
                : day.total_secs > 0
                  ? "rgba(99,102,241,0.3)"
                  : "rgba(255,255,255,0.05)",
            }}
          />
        );
      })}
    </div>
  );
}

function GoalEditor({
  value,
  onChange,
  onSave,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/40">Daily goal:</span>
      <input
        type="number"
        min="0.5"
        max="24"
        step="0.5"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
        className="w-16 px-2 py-1 text-sm bg-white/5 border border-white/10 rounded text-white/80 outline-none focus:border-indigo-400/50"
        autoFocus
      />
      <span className="text-xs text-white/40">hours</span>
      <button
        onClick={onSave}
        className="px-2 py-1 text-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded transition-colors"
      >
        Save
      </button>
      <button
        onClick={onCancel}
        className="px-2 py-1 text-xs text-white/30 hover:text-white/50 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
