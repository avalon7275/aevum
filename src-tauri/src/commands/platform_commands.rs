use serde::Serialize;

use crate::poller::window_detector;

#[derive(Debug, Clone, Serialize)]
pub struct PlatformPermissions {
    pub screen_recording: bool,
    pub platform: String,
}

#[tauri::command]
pub async fn check_platform_permissions() -> Result<PlatformPermissions, crate::error::AppError> {
    let platform = if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(windows) {
        "windows"
    } else {
        "unknown"
    };

    Ok(PlatformPermissions {
        screen_recording: window_detector::has_screen_recording_permission(),
        platform: platform.to_string(),
    })
}
