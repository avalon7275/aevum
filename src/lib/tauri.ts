import { invoke } from "@tauri-apps/api/core";
import type { Event, PollingStatus, Track, Session } from "../types/session";
import type {
  BillingProject,
  BillingProjectDetail,
} from "../types/billing";

export async function getPollingStatus(): Promise<PollingStatus> {
  return invoke("get_polling_status");
}

export async function pausePolling(): Promise<void> {
  return invoke("pause_polling");
}

export async function resumePolling(): Promise<void> {
  return invoke("resume_polling");
}

export async function getActiveSession(): Promise<Session | null> {
  return invoke("get_active_session");
}

export async function getSessionsForDate(date: string): Promise<Session[]> {
  return invoke("get_sessions_for_date", { date });
}

export async function getRecentEvents(limit?: number): Promise<Event[]> {
  return invoke("get_recent_events", { limit: limit ?? 100 });
}

export async function getAllTracks(): Promise<Track[]> {
  return invoke("get_all_tracks");
}

export async function archiveTrack(trackId: number): Promise<void> {
  return invoke("archive_track", { trackId });
}

export async function unarchiveTrack(trackId: number): Promise<void> {
  return invoke("unarchive_track", { trackId });
}

// Billing Projects
export async function getAllBillingProjects(): Promise<BillingProject[]> {
  return invoke("get_all_billing_projects");
}

export async function createBillingProject(
  name: string,
  hourlyRate: number
): Promise<number> {
  return invoke("create_billing_project", { name, hourlyRate });
}

export async function getBillingProjectDetail(
  projectId: number
): Promise<BillingProjectDetail | null> {
  return invoke("get_billing_project_detail", { projectId });
}

export async function updateBillingProject(
  id: number,
  name: string,
  hourlyRate: number
): Promise<void> {
  return invoke("update_billing_project", { id, name, hourlyRate });
}

export async function deleteBillingProject(id: number): Promise<void> {
  return invoke("delete_billing_project", { id });
}

export async function assignTrackToBillingProject(
  trackId: number,
  projectId: number | null
): Promise<void> {
  return invoke("assign_track_to_billing_project", { trackId, projectId });
}
