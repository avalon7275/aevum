/** Format a Date as YYYY-MM-DD using local timezone (never UTC). */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today's date as YYYY-MM-DD in local timezone. */
export function todayStr(): string {
  return toDateStr(new Date());
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/** Format time as hours:minutes (e.g., "7:30" for 7 hours and 30 minutes). */
export function formatTimeAsHoursMinutes(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

export function formatTimestamp(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDate(unixTimestamp: number): string {
  const date = new Date(unixTimestamp * 1000);
  return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

export const CATEGORY_COLORS: Record<string, string> = {
  composing: "#6366f1",     // indigo
  arranging: "#6366f1",     // indigo (legacy, maps to composing)
  mixing: "#f59e0b",        // amber
  sound_design: "#10b981",  // emerald
  mastering: "#ef4444",     // red
  sound_selection: "#06b6d4", // cyan
  break: "#64748b",         // slate
  idle: "#374151",          // gray
  unknown: "#4b5563",       // gray
};

export const CATEGORY_LABELS: Record<string, string> = {
  composing: "Composing",
  arranging: "Composing",
  mixing: "Mixing",
  sound_design: "Sound Design",
  mastering: "Mastering",
  sound_selection: "Sound Selection",
  break: "Break",
  idle: "Idle",
  unknown: "Unknown",
};
