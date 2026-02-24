use rusqlite::Connection;
use serde::Serialize;
use std::collections::HashMap;

use crate::db::queries::dashboard::CategoryTotal;
use crate::error::AppError;

#[derive(Debug, Clone, Serialize)]
pub struct CoachDay {
    pub date: String,
    pub total_secs: i64,
    pub session_count: i64,
    pub first_event_ts: Option<i64>,
    pub last_event_ts: Option<i64>,
    pub longest_continuous_secs: i64,
    pub break_secs: i64,
    pub category_totals: Vec<CategoryTotal>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CoachSession {
    pub track_name: String,
    pub started_at: i64,
    pub duration_secs: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CoachTrack {
    pub name: String,
    pub total_secs: i64,
    pub session_count: i64,
    pub avg_session_secs: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CoachWeekTotals {
    pub total_secs: i64,
    pub session_count: i64,
    pub unique_tracks: i64,
    pub avg_daily_secs: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CoachData {
    pub week_start: String,
    pub week_end: String,
    pub daily_breakdown: Vec<CoachDay>,
    pub sessions: Vec<CoachSession>,
    pub track_stats: Vec<CoachTrack>,
    pub week_totals: CoachWeekTotals,
    pub prev_week_totals: Option<CoachWeekTotals>,
}

pub fn get_coach_data(
    conn: &Connection,
    week_start_ts: i64,
    week_end_ts: i64,
    week_start_str: &str,
    week_end_str: &str,
) -> Result<CoachData, AppError> {
    let tick = 2i64;

    // ── Fetch all events for the week ──
    let mut evt_stmt = conn.prepare(
        "SELECT e.timestamp, e.category
         FROM events e
         WHERE e.timestamp >= ?1 AND e.timestamp <= ?2
         ORDER BY e.timestamp ASC",
    )?;
    let events: Vec<(i64, String)> = evt_stmt
        .query_map(rusqlite::params![week_start_ts, week_end_ts], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // Bucket events by local date
    let mut day_events: HashMap<String, Vec<(i64, String)>> = HashMap::new();
    for (ts, cat) in &events {
        if let Some(d) = chrono::DateTime::from_timestamp(*ts, 0) {
            let date_str = d
                .with_timezone(&chrono::Local)
                .date_naive()
                .format("%Y-%m-%d")
                .to_string();
            day_events
                .entry(date_str)
                .or_default()
                .push((*ts, cat.clone()));
        }
    }

    // ── Session counts per day ──
    let mut sess_count_stmt = conn.prepare(
        "SELECT DATE(started_at, 'unixepoch', 'localtime') as day, COUNT(*) as cnt
         FROM sessions
         WHERE started_at >= ?1 AND started_at <= ?2
         GROUP BY day",
    )?;
    let mut session_counts: HashMap<String, i64> = HashMap::new();
    {
        let rows = sess_count_stmt.query_map(
            rusqlite::params![week_start_ts, week_end_ts],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?)),
        )?;
        for row in rows {
            let (date_str, count) = row?;
            session_counts.insert(date_str, count);
        }
    }

    // ── Build 7 CoachDay entries ──
    let start_date = chrono::DateTime::from_timestamp(week_start_ts, 0)
        .unwrap()
        .with_timezone(&chrono::Local)
        .date_naive();

    let mut daily_breakdown: Vec<CoachDay> = Vec::with_capacity(7);
    for i in 0..7 {
        let day_date = start_date + chrono::Duration::days(i);
        let date_str = day_date.format("%Y-%m-%d").to_string();
        let session_count = session_counts.get(&date_str).copied().unwrap_or(0);

        if let Some(evts) = day_events.get(&date_str) {
            let mut cat_map: HashMap<String, i64> = HashMap::new();
            let mut break_secs: i64 = 0;
            let mut first_ts: Option<i64> = None;
            let mut last_ts: Option<i64> = None;

            for (ts, cat) in evts {
                *cat_map.entry(cat.clone()).or_insert(0) += tick;
                if cat == "break" || cat == "idle" {
                    break_secs += tick;
                }
                if first_ts.is_none() {
                    first_ts = Some(*ts);
                }
                last_ts = Some(*ts);
            }

            let mut category_totals: Vec<CategoryTotal> = cat_map
                .into_iter()
                .map(|(category, total_secs)| CategoryTotal {
                    category,
                    total_secs,
                })
                .collect();
            category_totals.sort_by(|a, b| b.total_secs.cmp(&a.total_secs));

            let total_secs: i64 = category_totals.iter().map(|c| c.total_secs).sum();

            // Compute longest continuous work stretch (non-break/idle)
            let longest_continuous_secs = compute_longest_continuous(evts, tick);

            daily_breakdown.push(CoachDay {
                date: date_str,
                total_secs,
                session_count,
                first_event_ts: first_ts,
                last_event_ts: last_ts,
                longest_continuous_secs,
                break_secs,
                category_totals,
            });
        } else {
            daily_breakdown.push(CoachDay {
                date: date_str,
                total_secs: 0,
                session_count: 0,
                first_event_ts: None,
                last_event_ts: None,
                longest_continuous_secs: 0,
                break_secs: 0,
                category_totals: vec![],
            });
        }
    }

    // ── Fetch sessions with track names ──
    let mut sess_stmt = conn.prepare(
        "SELECT p.name, s.started_at, s.duration_secs
         FROM sessions s
         INNER JOIN tracks p ON s.track_id = p.id
         WHERE s.started_at >= ?1 AND s.started_at <= ?2
         ORDER BY s.started_at ASC",
    )?;
    let sessions: Vec<CoachSession> = sess_stmt
        .query_map(rusqlite::params![week_start_ts, week_end_ts], |row| {
            Ok(CoachSession {
                track_name: row.get(0)?,
                started_at: row.get(1)?,
                duration_secs: row.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // ── Track stats ──
    let mut track_map: HashMap<String, (i64, i64)> = HashMap::new(); // name -> (total_secs, session_count)
    for s in &sessions {
        let entry = track_map.entry(s.track_name.clone()).or_insert((0, 0));
        entry.0 += s.duration_secs;
        entry.1 += 1;
    }
    let mut track_stats: Vec<CoachTrack> = track_map
        .into_iter()
        .map(|(name, (total_secs, session_count))| {
            let avg_session_secs = if session_count > 0 {
                total_secs / session_count
            } else {
                0
            };
            CoachTrack {
                name,
                total_secs,
                session_count,
                avg_session_secs,
            }
        })
        .collect();
    track_stats.sort_by(|a, b| b.total_secs.cmp(&a.total_secs));

    // ── Week totals ──
    let total_secs: i64 = daily_breakdown.iter().map(|d| d.total_secs).sum();
    let total_sessions: i64 = sessions.len() as i64;
    let unique_tracks = track_stats.len() as i64;
    let days_with_data = daily_breakdown.iter().filter(|d| d.total_secs > 0).count() as i64;
    let avg_daily_secs = if days_with_data > 0 {
        total_secs / days_with_data
    } else {
        0
    };

    let week_totals = CoachWeekTotals {
        total_secs,
        session_count: total_sessions,
        unique_tracks,
        avg_daily_secs,
    };

    // ── Previous week totals (for comparison) ──
    let prev_start_ts = week_start_ts - 7 * 86400;
    let prev_end_ts = week_start_ts - 1;
    let prev_week_totals = get_week_totals(conn, prev_start_ts, prev_end_ts)?;

    Ok(CoachData {
        week_start: week_start_str.to_string(),
        week_end: week_end_str.to_string(),
        daily_breakdown,
        sessions,
        track_stats,
        week_totals,
        prev_week_totals,
    })
}

fn compute_longest_continuous(events: &[(i64, String)], tick: i64) -> i64 {
    let mut longest: i64 = 0;
    let mut current: i64 = 0;

    for (_, cat) in events {
        if cat != "break" && cat != "idle" {
            current += tick;
            if current > longest {
                longest = current;
            }
        } else {
            current = 0;
        }
    }

    longest
}

fn get_week_totals(
    conn: &Connection,
    start_ts: i64,
    end_ts: i64,
) -> Result<Option<CoachWeekTotals>, AppError> {
    let tick = 2i64;

    // Count events for total secs
    let event_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM events WHERE timestamp >= ?1 AND timestamp <= ?2",
        rusqlite::params![start_ts, end_ts],
        |row| row.get(0),
    )?;

    if event_count == 0 {
        return Ok(None);
    }

    let total_secs = event_count * tick;

    let session_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sessions WHERE started_at >= ?1 AND started_at <= ?2",
        rusqlite::params![start_ts, end_ts],
        |row| row.get(0),
    )?;

    let unique_tracks: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT track_id) FROM sessions WHERE started_at >= ?1 AND started_at <= ?2",
        rusqlite::params![start_ts, end_ts],
        |row| row.get(0),
    )?;

    // Count unique active days
    let active_days: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT DATE(timestamp, 'unixepoch', 'localtime'))
         FROM events WHERE timestamp >= ?1 AND timestamp <= ?2",
        rusqlite::params![start_ts, end_ts],
        |row| row.get(0),
    )?;

    let avg_daily_secs = if active_days > 0 {
        total_secs / active_days
    } else {
        0
    };

    Ok(Some(CoachWeekTotals {
        total_secs,
        session_count,
        unique_tracks,
        avg_daily_secs,
    }))
}
