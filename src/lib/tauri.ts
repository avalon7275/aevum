import { invoke } from "@tauri-apps/api/core";
import type { Event, PollingStatus, Project, Session } from "../types/session";

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

export async function getAllProjects(): Promise<Project[]> {
  return invoke("get_all_projects");
}
