use rusqlite::Connection;
use std::path::Path;

use crate::error::AppError;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS billing_projects (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    hourly_rate     REAL NOT NULL,
    created_at      INTEGER NOT NULL,
    archived        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_billing_projects_name ON billing_projects(name);

CREATE TABLE IF NOT EXISTS tracks (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    daw             TEXT NOT NULL,
    first_seen      INTEGER NOT NULL,
    last_seen       INTEGER NOT NULL,
    total_seconds   INTEGER NOT NULL DEFAULT 0,
    notes           TEXT DEFAULT '',
    archived        INTEGER NOT NULL DEFAULT 0,
    billing_project_id INTEGER REFERENCES billing_projects(id)
);
CREATE INDEX IF NOT EXISTS idx_tracks_name ON tracks(name);
CREATE INDEX IF NOT EXISTS idx_tracks_last_seen ON tracks(last_seen);

CREATE TABLE IF NOT EXISTS sessions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id        INTEGER NOT NULL,
    started_at      INTEGER NOT NULL,
    ended_at        INTEGER,
    duration_secs   INTEGER NOT NULL DEFAULT 0,
    is_active       INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (track_id) REFERENCES tracks(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_track ON sessions(track_id);
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
    track_id        INTEGER NOT NULL,
    category        TEXT NOT NULL,
    started_at      INTEGER NOT NULL,
    ended_at        INTEGER,
    duration_secs   INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (track_id) REFERENCES tracks(id)
);
CREATE INDEX IF NOT EXISTS idx_spans_session ON category_spans(session_id);
CREATE INDEX IF NOT EXISTS idx_spans_started ON category_spans(started_at);

CREATE TABLE IF NOT EXISTS daily_summaries (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    date            TEXT NOT NULL,
    track_id        INTEGER NOT NULL,
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
    UNIQUE(date, track_id),
    FOREIGN KEY (track_id) REFERENCES tracks(id)
);
CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_summaries(date);
"#;

/// Run database migrations based on PRAGMA user_version.
fn run_migrations(conn: &Connection) -> Result<(), AppError> {
    let version: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;

    if version == 0 {
        // Check if this is an existing database with the old "projects" table
        let has_projects: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='projects'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map(|count| count > 0)?;

        if has_projects {
            log::info!("Migrating V0 -> V1: renaming projects -> tracks");
            conn.execute_batch(
                "PRAGMA foreign_keys=OFF;
                 ALTER TABLE projects RENAME TO tracks;
                 ALTER TABLE sessions RENAME COLUMN project_id TO track_id;
                 ALTER TABLE category_spans RENAME COLUMN project_id TO track_id;
                 ALTER TABLE daily_summaries RENAME COLUMN project_id TO track_id;
                 DROP INDEX IF EXISTS idx_projects_name;
                 DROP INDEX IF EXISTS idx_projects_last_seen;
                 DROP INDEX IF EXISTS idx_sessions_project;
                 CREATE INDEX IF NOT EXISTS idx_tracks_name ON tracks(name);
                 CREATE INDEX IF NOT EXISTS idx_tracks_last_seen ON tracks(last_seen);
                 CREATE INDEX IF NOT EXISTS idx_sessions_track ON sessions(track_id);
                 PRAGMA user_version = 1;
                 PRAGMA foreign_keys=ON;",
            )?;
            log::info!("Migration V1 complete");
        } else {
            // Fresh install: just set the version
            conn.execute_batch("PRAGMA user_version = 1;")?;
        }
    }

    if version <= 1 {
        // V1 -> V2: Add archived column to tracks table (only if it doesn't exist)
        let has_archived: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('tracks') WHERE name='archived'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map(|count| count > 0)?;

        if !has_archived {
            log::info!("Migrating V1 -> V2: adding archived column to tracks");
            conn.execute_batch(
                "ALTER TABLE tracks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;",
            )?;
            log::info!("Migration V2 complete");
        }
        conn.execute_batch("PRAGMA user_version = 2;")?;
    }

    if version <= 2 {
        log::info!("Migrating V2 -> V3: adding billing_projects table");

        // Temporarily disable foreign keys for ALTER TABLE with REFERENCES clause
        conn.execute_batch("PRAGMA foreign_keys=OFF;")?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS billing_projects (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                name            TEXT NOT NULL UNIQUE,
                hourly_rate     REAL NOT NULL,
                created_at      INTEGER NOT NULL,
                archived        INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_billing_projects_name ON billing_projects(name);",
        )?;

        // Check if billing_project_id column already exists
        let has_billing_project_id: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('tracks') WHERE name='billing_project_id'",
                [],
                |row| row.get::<_, i64>(0),
            )
            .map(|count| count > 0)?;

        if !has_billing_project_id {
            conn.execute_batch(
                "ALTER TABLE tracks ADD COLUMN billing_project_id INTEGER REFERENCES billing_projects(id);",
            )?;
        }

        conn.execute_batch("PRAGMA foreign_keys=ON;")?;
        conn.execute_batch("PRAGMA user_version = 3;")?;
        log::info!("Migration V3 complete");
    }

    Ok(())
}

pub fn init_db(db_path: &Path) -> Result<Connection, AppError> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    log::info!("Opening database at {:?}", db_path);
    let conn = Connection::open(db_path)?;

    conn.execute_batch("PRAGMA journal_mode=WAL;")?;
    conn.execute_batch("PRAGMA synchronous=NORMAL;")?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;

    run_migrations(&conn).map_err(|e| {
        log::error!("Database migration failed: {}", e);
        e
    })?;
    conn.execute_batch(SCHEMA).map_err(|e| {
        log::error!("Schema creation failed: {}", e);
        AppError::Database(e.to_string())
    })?;

    log::info!("Database initialized successfully");
    Ok(conn)
}
