use std::sync::{Arc, Mutex};

use rusqlite::Connection;
use tauri::State;

use crate::db::models::{Event, Project, Session};
use crate::db::queries::sessions::SessionStory;
use crate::db::queries::{events, projects, sessions};
use crate::error::AppError;
use crate::plugin_db::PluginDatabase;

#[tauri::command]
pub async fn get_active_session(
    conn: State<'_, Mutex<Connection>>,
) -> Result<Option<Session>, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    sessions::get_active_session(&conn)
}

#[tauri::command]
pub async fn get_sessions_for_date(
    date: String,
    conn: State<'_, Mutex<Connection>>,
) -> Result<Vec<Session>, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;

    // Parse date string "YYYY-MM-DD" to start/end of day timestamps
    let date = chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map_err(|e| AppError::Database(format!("Invalid date: {}", e)))?;

    let start = date
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc()
        .timestamp();
    let end = date
        .and_hms_opt(23, 59, 59)
        .unwrap()
        .and_utc()
        .timestamp();

    sessions::get_sessions_for_date(&conn, start, end)
}

#[tauri::command]
pub async fn get_recent_events(
    limit: Option<usize>,
    conn: State<'_, Mutex<Connection>>,
) -> Result<Vec<Event>, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    events::get_recent_events(&conn, limit.unwrap_or(100))
}

#[tauri::command]
pub async fn get_all_projects(
    conn: State<'_, Mutex<Connection>>,
) -> Result<Vec<Project>, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    projects::get_all_projects(&conn)
}

#[tauri::command]
pub async fn get_session_story(
    session_id: i64,
    conn: State<'_, Mutex<Connection>>,
    plugin_db: State<'_, Arc<PluginDatabase>>,
) -> Result<SessionStory, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    sessions::get_session_story(&conn, session_id, Some(&plugin_db))
}
