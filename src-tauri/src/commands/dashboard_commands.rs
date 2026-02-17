use std::sync::{Arc, Mutex};

use rusqlite::Connection;
use tauri::{Manager, State};

use crate::config::settings::AppSettings;
use crate::db::queries::dashboard::{
    self, DaySummary, GoalStreak, HeatmapDay, ProjectDetail, WeekComparison, WeekSummary,
};
use crate::error::AppError;
use crate::plugin_db::PluginDatabase;

use chrono::Datelike;

#[tauri::command]
pub async fn get_day_summary(
    date: String,
    conn: State<'_, Mutex<Connection>>,
    plugin_db: State<'_, Arc<PluginDatabase>>,
) -> Result<DaySummary, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;

    let date = chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d")
        .map_err(|e| AppError::Database(format!("Invalid date: {}", e)))?;

    let start = date.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp();
    let end = date.and_hms_opt(23, 59, 59).unwrap().and_utc().timestamp();

    dashboard::get_day_summary(&conn, start, end, Some(&plugin_db))
}

#[tauri::command]
pub async fn get_week_summary(
    week_start: String,
    conn: State<'_, Mutex<Connection>>,
) -> Result<WeekSummary, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;

    let start_date = chrono::NaiveDate::parse_from_str(&week_start, "%Y-%m-%d")
        .map_err(|e| AppError::Database(format!("Invalid date: {}", e)))?;

    let end_date = start_date + chrono::Duration::days(6);

    let start = start_date.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp();
    let end = end_date.and_hms_opt(23, 59, 59).unwrap().and_utc().timestamp();

    dashboard::get_week_summary(&conn, start, end)
}

#[tauri::command]
pub async fn get_year_heatmap(
    conn: State<'_, Mutex<Connection>>,
) -> Result<Vec<HeatmapDay>, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;

    // Go back ~52 weeks from today (start on a Monday)
    let today = chrono::Local::now().date_naive();
    let days_since_monday = today.weekday().num_days_from_monday();
    let this_monday = today - chrono::Duration::days(days_since_monday as i64);
    let start_date = this_monday - chrono::Duration::weeks(51);

    let start = start_date.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp();
    let end = today.and_hms_opt(23, 59, 59).unwrap().and_utc().timestamp();

    dashboard::get_year_heatmap(&conn, start, end)
}

#[tauri::command]
pub async fn get_project_detail(
    project_id: i64,
    conn: State<'_, Mutex<Connection>>,
) -> Result<ProjectDetail, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    dashboard::get_project_detail(&conn, project_id)
}

#[tauri::command]
pub async fn get_week_comparison(
    week_start: String,
    conn: State<'_, Mutex<Connection>>,
) -> Result<WeekComparison, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;

    let start_date = chrono::NaiveDate::parse_from_str(&week_start, "%Y-%m-%d")
        .map_err(|e| AppError::Database(format!("Invalid date: {}", e)))?;

    let end_date = start_date + chrono::Duration::days(6);
    let last_start_date = start_date - chrono::Duration::days(7);
    let last_end_date = start_date - chrono::Duration::days(1);

    let this_start = start_date.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp();
    let this_end = end_date.and_hms_opt(23, 59, 59).unwrap().and_utc().timestamp();
    let last_start = last_start_date.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp();
    let last_end = last_end_date.and_hms_opt(23, 59, 59).unwrap().and_utc().timestamp();

    dashboard::get_week_comparison(&conn, this_start, this_end, last_start, last_end)
}

#[tauri::command]
pub async fn get_goal_streak(
    daily_goal_minutes: u64,
    conn: State<'_, Mutex<Connection>>,
) -> Result<GoalStreak, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    let today = chrono::Local::now().date_naive();
    let goal_secs = (daily_goal_minutes * 60) as i64;
    dashboard::get_goal_streak(&conn, goal_secs, today)
}

#[tauri::command]
pub async fn save_goal_settings(
    daily_goal_minutes: u64,
    settings: State<'_, Mutex<AppSettings>>,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    let mut settings = settings.lock().map_err(|e| AppError::Database(e.to_string()))?;
    settings.goals.daily_goal_minutes = daily_goal_minutes;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Database(e.to_string()))?;
    settings.save(&app_data_dir)
}
