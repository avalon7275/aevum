use rusqlite::Connection;

use crate::db::models::Event;
use crate::error::AppError;

pub fn insert_event(
    conn: &Connection,
    session_id: i64,
    timestamp: i64,
    window_title: &str,
    process_name: &str,
    category: &str,
    plugin_id: Option<i64>,
    raw_title: Option<&str>,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO events (session_id, timestamp, window_title, process_name, category, plugin_id, raw_title)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![session_id, timestamp, window_title, process_name, category, plugin_id, raw_title],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get_events_for_session(
    conn: &Connection,
    session_id: i64,
) -> Result<Vec<Event>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, timestamp, window_title, process_name, category, plugin_id, raw_title
         FROM events WHERE session_id = ?1 ORDER BY timestamp ASC",
    )?;

    let events = stmt
        .query_map([session_id], |row| {
            Ok(Event {
                id: row.get(0)?,
                session_id: row.get(1)?,
                timestamp: row.get(2)?,
                window_title: row.get(3)?,
                process_name: row.get(4)?,
                category: row.get(5)?,
                plugin_id: row.get(6)?,
                raw_title: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(events)
}

pub fn get_recent_events(conn: &Connection, limit: usize) -> Result<Vec<Event>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, timestamp, window_title, process_name, category, plugin_id, raw_title
         FROM events ORDER BY timestamp DESC LIMIT ?1",
    )?;

    let events = stmt
        .query_map([limit as i64], |row| {
            Ok(Event {
                id: row.get(0)?,
                session_id: row.get(1)?,
                timestamp: row.get(2)?,
                window_title: row.get(3)?,
                process_name: row.get(4)?,
                category: row.get(5)?,
                plugin_id: row.get(6)?,
                raw_title: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(events)
}
