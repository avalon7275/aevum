-- Crash reports table for silent auto-reporting from the desktop app.
-- No RLS policies needed — inserts come from the edge function using
-- service_role key, which bypasses RLS. RLS is enabled to block all
-- public/anon access.
CREATE TABLE IF NOT EXISTS crash_reports (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    app_version     TEXT NOT NULL,
    os              TEXT NOT NULL,
    arch            TEXT NOT NULL,
    panic_message   TEXT NOT NULL,
    backtrace       TEXT,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    app_data_dir    TEXT
);

ALTER TABLE crash_reports ENABLE ROW LEVEL SECURITY;