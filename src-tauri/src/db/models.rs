use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub daw: String,
    pub first_seen: i64,
    pub last_seen: i64,
    pub total_seconds: i64,
    pub notes: String,
    pub archived: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: i64,
    pub project_id: i64,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub duration_secs: i64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub id: i64,
    pub session_id: i64,
    pub timestamp: i64,
    pub window_title: String,
    pub process_name: String,
    pub category: String,
    pub plugin_id: Option<i64>,
    pub raw_title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Plugin {
    pub id: i64,
    pub name: String,
    pub vendor: String,
    pub category: String,
    pub phase_hint: String,
    pub window_patterns: String,
    pub is_builtin: bool,
    pub user_added: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategorySpan {
    pub id: i64,
    pub session_id: i64,
    pub project_id: i64,
    pub category: String,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub duration_secs: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailySummary {
    pub id: i64,
    pub date: String,
    pub project_id: i64,
    pub total_seconds: i64,
    pub composing_secs: i64,
    pub arranging_secs: i64,
    pub mixing_secs: i64,
    pub sound_design_secs: i64,
    pub mastering_secs: i64,
    pub sound_selection_secs: i64,
    pub break_secs: i64,
    pub idle_secs: i64,
    pub session_count: i64,
}
