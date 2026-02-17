export interface Project {
  id: number;
  name: string;
  daw: string;
  first_seen: number;
  last_seen: number;
  total_seconds: number;
  notes: string;
  archived: boolean;
}

export interface Session {
  id: number;
  project_id: number;
  started_at: number;
  ended_at: number | null;
  duration_secs: number;
  is_active: boolean;
}

export interface Event {
  id: number;
  session_id: number;
  timestamp: number;
  window_title: string;
  process_name: string;
  category: string;
  plugin_id: number | null;
  raw_title: string | null;
}

export interface PollingStatus {
  is_running: boolean;
  is_tracking: boolean;
  current_daw: string | null;
  current_project: string | null;
  session_duration_secs: number;
  current_category: string;
}

export interface PollingTick {
  status: PollingStatus;
  window_title: string;
  process_name: string;
  timestamp: number;
  detected_plugin: string | null;
  detected_category: string | null;
}

export type ActivityCategory =
  | "composing"
  | "arranging"
  | "mixing"
  | "sound_design"
  | "mastering"
  | "sound_selection"
  | "break"
  | "idle"
  | "unknown";
