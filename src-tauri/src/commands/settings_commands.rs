use std::sync::Mutex;

use tauri::{Manager, State};
use tauri_plugin_autostart::ManagerExt;

use crate::config::settings::AppSettings;
use crate::error::AppError;

#[tauri::command]
pub async fn get_app_settings(
    settings: State<'_, Mutex<AppSettings>>,
) -> Result<AppSettings, AppError> {
    let settings = settings.lock().map_err(|e| AppError::Settings(e.to_string()))?;
    Ok(settings.clone())
}

#[tauri::command]
pub async fn save_app_settings(
    new_settings: AppSettings,
    settings: State<'_, Mutex<AppSettings>>,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    let mut settings = settings.lock().map_err(|e| AppError::Settings(e.to_string()))?;
    *settings = new_settings;
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e: tauri::Error| AppError::Settings(e.to_string()))?;
    settings.save(&app_data_dir)
}

#[tauri::command]
pub async fn get_autostart_enabled(
    app_handle: tauri::AppHandle,
) -> Result<bool, AppError> {
    let manager = app_handle.autolaunch();
    manager.is_enabled().map_err(|e| AppError::Settings(e.to_string()))
}

#[tauri::command]
pub async fn toggle_autostart(
    app_handle: tauri::AppHandle,
) -> Result<bool, AppError> {
    let manager = app_handle.autolaunch();
    let enabled = manager.is_enabled().map_err(|e| AppError::Settings(e.to_string()))?;
    if enabled {
        manager.disable().map_err(|e| AppError::Settings(e.to_string()))?;
    } else {
        manager.enable().map_err(|e| AppError::Settings(e.to_string()))?;
    }
    Ok(!enabled)
}
