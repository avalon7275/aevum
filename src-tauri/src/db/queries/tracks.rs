use rusqlite::Connection;

use crate::db::models::Track;
use crate::error::AppError;

/// Insert or update a track. Returns the track ID.
pub fn upsert_track(
    conn: &Connection,
    name: &str,
    daw: &str,
    now: i64,
) -> Result<i64, AppError> {
    // Try to find existing track
    let existing: Option<i64> = conn
        .query_row(
            "SELECT id FROM tracks WHERE name = ?1",
            [name],
            |row| row.get(0),
        )
        .ok();

    if let Some(id) = existing {
        conn.execute(
            "UPDATE tracks SET last_seen = ?1 WHERE id = ?2",
            rusqlite::params![now, id],
        )?;
        Ok(id)
    } else {
        conn.execute(
            "INSERT INTO tracks (name, daw, first_seen, last_seen) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![name, daw, now, now],
        )?;
        Ok(conn.last_insert_rowid())
    }
}

/// Rename a track (e.g., after Save As). Updates the name in-place.
pub fn rename_track(conn: &Connection, track_id: i64, new_name: &str, now: i64) -> Result<(), AppError> {
    conn.execute(
        "UPDATE tracks SET name = ?1, last_seen = ?2 WHERE id = ?3",
        rusqlite::params![new_name, now, track_id],
    )?;
    Ok(())
}

pub fn get_all_tracks(conn: &Connection) -> Result<Vec<Track>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, daw, first_seen, last_seen, total_seconds, notes, archived, billing_project_id
         FROM tracks ORDER BY last_seen DESC",
    )?;

    let tracks = stmt
        .query_map([], |row| {
            Ok(Track {
                id: row.get(0)?,
                name: row.get(1)?,
                daw: row.get(2)?,
                first_seen: row.get(3)?,
                last_seen: row.get(4)?,
                total_seconds: row.get(5)?,
                notes: row.get::<_, String>(6)?,
                archived: row.get::<_, i64>(7)? != 0,
                billing_project_id: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(tracks)
}

/// Archive a track (hide from active view).
pub fn archive_track(conn: &Connection, track_id: i64) -> Result<(), AppError> {
    conn.execute(
        "UPDATE tracks SET archived = 1 WHERE id = ?1",
        rusqlite::params![track_id],
    )?;
    Ok(())
}

/// Unarchive a track (restore to active view).
pub fn unarchive_track(conn: &Connection, track_id: i64) -> Result<(), AppError> {
    conn.execute(
        "UPDATE tracks SET archived = 0 WHERE id = ?1",
        rusqlite::params![track_id],
    )?;
    Ok(())
}

/// Assign or unassign a track to a billing project.
pub fn assign_track_to_project(
    conn: &Connection,
    track_id: i64,
    project_id: Option<i64>,
) -> Result<(), AppError> {
    conn.execute(
        "UPDATE tracks SET billing_project_id = ?1 WHERE id = ?2",
        rusqlite::params![project_id, track_id],
    )?;
    Ok(())
}
