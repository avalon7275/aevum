use rusqlite::Connection;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;

use crate::db::models::Session;
use crate::error::AppError;
use crate::plugin_db::PluginDatabase;
use crate::poller::daw_matcher;
use crate::poller::plugin_classifier;

pub fn create_session(
    conn: &Connection,
    project_id: i64,
    started_at: i64,
) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO sessions (project_id, started_at, is_active) VALUES (?1, ?2, 1)",
        rusqlite::params![project_id, started_at],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn end_session(conn: &Connection, session_id: i64, ended_at: i64) -> Result<(), AppError> {
    conn.execute(
        "UPDATE sessions SET ended_at = ?1, is_active = 0,
         duration_secs = ?1 - started_at
         WHERE id = ?2",
        rusqlite::params![ended_at, session_id],
    )?;

    // Update the project's total_seconds
    conn.execute(
        "UPDATE projects SET total_seconds = (
            SELECT COALESCE(SUM(duration_secs), 0) FROM sessions WHERE project_id = projects.id
         )
         WHERE id = (SELECT project_id FROM sessions WHERE id = ?1)",
        rusqlite::params![session_id],
    )?;

    Ok(())
}

pub fn get_active_session(conn: &Connection) -> Result<Option<Session>, AppError> {
    let result = conn.query_row(
        "SELECT id, project_id, started_at, ended_at, duration_secs, is_active
         FROM sessions WHERE is_active = 1 LIMIT 1",
        [],
        |row| {
            Ok(Session {
                id: row.get(0)?,
                project_id: row.get(1)?,
                started_at: row.get(2)?,
                ended_at: row.get(3)?,
                duration_secs: row.get(4)?,
                is_active: row.get::<_, i64>(5)? != 0,
            })
        },
    );

    match result {
        Ok(session) => Ok(Some(session)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn get_sessions_for_date(
    conn: &Connection,
    start_of_day: i64,
    end_of_day: i64,
) -> Result<Vec<Session>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, started_at, ended_at, duration_secs, is_active
         FROM sessions
         WHERE started_at >= ?1 AND started_at < ?2
         ORDER BY started_at ASC",
    )?;

    let sessions = stmt
        .query_map(rusqlite::params![start_of_day, end_of_day], |row| {
            Ok(Session {
                id: row.get(0)?,
                project_id: row.get(1)?,
                started_at: row.get(2)?,
                ended_at: row.get(3)?,
                duration_secs: row.get(4)?,
                is_active: row.get::<_, i64>(5)? != 0,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(sessions)
}

// ─── Session Story ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct PhaseSegment {
    pub category: String,
    pub start_ts: i64,
    pub end_ts: i64,
    pub duration_secs: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct StoryPlugin {
    pub name: String,
    pub category: String,
    pub total_secs: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SessionStory {
    pub session_id: i64,
    pub project_name: String,
    pub daw: String,
    pub started_at: i64,
    pub ended_at: i64,
    pub duration_secs: i64,
    pub phases: Vec<PhaseSegment>,
    pub category_totals: Vec<(String, i64)>,
    pub top_plugins: Vec<StoryPlugin>,
    pub focus_pct: f64,
    pub longest_focus_secs: i64,
}

pub fn get_session_story(
    conn: &Connection,
    session_id: i64,
    plugin_db: Option<&Arc<PluginDatabase>>,
) -> Result<SessionStory, AppError> {
    // Get session + project info
    let (project_name, daw, started_at, ended_at, duration_secs): (String, String, i64, i64, i64) =
        conn.query_row(
            "SELECT p.name, p.daw, s.started_at, COALESCE(s.ended_at, s.started_at + s.duration_secs), s.duration_secs
             FROM sessions s
             INNER JOIN projects p ON s.project_id = p.id
             WHERE s.id = ?1",
            [session_id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )?;

    // Get all events for the session
    let mut stmt = conn.prepare(
        "SELECT e.timestamp, e.category, e.process_name, e.window_title
         FROM events e
         WHERE e.session_id = ?1
         ORDER BY e.timestamp ASC",
    )?;
    let events: Vec<(i64, String, String, String)> = stmt
        .query_map([session_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // Merge into phase segments (same pattern as dashboard timeline blocks)
    let mut phases: Vec<PhaseSegment> = Vec::new();
    for (ts, cat, _, _) in &events {
        if let Some(last) = phases.last_mut() {
            if last.category == *cat && (*ts - last.end_ts) < 10 {
                last.end_ts = *ts;
                last.duration_secs = last.end_ts - last.start_ts;
                continue;
            }
        }
        phases.push(PhaseSegment {
            category: cat.clone(),
            start_ts: *ts,
            end_ts: *ts,
            duration_secs: 0,
        });
    }

    // Category totals
    let mut cat_map: HashMap<String, i64> = HashMap::new();
    for seg in &phases {
        let secs = seg.duration_secs.max(2);
        *cat_map.entry(seg.category.clone()).or_insert(0) += secs;
    }
    let mut category_totals: Vec<(String, i64)> = cat_map.into_iter().collect();
    category_totals.sort_by(|a, b| b.1.cmp(&a.1));

    // Focus stats
    let tick = 2i64;
    let mut daw_secs: i64 = 0;
    let mut total_tick_secs: i64 = 0;
    let mut current_focus_run: i64 = 0;
    let mut longest_focus: i64 = 0;

    for (_, cat, _, _) in &events {
        let focused = cat != "break" && cat != "idle";
        total_tick_secs += tick;
        if focused {
            daw_secs += tick;
            current_focus_run += tick;
            if current_focus_run > longest_focus {
                longest_focus = current_focus_run;
            }
        } else {
            current_focus_run = 0;
        }
    }

    let focus_pct = if total_tick_secs > 0 {
        (daw_secs as f64 / total_tick_secs as f64) * 100.0
    } else {
        0.0
    };

    // Plugin usage
    let mut top_plugins: Vec<StoryPlugin> = Vec::new();
    if let Some(db) = plugin_db {
        let mut plugin_secs: HashMap<String, (String, i64)> = HashMap::new();
        for (_, cat, process_name, title) in &events {
            if cat == "break" || cat == "idle" {
                continue;
            }
            if daw_matcher::match_daw(process_name, title).is_none() {
                continue;
            }
            let classification = plugin_classifier::classify_window(title, &daw, db);
            if let Some(plugin_name) = classification.plugin_name {
                let plugin_cat = classification.plugin_category.unwrap_or_else(|| "plugin".to_string());
                let entry = plugin_secs.entry(plugin_name).or_insert((plugin_cat, 0));
                entry.1 += tick;
            }
        }
        top_plugins = plugin_secs
            .into_iter()
            .map(|(name, (category, total_secs))| StoryPlugin {
                name,
                category,
                total_secs,
            })
            .collect();
        top_plugins.sort_by(|a, b| b.total_secs.cmp(&a.total_secs));
        top_plugins.truncate(8);
    }

    Ok(SessionStory {
        session_id,
        project_name,
        daw,
        started_at,
        ended_at,
        duration_secs,
        phases,
        category_totals,
        top_plugins,
        focus_pct,
        longest_focus_secs: longest_focus,
    })
}
