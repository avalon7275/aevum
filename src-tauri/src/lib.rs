mod commands;
mod config;
mod db;
mod error;
mod plugin_db;
mod poller;
mod tray;

use std::sync::{Arc, Mutex};

use tauri::Manager;

use config::settings::AppSettings;
use db::connection::init_db;
use poller::polling_loop::{self, PollingControl};

pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| {
                    log::error!("Failed to get app data dir: {}", e);
                    e
                })?;

            // Initialize database (read connection for UI queries)
            let db_path = app_data_dir.join("mixclock.db");
            let read_conn = init_db(&db_path).map_err(|e| {
                log::error!("Failed to initialize read database at {:?}: {}", db_path, e);
                e
            })?;

            // Write connection for the polling loop
            let write_conn = init_db(&db_path).map_err(|e| {
                log::error!("Failed to initialize write database at {:?}: {}", db_path, e);
                e
            })?;
            let write_conn = Arc::new(Mutex::new(write_conn));

            // Load settings
            let settings = AppSettings::load(&app_data_dir).unwrap_or_default();

            // Polling control
            let polling_control = Arc::new(Mutex::new(PollingControl { is_running: true, is_paused: false }));

            // Load plugin database
            let plugin_database = Arc::new(plugin_db::PluginDatabase::load());

            // Start the polling loop
            let poll_interval = settings.polling.interval_ms;
            let idle_threshold = settings.polling.idle_threshold_secs;
            let rest_continuous = settings.rest_reminder.continuous_minutes;
            let rest_cooldown = settings.rest_reminder.cooldown_minutes;
            polling_loop::start_polling(
                app.handle().clone(),
                write_conn.clone(),
                polling_control.clone(),
                plugin_database.clone(),
                poll_interval,
                idle_threshold,
                rest_continuous,
                rest_cooldown,
            );

            // Setup system tray - don't crash if it fails
            match tray::tray_manager::setup_tray(app.handle(), polling_control.clone()) {
                Ok(_) => log::info!("System tray initialized"),
                Err(e) => log::error!("Failed to setup system tray (app will continue without it): {}", e),
            }

            // Manage state for Tauri commands
            app.manage(Mutex::new(read_conn));
            app.manage(polling_control);
            app.manage(Mutex::new(settings));
            app.manage(plugin_database);

            // If launched with --minimized (autostart), hide to tray
            if std::env::args().any(|a| a == "--minimized") {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                    let _ = window.set_skip_taskbar(true);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::polling_commands::get_polling_status,
            commands::polling_commands::pause_polling,
            commands::polling_commands::resume_polling,
            commands::session_commands::get_active_session,
            commands::session_commands::get_sessions_for_date,
            commands::session_commands::get_recent_events,
            commands::session_commands::get_all_tracks,
            commands::session_commands::get_session_story,
            commands::session_commands::archive_track,
            commands::session_commands::unarchive_track,
            commands::dashboard_commands::get_day_summary,
            commands::dashboard_commands::get_week_summary,
            commands::dashboard_commands::get_year_heatmap,
            commands::dashboard_commands::get_track_detail,
            commands::dashboard_commands::get_week_comparison,
            commands::dashboard_commands::get_goal_streak,
            commands::dashboard_commands::save_goal_settings,
            commands::coach_commands::get_coach_data,
            commands::polling_commands::hide_to_tray,
            commands::settings_commands::get_app_settings,
            commands::settings_commands::save_app_settings,
            commands::settings_commands::get_autostart_enabled,
            commands::settings_commands::toggle_autostart,
            commands::update_commands::check_for_update,
            commands::platform_commands::check_platform_permissions,
            commands::billing_commands::create_billing_project,
            commands::billing_commands::get_all_billing_projects,
            commands::billing_commands::get_billing_project_detail,
            commands::billing_commands::update_billing_project,
            commands::billing_commands::delete_billing_project,
            commands::billing_commands::assign_track_to_billing_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aevum");
}
