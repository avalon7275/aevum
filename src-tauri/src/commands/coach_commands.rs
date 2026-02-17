use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use crate::db::queries::coach::{self, CoachData};
use crate::error::AppError;

#[tauri::command]
pub async fn get_coach_data(
    week_start: String,
    conn: State<'_, Mutex<Connection>>,
) -> Result<CoachData, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;

    let start_date = chrono::NaiveDate::parse_from_str(&week_start, "%Y-%m-%d")
        .map_err(|e| AppError::Database(format!("Invalid date: {}", e)))?;

    let end_date = start_date + chrono::Duration::days(6);

    let week_start_str = start_date.format("%Y-%m-%d").to_string();
    let week_end_str = end_date.format("%Y-%m-%d").to_string();

    let start_ts = start_date
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc()
        .timestamp();
    let end_ts = end_date
        .and_hms_opt(23, 59, 59)
        .unwrap()
        .and_utc()
        .timestamp();

    coach::get_coach_data(&conn, start_ts, end_ts, &week_start_str, &week_end_str)
}
