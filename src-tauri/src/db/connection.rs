use rusqlite::Connection;
use std::path::Path;

use crate::error::AppError;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    daw             TEXT NOT NULL,
    first_seen      INTEGER NOT NULL,
    last_seen       INTEGER NOT NULL,
    total_seconds   INTEGER NOT NULL DEFAULT 0,
    notes           TEXT DEFAULT '',
    archived        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_last_seen ON projects(last_seen);

CREATE TABLE IF NOT EXISTS sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL,
    started_at      INTEGER NOT NULL,
    ended_at        INTEGER,
    duration_secs   INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at);

CREATE TABLE IF NOT EXISTS events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER NOT NULL,
    timestamp       INTEGER NOT NULL,
    window_title    TEXT NOT NULL,
    process_name    TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'unknown',
    plugin_id       INTEGER,
    raw_title       TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (plugin_id) REFERENCES plugins(id)
);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

CREATE TABLE IF NOT EXISTS plugins (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    vendor          TEXT NOT NULL DEFAULT '',
    category        TEXT NOT NULL,
    phase_hint      TEXT NOT NULL DEFAULT 'mixing',
    window_patterns TEXT NOT NULL DEFAULT '[]',
    is_builtin      INTEGER NOT NULL DEFAULT 1,
    user_added      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_plugins_name ON plugins(name);

CREATE TABLE IF NOT EXISTS category_spans (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id      INTEGER NOT NULL,
    project_id      INTEGER NOT NULL,
    category        TEXT NOT NULL,
    started_at      INTEGER NOT NULL,
    ended_at        INTEGER,
    duration_secs   INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_spans_session ON category_spans(session_id);
CREATE INDEX IF NOT EXISTS idx_spans_started ON category_spans(started_at);

CREATE TABLE IF NOT EXISTS daily_summaries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    date            TEXT NOT NULL,
    project_id      INTEGER NOT NULL,
    total_seconds   INTEGER NOT NULL DEFAULT 0,
    composing_secs  INTEGER NOT NULL DEFAULT 0,
    arranging_secs  INTEGER NOT NULL DEFAULT 0,
    mixing_secs     INTEGER NOT NULL DEFAULT 0,
    sound_design_secs INTEGER NOT NULL DEFAULT 0,
    mastering_secs  INTEGER NOT NULL DEFAULT 0,
    sound_selection_secs INTEGER NOT NULL DEFAULT 0,
    break_secs      INTEGER NOT NULL DEFAULT 0,
    idle_secs       INTEGER NOT NULL DEFAULT 0,
    session_count   INTEGER NOT NULL DEFAULT 0,
    UNIQUE(date, project_id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_summaries(date);
"#;

pub fn init_db(db_path: &Path) -> Result<Connection, AppError> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let conn = Connection::open(db_path)?;

    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA synchronous=NORMAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    conn.execute_batch(SCHEMA)?;

    Ok(conn)
}
