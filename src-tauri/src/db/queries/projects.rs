use rusqlite::Connection;

use crate::db::models::Project;
use crate::error::AppError;

/// Insert or update a project. Returns the project ID.
pub fn upsert_project(
    conn: &Connection,
    name: &str,
    daw: &str,
    now: i64,
) -> Result<i64, AppError> {
    // Try to find existing project
    let existing: Option<i64> = conn
        .query_row(
            "SELECT id FROM projects WHERE name = ?1",
            [name],
            |row| row.get(0),
        )
        .ok();

    if let Some(id) = existing {
        conn.execute(
            "UPDATE projects SET last_seen = ?1 WHERE id = ?2",
            rusqlite::params![now, id],
        )?;
        Ok(id)
    } else {
        conn.execute(
            "INSERT INTO projects (name, daw, first_seen, last_seen) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![name, daw, now, now],
        )?;
        Ok(conn.last_insert_rowid())
    }
}

/// Rename a project (e.g., after Save As). Updates the name in-place.
pub fn rename_project(conn: &Connection, project_id: i64, new_name: &str, now: i64) -> Result<(), AppError> {
    conn.execute(
        "UPDATE projects SET name = ?1, last_seen = ?2 WHERE id = ?3",
        rusqlite::params![new_name, now, project_id],
    )?;
    Ok(())
}

pub fn get_all_projects(conn: &Connection) -> Result<Vec<Project>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, daw, first_seen, last_seen, total_seconds, notes, archived
         FROM projects ORDER BY last_seen DESC",
    )?;

    let projects = stmt
        .query_map([], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                daw: row.get(2)?,
                first_seen: row.get(3)?,
                last_seen: row.get(4)?,
                total_seconds: row.get(5)?,
                notes: row.get::<_, String>(6)?,
                archived: row.get::<_, i64>(7)? != 0,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(projects)
}
