use std::sync::{Arc, Mutex};

use tauri::State;

use crate::error::AppError;
use crate::poller::polling_loop::{PollingControl, PollingStatus};

#[tauri::command]
pub async fn get_polling_status(
    control: State<'_, Arc<Mutex<PollingControl>>>,
) -> Result<PollingStatus, AppError> {
    let ctrl = control.lock().map_err(|e| AppError::Polling(e.to_string()))?;
    Ok(PollingStatus {
        is_running: ctrl.is_running && !ctrl.is_paused,
        is_tracking: false,
        current_daw: None,
        current_project: None,
        session_duration_secs: 0,
        current_category: if ctrl.is_paused { "paused".to_string() } else { "idle".to_string() },
    })
}

#[tauri::command]
pub async fn pause_polling(
    control: State<'_, Arc<Mutex<PollingControl>>>,
) -> Result<(), AppError> {
    let mut ctrl = control.lock().map_err(|e| AppError::Polling(e.to_string()))?;
    ctrl.is_paused = true;
    log::info!("Polling paused");
    Ok(())
}

#[tauri::command]
pub async fn resume_polling(
    control: State<'_, Arc<Mutex<PollingControl>>>,
) -> Result<(), AppError> {
    let mut ctrl = control.lock().map_err(|e| AppError::Polling(e.to_string()))?;
    ctrl.is_paused = false;
    log::info!("Polling resumed");
    Ok(())
}

#[tauri::command]
pub async fn hide_to_tray(window: tauri::WebviewWindow) -> Result<(), AppError> {
    let _ = window.set_skip_taskbar(true);
    let _ = window.hide();
    Ok(())
}
