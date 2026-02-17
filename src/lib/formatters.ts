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
