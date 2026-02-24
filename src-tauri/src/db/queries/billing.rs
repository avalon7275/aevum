use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db::models::BillingProject;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillingTrackInfo {
    pub id: i64,
    pub name: String,
    pub total_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BillingProjectDetail {
    pub project: BillingProject,
    pub tracks: Vec<BillingTrackInfo>,
    pub total_seconds: i64,
    pub total_value: f64,
}

/// Create a new billing project. Returns the project ID.
pub fn create_billing_project(
    conn: &Connection,
    name: &str,
    hourly_rate: f64,
    now: i64,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO billing_projects (name, hourly_rate, created_at, archived)
         VALUES (?1, ?2, ?3, 0)",
        rusqlite::params![name, hourly_rate, now],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Get all non-archived billing projects.
pub fn get_all_billing_projects(conn: &Connection) -> Result<Vec<BillingProject>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, hourly_rate, created_at, archived
         FROM billing_projects
         WHERE archived = 0
         ORDER BY created_at DESC",
    )?;

    let projects = stmt
        .query_map([], |row| {
            Ok(BillingProject {
                id: row.get(0)?,
                name: row.get(1)?,
                hourly_rate: row.get(2)?,
                created_at: row.get(3)?,
                archived: row.get::<_, i64>(4)? != 0,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(projects)
}

/// Get a billing project by ID.
pub fn get_billing_project(conn: &Connection, id: i64) -> Result<Option<BillingProject>, AppError> {
    let result = conn.query_row(
        "SELECT id, name, hourly_rate, created_at, archived
         FROM billing_projects WHERE id = ?1",
        [id],
        |row| {
            Ok(BillingProject {
                id: row.get(0)?,
                name: row.get(1)?,
                hourly_rate: row.get(2)?,
                created_at: row.get(3)?,
                archived: row.get::<_, i64>(4)? != 0,
            })
        },
    );

    match result {
        Ok(project) => Ok(Some(project)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Update a billing project's name and hourly rate.
pub fn update_billing_project(
    conn: &Connection,
    id: i64,
    name: &str,
    hourly_rate: f64,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE billing_projects SET name = ?1, hourly_rate = ?2 WHERE id = ?3",
        rusqlite::params![name, hourly_rate, id],
    )?;
    Ok(())
}

/// Delete a billing project. This sets all associated tracks' billing_project_id to NULL.
pub fn delete_billing_project(conn: &Connection, id: i64) -> Result<(), AppError> {
    // First, unassign all tracks from this project
    conn.execute(
        "UPDATE tracks SET billing_project_id = NULL WHERE billing_project_id = ?1",
        [id],
    )?;

    // Then delete the project
    conn.execute(
        "DELETE FROM billing_projects WHERE id = ?1",
        [id],
    )?;

    Ok(())
}

/// Archive a billing project.
pub fn archive_billing_project(conn: &Connection, id: i64) -> Result<(), AppError> {
    conn.execute(
        "UPDATE billing_projects SET archived = 1 WHERE id = ?1",
        [id],
    )?;
    Ok(())
}

/// Get detailed information about a billing project, including all tracks and calculations.
pub fn get_billing_project_detail(
    conn: &Connection,
    project_id: i64,
) -> Result<Option<BillingProjectDetail>, AppError> {
    // Get the project
    let project = match get_billing_project(conn, project_id)? {
        Some(p) => p,
        None => return Ok(None),
    };

    // Get all tracks assigned to this project
    let mut stmt = conn.prepare(
        "SELECT id, name, total_seconds
         FROM tracks
         WHERE billing_project_id = ?1
         ORDER BY name ASC",
    )?;

    let tracks: Vec<BillingTrackInfo> = stmt
        .query_map([project_id], |row| {
            Ok(BillingTrackInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                total_seconds: row.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // Calculate total seconds across all tracks
    let total_seconds: i64 = tracks.iter().map(|t| t.total_seconds).sum();

    // Calculate total value: (total_seconds / 3600.0) * hourly_rate
    let total_hours = total_seconds as f64 / 3600.0;
    let total_value = total_hours * project.hourly_rate;

    Ok(Some(BillingProjectDetail {
        project,
        tracks,
        total_seconds,
        total_value,
    }))
}
