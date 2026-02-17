use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub polling: PollingSettings,
    pub ui: UiSettings,
    pub rest_reminder: RestReminderSettings,
    pub goals: GoalSettings,
    pub first_run_complete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PollingSettings {
    pub interval_ms: u64,
    pub idle_threshold_secs: u64,
    pub break_threshold_secs: u64,
    pub auto_start: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiSettings {
    pub start_minimized: bool,
    pub close_to_tray: bool,
    pub show_notifications: bool,
    pub day_start_hour: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestReminderSettings {
    pub enabled: bool,
    pub continuous_minutes: u64,
    pub cooldown_minutes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoalSettings {
    pub enabled: bool,
    pub daily_goal_minutes: u64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            polling: PollingSettings {
                interval_ms: 2000,
                idle_threshold_secs: 120,
                break_threshold_secs: 30,
                auto_start: true,
            },
            ui: UiSettings {
                start_minimized: false,
                close_to_tray: true,
                show_notifications: true,
                day_start_hour: 5,
            },
            rest_reminder: RestReminderSettings {
                enabled: true,
                continuous_minutes: 120,
                cooldown_minutes: 60,
            },
            goals: GoalSettings {
                enabled: true,
                daily_goal_minutes: 240,
            },
            first_run_complete: false,
        }
    }
}

impl AppSettings {
    pub fn load(app_data_dir: &Path) -> Result<Self, AppError> {
        let path = app_data_dir.join("settings.toml");
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = std::fs::read_to_string(&path)?;
        let settings: AppSettings = toml::from_str(&content)?;
        Ok(settings)
    }

    pub fn save(&self, app_data_dir: &Path) -> Result<(), AppError> {
        std::fs::create_dir_all(app_data_dir)?;
        let path = app_data_dir.join("settings.toml");
        let content = toml::to_string_pretty(self)?;
        std::fs::write(&path, content)?;
        Ok(())
    }
}
