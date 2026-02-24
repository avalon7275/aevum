use rusqlite::Connection;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;

use crate::error::AppError;
use crate::plugin_db::PluginDatabase;
use crate::poller::daw_matcher;
use crate::poller::plugin_classifier;

#[derive(Debug, Clone, Serialize)]
pub struct TimelineBlock {
    pub category: String,
    pub start_ts: i64,
    pub end_ts: i64,
    pub duration_secs: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CategoryTotal {
    pub category: String,
    pub total_secs: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrackTotal {
    pub id: i64,
    pub name: String,
    pub daw: String,
    pub total_secs: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct FocusPeriod {
    pub start_ts: i64,
    pub end_ts: i64,
    pub duration_secs: i64,
    pub focused: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct FocusReport {
    pub daw_secs: i64,
    pub away_secs: i64,
    pub total_secs: i64,
    pub periods: Vec<FocusPeriod>,
    pub insights: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginUsage {
    pub name: String,
    pub category: String,
    pub total_secs: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginCategoryUsage {
    pub category: String,
    pub label: String,
    pub total_secs: i64,
    pub plugin_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginReport {
    pub top_plugins: Vec<PluginUsage>,
    pub categories: Vec<PluginCategoryUsage>,
    pub insights: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DaySummary {
    pub total_secs: i64,
    pub session_count: i64,
    pub category_totals: Vec<CategoryTotal>,
    pub tracks: Vec<TrackTotal>,
    pub timeline: Vec<TimelineBlock>,
    pub focus: FocusReport,
    pub plugins: PluginReport,
}

pub fn get_day_summary(
    conn: &Connection,
    start_of_day: i64,
    end_of_day: i64,
    plugin_db: Option<&Arc<PluginDatabase>>,
) -> Result<DaySummary, AppError> {
    let mut stmt = conn.prepare(
        "SELECT e.timestamp, e.category, e.process_name, e.window_title, p.daw
         FROM events e
         INNER JOIN sessions s ON e.session_id = s.id
         INNER JOIN tracks p ON s.track_id = p.id
         WHERE e.timestamp >= ?1 AND e.timestamp <= ?2
         ORDER BY e.timestamp ASC",
    )?;

    let events: Vec<(i64, String, String, String, String)> = stmt
        .query_map(rusqlite::params![start_of_day, end_of_day], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // Merge into timeline blocks
    let mut timeline: Vec<TimelineBlock> = Vec::new();
    for (ts, cat, _, _, _) in &events {
        if let Some(last) = timeline.last_mut() {
            if last.category == *cat && (*ts - last.end_ts) < 10 {
                last.end_ts = *ts;
                last.duration_secs = last.end_ts - last.start_ts;
                continue;
            }
        }
        timeline.push(TimelineBlock {
            category: cat.clone(),
            start_ts: *ts,
            end_ts: *ts,
            duration_secs: 0,
        });
    }

    // Category totals
    let mut cat_map: HashMap<String, i64> = HashMap::new();
    for block in &timeline {
        let secs = block.duration_secs.max(2);
        *cat_map.entry(block.category.clone()).or_insert(0) += secs;
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

    // === Focus Report ===
    let focus = build_focus_report(&events);

    // === Plugin Report ===
    let plugins = build_plugin_report(&events, plugin_db);

    // Session count
    let session_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sessions WHERE started_at >= ?1 AND started_at <= ?2",
        rusqlite::params![start_of_day, end_of_day],
        |row| row.get(0),
    )?;

    // Track totals
    let mut track_stmt = conn.prepare(
        "SELECT p.id, p.name, p.daw, COALESCE(SUM(s.duration_secs), 0) as total
         FROM sessions s
         INNER JOIN tracks p ON s.track_id = p.id
         WHERE s.started_at >= ?1 AND s.started_at <= ?2
         GROUP BY p.id
         ORDER BY total DESC",
    )?;
    let tracks: Vec<TrackTotal> = track_stmt
        .query_map(rusqlite::params![start_of_day, end_of_day], |row| {
            Ok(TrackTotal {
                id: row.get(0)?,
                name: row.get(1)?,
                daw: row.get(2)?,
                total_secs: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(DaySummary {
        total_secs,
        session_count,
        category_totals,
        tracks,
        timeline,
        focus,
        plugins,
    })
}

fn build_focus_report(events: &[(i64, String, String, String, String)]) -> FocusReport {
    if events.is_empty() {
        return FocusReport {
            daw_secs: 0,
            away_secs: 0,
            total_secs: 0,
            periods: vec![],
            insights: vec![],
        };
    }

    let tick = 2i64;

    // Build focus periods: merge consecutive same-state ticks
    let mut periods: Vec<FocusPeriod> = Vec::new();
    let mut daw_secs: i64 = 0;
    let mut away_secs: i64 = 0;

    for (ts, cat, _, _, _) in events {
        let focused = cat != "break" && cat != "idle";
        if focused {
            daw_secs += tick;
        } else {
            away_secs += tick;
        }

        if let Some(last) = periods.last_mut() {
            if last.focused == focused && (*ts - last.end_ts) < 30 {
                last.end_ts = *ts;
                last.duration_secs = last.end_ts - last.start_ts;
                continue;
            }
        }
        periods.push(FocusPeriod {
            start_ts: *ts,
            end_ts: *ts,
            duration_secs: 0,
            focused,
        });
    }

    let total_secs = daw_secs + away_secs;

    // Generate text insights
    let mut insights: Vec<String> = Vec::new();

    // Find the longest focused period
    let best_focus = periods
        .iter()
        .filter(|p| p.focused && p.duration_secs >= 60)
        .max_by_key(|p| p.duration_secs);

    if let Some(best) = best_focus {
        let start_time = format_clock(best.start_ts);
        let end_time = format_clock(best.end_ts);
        let dur = format_dur(best.duration_secs);
        insights.push(format!(
            "Your most focused period was {} to {} ({})",
            start_time, end_time, dur
        ));
    }

    // Find the longest away period
    let worst_away = periods
        .iter()
        .filter(|p| !p.focused && p.duration_secs >= 60)
        .max_by_key(|p| p.duration_secs);

    if let Some(worst) = worst_away {
        let start_time = format_clock(worst.start_ts);
        let end_time = format_clock(worst.end_ts);
        let dur = format_dur(worst.duration_secs);
        insights.push(format!(
            "Longest time away from DAW was {} to {} ({})",
            start_time, end_time, dur
        ));
    }

    // Overall focus quality
    if total_secs > 0 {
        let pct = (daw_secs as f64 / total_secs as f64) * 100.0;
        if pct >= 85.0 {
            insights.push("Excellent focus today. You barely left your DAW.".to_string());
        } else if pct >= 70.0 {
            insights.push(format!(
                "Good focus overall. You spent {} in your DAW out of {} tracked.",
                format_dur(daw_secs),
                format_dur(total_secs)
            ));
        } else if pct >= 50.0 {
            insights.push(format!(
                "You spent about half your time outside the DAW ({} away out of {}).",
                format_dur(away_secs),
                format_dur(total_secs)
            ));
        } else {
            insights.push(format!(
                "Most of your tracked time was outside the DAW ({} away out of {}).",
                format_dur(away_secs),
                format_dur(total_secs)
            ));
        }
    }

    // Count focused streaks over 30 min
    let deep_focus_count = periods
        .iter()
        .filter(|p| p.focused && p.duration_secs >= 1800)
        .count();
    if deep_focus_count > 0 {
        insights.push(format!(
            "You had {} deep focus session{} (30+ minutes uninterrupted).",
            deep_focus_count,
            if deep_focus_count == 1 { "" } else { "s" }
        ));
    }

    FocusReport {
        daw_secs,
        away_secs,
        total_secs,
        periods,
        insights,
    }
}

fn build_plugin_report(
    events: &[(i64, String, String, String, String)],
    plugin_db: Option<&Arc<PluginDatabase>>,
) -> PluginReport {
    let tick = 2i64;
    let mut plugin_secs: HashMap<String, (String, i64)> = HashMap::new(); // name -> (category, secs)

    let db = match plugin_db {
        Some(db) => db,
        None => {
            return PluginReport {
                top_plugins: vec![],
                categories: vec![],
                insights: vec![],
            };
        }
    };

    for (_, cat, process_name, title, daw) in events {
        if cat == "break" || cat == "idle" {
            continue;
        }
        // Only classify windows that belong to a DAW process
        if daw_matcher::match_daw(process_name, title).is_none() {
            continue;
        }
        let classification = plugin_classifier::classify_window(title, daw, db);
        if let Some(plugin_name) = classification.plugin_name {
            let plugin_cat = classification.plugin_category.unwrap_or_else(|| "plugin".to_string());
            let entry = plugin_secs
                .entry(plugin_name)
                .or_insert((plugin_cat, 0));
            entry.1 += tick;
        }
    }

    // Top plugins
    let mut top_plugins: Vec<PluginUsage> = plugin_secs
        .iter()
        .map(|(name, (cat, secs))| PluginUsage {
            name: name.clone(),
            category: cat.clone(),
            total_secs: *secs,
        })
        .collect();
    top_plugins.sort_by(|a, b| b.total_secs.cmp(&a.total_secs));
    top_plugins.truncate(15);

    // Aggregate by plugin category
    let mut cat_secs: HashMap<String, (i64, HashMap<String, bool>)> = HashMap::new();
    for (name, (cat, secs)) in &plugin_secs {
        let entry = cat_secs
            .entry(cat.clone())
            .or_insert((0, HashMap::new()));
        entry.0 += secs;
        entry.1.insert(name.clone(), true);
    }
    let mut categories: Vec<PluginCategoryUsage> = cat_secs
        .into_iter()
        .map(|(category, (total_secs, plugins))| PluginCategoryUsage {
            label: pretty_category(&category),
            category,
            total_secs,
            plugin_count: plugins.len() as i64,
        })
        .collect();
    categories.sort_by(|a, b| b.total_secs.cmp(&a.total_secs));

    // Insights
    let mut insights: Vec<String> = Vec::new();

    if let Some(top) = top_plugins.first() {
        insights.push(format!(
            "Your most used plugin was {} ({}).",
            top.name,
            format_dur(top.total_secs)
        ));
    }

    if let Some(top_cat) = categories.first() {
        insights.push(format!(
            "You spent the most time on {} ({}, {} plugin{}).",
            top_cat.label,
            format_dur(top_cat.total_secs),
            top_cat.plugin_count,
            if top_cat.plugin_count == 1 { "" } else { "s" }
        ));
    }

    if categories.len() >= 2 {
        let names: Vec<&str> = categories.iter().take(3).map(|c| c.label.as_str()).collect();
        insights.push(format!("Plugin categories used: {}.", names.join(", ")));
    }

    let total_plugin_secs: i64 = top_plugins.iter().map(|p| p.total_secs).sum();
    if total_plugin_secs > 0 {
        let unique_count = plugin_secs.len();
        insights.push(format!(
            "You used {} different plugin{} for a total of {}.",
            unique_count,
            if unique_count == 1 { "" } else { "s" },
            format_dur(total_plugin_secs)
        ));
    }

    PluginReport {
        top_plugins,
        categories,
        insights,
    }
}

// ─── Weekly Summary ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct DayTotal {
    pub date: String,
    pub total_secs: i64,
    pub session_count: i64,
    pub tracks: Vec<TrackTotal>,
    pub category_totals: Vec<CategoryTotal>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WeekSummary {
    pub week_start: String,
    pub week_end: String,
    pub total_secs: i64,
    pub total_sessions: i64,
    pub unique_tracks: i64,
    pub days: Vec<DayTotal>,
}

pub fn get_week_summary(
    conn: &Connection,
    week_start: i64,
    week_end: i64,
) -> Result<WeekSummary, AppError> {
    // Get the start date as NaiveDate for generating all 7 days
    let start_dt = chrono::DateTime::from_timestamp(week_start, 0)
        .unwrap()
        .with_timezone(&chrono::Local)
        .date_naive();
    let end_dt = start_dt + chrono::Duration::days(6);

    let week_start_str = start_dt.format("%Y-%m-%d").to_string();
    let week_end_str = end_dt.format("%Y-%m-%d").to_string();

    // Fetch all events in the week range
    let mut stmt = conn.prepare(
        "SELECT e.timestamp, e.category, p.id, p.name, p.daw
         FROM events e
         INNER JOIN sessions s ON e.session_id = s.id
         INNER JOIN tracks p ON s.track_id = p.id
         WHERE e.timestamp >= ?1 AND e.timestamp <= ?2
         ORDER BY e.timestamp ASC",
    )?;

    let events: Vec<(i64, String, i64, String, String)> = stmt
        .query_map(rusqlite::params![week_start, week_end], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // Bucket events by local date
    let mut day_events: HashMap<String, Vec<(i64, String, i64, String, String)>> = HashMap::new();
    for ev in &events {
        let dt = chrono::DateTime::from_timestamp(ev.0, 0);
        if let Some(d) = dt {
            let local = d.with_timezone(&chrono::Local).date_naive();
            let date_str = local.format("%Y-%m-%d").to_string();
            day_events.entry(date_str).or_default().push(ev.clone());
        }
    }

    // Session counts per day
    let mut sess_stmt = conn.prepare(
        "SELECT started_at, COUNT(*) as cnt
         FROM sessions
         WHERE started_at >= ?1 AND started_at <= ?2
         GROUP BY DATE(started_at, 'unixepoch', 'localtime')",
    )?;
    let mut session_counts: HashMap<String, i64> = HashMap::new();
    {
        let rows = sess_stmt.query_map(rusqlite::params![week_start, week_end], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
        })?;
        for row in rows {
            let (ts, count) = row?;
            if let Some(d) = chrono::DateTime::from_timestamp(ts, 0) {
                let date_str = d
                    .with_timezone(&chrono::Local)
                    .date_naive()
                    .format("%Y-%m-%d")
                    .to_string();
                *session_counts.entry(date_str).or_insert(0) += count;
            }
        }
    }

    // Actually, let's re-query session counts properly grouped by date
    let mut sess_stmt2 = conn.prepare(
        "SELECT DATE(started_at, 'unixepoch', 'localtime') as day, COUNT(*) as cnt
         FROM sessions
         WHERE started_at >= ?1 AND started_at <= ?2
         GROUP BY day",
    )?;
    let mut session_counts: HashMap<String, i64> = HashMap::new();
    {
        let rows = sess_stmt2.query_map(rusqlite::params![week_start, week_end], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
        })?;
        for row in rows {
            let (date_str, count) = row?;
            session_counts.insert(date_str, count);
        }
    }

    // Unique tracks across the week
    let unique_tracks: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT track_id) FROM sessions WHERE started_at >= ?1 AND started_at <= ?2",
        rusqlite::params![week_start, week_end],
        |row| row.get(0),
    )?;

    // Build 7 DayTotal entries
    let mut days: Vec<DayTotal> = Vec::with_capacity(7);
    for i in 0..7 {
        let day_date = start_dt + chrono::Duration::days(i);
        let date_str = day_date.format("%Y-%m-%d").to_string();

        let evts = day_events.get(&date_str);
        let session_count = session_counts.get(&date_str).copied().unwrap_or(0);

        if let Some(evts) = evts {
            // Compute category totals from events (use 2s tick)
            let tick = 2i64;
            let mut cat_map: HashMap<String, i64> = HashMap::new();
            for (_, cat, _, _, _) in evts {
                *cat_map.entry(cat.clone()).or_insert(0) += tick;
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

            // Compute track totals from events
            let mut track_map: HashMap<i64, (String, String, i64)> = HashMap::new();
            for (_, _, pid, name, daw) in evts {
                let entry = track_map
                    .entry(*pid)
                    .or_insert((name.clone(), daw.clone(), 0));
                entry.2 += tick;
            }
            let mut tracks: Vec<TrackTotal> = track_map
                .into_iter()
                .map(|(id, (name, daw, total_secs))| TrackTotal {
                    id,
                    name,
                    daw,
                    total_secs,
                })
                .collect();
            tracks.sort_by(|a, b| b.total_secs.cmp(&a.total_secs));

            days.push(DayTotal {
                date: date_str,
                total_secs,
                session_count,
                tracks,
                category_totals,
            });
        } else {
            days.push(DayTotal {
                date: date_str,
                total_secs: 0,
                session_count: 0,
                tracks: vec![],
                category_totals: vec![],
            });
        }
    }

    let total_secs: i64 = days.iter().map(|d| d.total_secs).sum();
    let total_sessions: i64 = days.iter().map(|d| d.session_count).sum();

    Ok(WeekSummary {
        week_start: week_start_str,
        week_end: week_end_str,
        total_secs,
        total_sessions,
        unique_tracks,
        days,
    })
}

// ─── Year Heatmap ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct HeatmapDay {
    pub date: String,
    pub total_secs: i64,
}

pub fn get_year_heatmap(
    conn: &Connection,
    start_ts: i64,
    end_ts: i64,
) -> Result<Vec<HeatmapDay>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT e.timestamp, e.category
         FROM events e
         WHERE e.timestamp >= ?1 AND e.timestamp <= ?2
         ORDER BY e.timestamp ASC",
    )?;

    let events: Vec<(i64, String)> = stmt
        .query_map(rusqlite::params![start_ts, end_ts], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    // Bucket by local date, counting 2s ticks
    let tick = 2i64;
    let mut day_secs: HashMap<String, i64> = HashMap::new();
    for (ts, _cat) in &events {
        if let Some(d) = chrono::DateTime::from_timestamp(*ts, 0) {
            let date_str = d
                .with_timezone(&chrono::Local)
                .date_naive()
                .format("%Y-%m-%d")
                .to_string();
            *day_secs.entry(date_str).or_insert(0) += tick;
        }
    }

    // Build sorted vec of all days in range
    let start_date = chrono::DateTime::from_timestamp(start_ts, 0)
        .unwrap()
        .with_timezone(&chrono::Local)
        .date_naive();
    let end_date = chrono::DateTime::from_timestamp(end_ts, 0)
        .unwrap()
        .with_timezone(&chrono::Local)
        .date_naive();

    let mut result = Vec::new();
    let mut current = start_date;
    while current <= end_date {
        let date_str = current.format("%Y-%m-%d").to_string();
        let total_secs = day_secs.get(&date_str).copied().unwrap_or(0);
        result.push(HeatmapDay { date: date_str, total_secs });
        current += chrono::Duration::days(1);
    }

    Ok(result)
}

// ─── Track Detail ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct SessionSummary {
    pub id: i64,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub duration_secs: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrackDetail {
    pub id: i64,
    pub name: String,
    pub daw: String,
    pub first_seen: i64,
    pub last_seen: i64,
    pub total_seconds: i64,
    pub session_count: i64,
    pub category_totals: Vec<CategoryTotal>,
    pub recent_sessions: Vec<SessionSummary>,
}

pub fn get_track_detail(
    conn: &Connection,
    track_id: i64,
) -> Result<TrackDetail, AppError> {
    // Get track row
    let (name, daw, first_seen, last_seen, total_seconds): (String, String, i64, i64, i64) =
        conn.query_row(
            "SELECT name, daw, first_seen, last_seen, total_seconds FROM tracks WHERE id = ?1",
            rusqlite::params![track_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )?;

    // Session count
    let session_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sessions WHERE track_id = ?1",
        rusqlite::params![track_id],
        |row| row.get(0),
    )?;

    // Category totals from all events for this track
    let tick = 2i64;
    let mut cat_stmt = conn.prepare(
        "SELECT e.category
         FROM events e
         INNER JOIN sessions s ON e.session_id = s.id
         WHERE s.track_id = ?1
         ORDER BY e.timestamp ASC",
    )?;
    let categories: Vec<String> = cat_stmt
        .query_map(rusqlite::params![track_id], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;

    let mut cat_map: HashMap<String, i64> = HashMap::new();
    for cat in &categories {
        *cat_map.entry(cat.clone()).or_insert(0) += tick;
    }
    let mut category_totals: Vec<CategoryTotal> = cat_map
        .into_iter()
        .map(|(category, total_secs)| CategoryTotal { category, total_secs })
        .collect();
    category_totals.sort_by(|a, b| b.total_secs.cmp(&a.total_secs));

    // Recent sessions (last 10)
    let mut sess_stmt = conn.prepare(
        "SELECT id, started_at, ended_at, duration_secs
         FROM sessions
         WHERE track_id = ?1
         ORDER BY started_at DESC
         LIMIT 10",
    )?;
    let recent_sessions: Vec<SessionSummary> = sess_stmt
        .query_map(rusqlite::params![track_id], |row| {
            Ok(SessionSummary {
                id: row.get(0)?,
                started_at: row.get(1)?,
                ended_at: row.get(2)?,
                duration_secs: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(TrackDetail {
        id: track_id,
        name,
        daw,
        first_seen,
        last_seen,
        total_seconds,
        session_count,
        category_totals,
        recent_sessions,
    })
}

// ─── Week Comparison ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct CategoryShift {
    pub category: String,
    pub this_week_secs: i64,
    pub last_week_secs: i64,
    pub delta_secs: i64,
    pub direction: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrackShift {
    pub name: String,
    pub this_week_secs: i64,
    pub last_week_secs: i64,
    pub delta_secs: i64,
    pub direction: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct WeekComparison {
    pub this_week_total: i64,
    pub last_week_total: i64,
    pub category_shifts: Vec<CategoryShift>,
    pub track_shifts: Vec<TrackShift>,
    pub insight: String,
}

pub fn get_week_comparison(
    conn: &Connection,
    this_start: i64,
    this_end: i64,
    last_start: i64,
    last_end: i64,
) -> Result<WeekComparison, AppError> {
    let tick = 2i64;

    // Helper: get category totals for a time range
    let get_cat_totals = |start: i64, end: i64| -> Result<HashMap<String, i64>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT e.category
             FROM events e
             WHERE e.timestamp >= ?1 AND e.timestamp <= ?2
             ORDER BY e.timestamp ASC",
        )?;
        let cats: Vec<String> = stmt
            .query_map(rusqlite::params![start, end], |row| row.get(0))?
            .collect::<Result<Vec<_>, _>>()?;
        let mut map: HashMap<String, i64> = HashMap::new();
        for cat in cats {
            *map.entry(cat).or_insert(0) += tick;
        }
        Ok(map)
    };

    // Helper: get track totals for a time range
    let get_track_totals = |start: i64, end: i64| -> Result<HashMap<String, i64>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT p.name
             FROM events e
             INNER JOIN sessions s ON e.session_id = s.id
             INNER JOIN tracks p ON s.track_id = p.id
             WHERE e.timestamp >= ?1 AND e.timestamp <= ?2",
        )?;
        let names: Vec<String> = stmt
            .query_map(rusqlite::params![start, end], |row| row.get(0))?
            .collect::<Result<Vec<_>, _>>()?;
        let mut map: HashMap<String, i64> = HashMap::new();
        for name in names {
            *map.entry(name).or_insert(0) += tick;
        }
        Ok(map)
    };

    let this_cats = get_cat_totals(this_start, this_end)?;
    let last_cats = get_cat_totals(last_start, last_end)?;
    let this_tracks = get_track_totals(this_start, this_end)?;
    let last_tracks = get_track_totals(last_start, last_end)?;

    let this_week_total: i64 = this_cats.values().sum();
    let last_week_total: i64 = last_cats.values().sum();

    // Build category shifts (skip idle/break, only >5min delta)
    let mut all_cats: std::collections::HashSet<String> = std::collections::HashSet::new();
    all_cats.extend(this_cats.keys().cloned());
    all_cats.extend(last_cats.keys().cloned());

    let mut category_shifts: Vec<CategoryShift> = Vec::new();
    for cat in &all_cats {
        if cat == "idle" || cat == "break" {
            continue;
        }
        let this_secs = this_cats.get(cat).copied().unwrap_or(0);
        let last_secs = last_cats.get(cat).copied().unwrap_or(0);
        let delta = this_secs - last_secs;
        if delta.abs() < 300 {
            continue; // Skip <5min changes
        }
        let direction = if delta > 0 {
            "up".to_string()
        } else {
            "down".to_string()
        };
        category_shifts.push(CategoryShift {
            category: cat.clone(),
            this_week_secs: this_secs,
            last_week_secs: last_secs,
            delta_secs: delta,
            direction,
        });
    }
    category_shifts.sort_by(|a, b| b.delta_secs.abs().cmp(&a.delta_secs.abs()));

    // Build track shifts (only >5min delta)
    let mut all_tracks: std::collections::HashSet<String> = std::collections::HashSet::new();
    all_tracks.extend(this_tracks.keys().cloned());
    all_tracks.extend(last_tracks.keys().cloned());

    let mut track_shifts: Vec<TrackShift> = Vec::new();
    for name in &all_tracks {
        let this_secs = this_tracks.get(name).copied().unwrap_or(0);
        let last_secs = last_tracks.get(name).copied().unwrap_or(0);
        let delta = this_secs - last_secs;
        if delta.abs() < 300 {
            continue;
        }
        let direction = if delta > 0 {
            "up".to_string()
        } else {
            "down".to_string()
        };
        track_shifts.push(TrackShift {
            name: name.clone(),
            this_week_secs: this_secs,
            last_week_secs: last_secs,
            delta_secs: delta,
            direction,
        });
    }
    track_shifts.sort_by(|a, b| b.delta_secs.abs().cmp(&a.delta_secs.abs()));

    // Generate natural language insight
    let insight = generate_comparison_insight(
        this_week_total,
        last_week_total,
        &category_shifts,
        &track_shifts,
    );

    Ok(WeekComparison {
        this_week_total,
        last_week_total,
        category_shifts,
        track_shifts,
        insight,
    })
}

fn generate_comparison_insight(
    this_total: i64,
    last_total: i64,
    cat_shifts: &[CategoryShift],
    track_shifts: &[TrackShift],
) -> String {
    if last_total == 0 {
        return "No data from last week to compare.".to_string();
    }
    if this_total == 0 {
        return "No activity this week yet.".to_string();
    }

    let mut parts: Vec<String> = Vec::new();

    // Biggest category shift
    if let Some(top) = cat_shifts.first() {
        let pct = if top.last_week_secs > 0 {
            ((top.delta_secs as f64 / top.last_week_secs as f64) * 100.0).abs() as i64
        } else {
            100
        };
        let label = pretty_category(&top.category);
        if top.direction == "up" {
            parts.push(format!("You spent {}% more time on {} this week.", pct, label));
        } else {
            parts.push(format!("You spent {}% less time on {} this week.", pct, label));
        }
    }

    // Biggest track shift
    if let Some(top) = track_shifts.first() {
        let dur = format_dur(top.delta_secs.abs());
        if top.direction == "up" {
            parts.push(format!("{} got {} more attention.", top.name, dur));
        } else {
            parts.push(format!("{} got {} less attention.", top.name, dur));
        }
    }

    if parts.is_empty() {
        "Your week looks similar to last week.".to_string()
    } else {
        parts.join(" ")
    }
}

// ─── Goals & Streaks ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct DayGoalStatus {
    pub date: String,
    pub total_secs: i64,
    pub goal_met: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct GoalStreak {
    pub today_secs: i64,
    pub goal_secs: i64,
    pub streak_days: i64,
    pub last_14_days: Vec<DayGoalStatus>,
}

pub fn get_goal_streak(
    conn: &Connection,
    goal_secs: i64,
    today_date: chrono::NaiveDate,
) -> Result<GoalStreak, AppError> {
    let tick = 2i64;

    // Get last 14 days of event data
    let start_date = today_date - chrono::Duration::days(13);
    let start_ts = start_date.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp();
    let end_ts = today_date.and_hms_opt(23, 59, 59).unwrap().and_utc().timestamp();

    let mut stmt = conn.prepare(
        "SELECT e.timestamp
         FROM events e
         WHERE e.timestamp >= ?1 AND e.timestamp <= ?2
         ORDER BY e.timestamp ASC",
    )?;

    let timestamps: Vec<i64> = stmt
        .query_map(rusqlite::params![start_ts, end_ts], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;

    // Bucket by local date
    let mut day_secs: HashMap<String, i64> = HashMap::new();
    for ts in &timestamps {
        if let Some(d) = chrono::DateTime::from_timestamp(*ts, 0) {
            let date_str = d
                .with_timezone(&chrono::Local)
                .date_naive()
                .format("%Y-%m-%d")
                .to_string();
            *day_secs.entry(date_str).or_insert(0) += tick;
        }
    }

    // Build 14-day status
    let mut last_14_days: Vec<DayGoalStatus> = Vec::new();
    let mut current = start_date;
    while current <= today_date {
        let date_str = current.format("%Y-%m-%d").to_string();
        let total_secs = day_secs.get(&date_str).copied().unwrap_or(0);
        last_14_days.push(DayGoalStatus {
            date: date_str,
            total_secs,
            goal_met: total_secs >= goal_secs,
        });
        current += chrono::Duration::days(1);
    }

    let today_str = today_date.format("%Y-%m-%d").to_string();
    let today_secs = day_secs.get(&today_str).copied().unwrap_or(0);

    // Compute streak: consecutive days meeting goal ending at today or yesterday
    let mut streak_days: i64 = 0;
    for day in last_14_days.iter().rev() {
        if day.goal_met {
            streak_days += 1;
        } else if day.date == today_str {
            // Today might not be done yet, skip it
            continue;
        } else {
            break;
        }
    }

    Ok(GoalStreak {
        today_secs,
        goal_secs,
        streak_days,
        last_14_days,
    })
}

fn pretty_category(cat: &str) -> String {
    match cat {
        "eq" => "EQ".to_string(),
        "compressor" => "Compression".to_string(),
        "reverb" => "Reverb".to_string(),
        "delay" => "Delay".to_string(),
        "synth" => "Synthesizers".to_string(),
        "sampler" => "Samplers".to_string(),
        "limiter" => "Limiting".to_string(),
        "saturation" => "Saturation".to_string(),
        "modulation" => "Modulation".to_string(),
        "utility" => "Utility".to_string(),
        "channel_strip" => "Channel Strips".to_string(),
        "multiband" => "Multiband Processing".to_string(),
        "gate" => "Gates".to_string(),
        "de_esser" => "De-essing".to_string(),
        "metering" => "Metering".to_string(),
        "pitch" => "Pitch Correction".to_string(),
        "amp_sim" => "Amp Simulation".to_string(),
        "creative_fx" => "Creative FX".to_string(),
        "stereo" => "Stereo/Imaging".to_string(),
        "mastering" => "Mastering Suite".to_string(),
        "restoration" => "Restoration".to_string(),
        "bus_comp" => "Bus Compression".to_string(),
        "transient" => "Transient Shaping".to_string(),
        other => {
            let mut chars = other.chars();
            match chars.next() {
                None => other.to_string(),
                Some(c) => c.to_uppercase().to_string() + chars.as_str(),
            }
        }
    }
}

fn format_clock(ts: i64) -> String {
    let dt = chrono::DateTime::from_timestamp(ts, 0);
    match dt {
        Some(d) => {
            let local = d.with_timezone(&chrono::Local);
            local.format("%l:%M %p").to_string().trim().to_string()
        }
        None => "??:??".to_string(),
    }
}

fn format_dur(secs: i64) -> String {
    let h = secs / 3600;
    let m = (secs % 3600) / 60;
    if h > 0 {
        format!("{}h {}m", h, m)
    } else if m > 0 {
        format!("{}m", m)
    } else {
        format!("{}s", secs)
    }
}
