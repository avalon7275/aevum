use std::sync::Mutex;

use rusqlite::Connection;
use tauri::State;

use crate::db::models::BillingProject;
use crate::db::queries::billing::{self, BillingProjectDetail};
use crate::db::queries::tracks;
use crate::error::AppError;

#[tauri::command]
pub async fn create_billing_project(
    name: String,
    hourly_rate: f64,
    conn: State<'_, Mutex<Connection>>,
) -> Result<i64, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    let now = chrono::Utc::now().timestamp();
    billing::create_billing_project(&conn, &name, hourly_rate, now)
}

#[tauri::command]
pub async fn get_all_billing_projects(
    conn: State<'_, Mutex<Connection>>,
) -> Result<Vec<BillingProject>, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    billing::get_all_billing_projects(&conn)
}

#[tauri::command]
pub async fn get_billing_project_detail(
    project_id: i64,
    conn: State<'_, Mutex<Connection>>,
) -> Result<Option<BillingProjectDetail>, AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    billing::get_billing_project_detail(&conn, project_id)
}

#[tauri::command]
pub async fn update_billing_project(
    id: i64,
    name: String,
    hourly_rate: f64,
    conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    billing::update_billing_project(&conn, id, &name, hourly_rate)
}

#[tauri::command]
pub async fn delete_billing_project(
    id: i64,
    conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    billing::delete_billing_project(&conn, id)
}

#[tauri::command]
pub async fn assign_track_to_billing_project(
    track_id: i64,
    project_id: Option<i64>,
    conn: State<'_, Mutex<Connection>>,
) -> Result<(), AppError> {
    let conn = conn.lock().map_err(|e| AppError::Database(e.to_string()))?;
    tracks::assign_track_to_project(&conn, track_id, project_id)
}
