use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::db::queries::{events, projects, sessions};
use crate::plugin_db::PluginDatabase;
use crate::poller::activity_categorizer::ActivityCategorizer;
use crate::poller::daw_matcher;
use crate::poller::plugin_classifier;
use crate::poller::project_extractor;
use crate::poller::window_detector;

#[derive(Debug, Clone, Serialize)]
pub struct PollingStatus {
    pub is_running: bool,
    pub is_tracking: bool,
    pub current_daw: Option<String>,
    pub current_project: Option<String>,
    pub session_duration_secs: i64,
    pub current_category: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PollingTick {
    pub status: PollingStatus,
    pub window_title: String,
    pub process_name: String,
    pub timestamp: i64,
    pub detected_plugin: Option<String>,
    pub detected_category: Option<String>,
}

pub struct PollingControl {
    pub is_running: bool,
    pub is_paused: bool,
}

/// Start the polling loop as a background task.
pub fn start_polling(
    app_handle: AppHandle,
    write_conn: Arc<Mutex<Connection>>,
    control: Arc<Mutex<PollingControl>>,
    plugin_db: Arc<PluginDatabase>,
    interval_ms: u64,
    idle_threshold_secs: u64,
    rest_continuous_mins: u64,
    rest_cooldown_mins: u64,
) {
    std::thread::Builder::new()
        .name("aevum-poller".to_string())
        .spawn(move || {
            // Set thread to below-normal priority to never interfere with audio
            #[cfg(windows)]
            {
                use windows::Win32::System::Threading::{
                    GetCurrentThread, SetThreadPriority, THREAD_PRIORITY_BELOW_NORMAL,
                };
                unsafe {
                    let _ = SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_BELOW_NORMAL);
                }
            }
            #[cfg(target_os = "macos")]
            {
                use std::ffi::c_int;
                const QOS_CLASS_UTILITY: u32 = 0x11;
                extern "C" {
                    fn pthread_set_qos_class_self_np(qos_class: u32, relative_priority: c_int) -> c_int;
                }
                unsafe {
                    let _ = pthread_set_qos_class_self_np(QOS_CLASS_UTILITY, 0);
                }
            }

            let mut current_session_id: Option<i64> = None;
            let mut current_project_id: Option<i64> = None;
            let mut current_daw_name: Option<String> = None;
            let mut current_project_name: Option<String> = None;
            let mut last_daw_seen: i64 = 0;
            let mut session_started_at: i64 = 0;
            let mut daw_continuous = false; // Was DAW in foreground on the previous tick?

            let mut categorizer = ActivityCategorizer::new(idle_threshold_secs);

            // Track the active DAW id for plugin classification
            let mut current_daw_id: Option<String> = None;

            // Rest reminder state
            let rest_threshold = Duration::from_secs(rest_continuous_mins * 60);
            let rest_cooldown = Duration::from_secs(rest_cooldown_mins * 60);
            let mut continuous_active_since: Option<Instant> = None;
            let mut last_reminder_at: Option<Instant> = None;

            loop {
                // Check if we should stop or pause
                {
                    let ctrl = control.lock().unwrap();
                    if !ctrl.is_running {
                        break;
                    }
                    if ctrl.is_paused {
                        drop(ctrl);
                        let status = PollingStatus {
                            is_running: false,
                            is_tracking: current_session_id.is_some(),
                            current_daw: current_daw_name.clone(),
                            current_project: current_project_name.clone(),
                            session_duration_secs: if current_session_id.is_some() {
                                chrono::Utc::now().timestamp() - session_started_at
                            } else {
                                0
                            },
                            current_category: "paused".to_string(),
                        };
                        let tick = PollingTick {
                            status,
                            window_title: String::new(),
                            process_name: String::new(),
                            timestamp: chrono::Utc::now().timestamp(),
                            detected_plugin: None,
                            detected_category: None,
                        };
                        let _ = app_handle.emit("polling_tick", &tick);
                        std::thread::sleep(Duration::from_millis(interval_ms));
                        continue;
                    }
                }

                let now = chrono::Utc::now().timestamp();

                // Get the foreground window
                let snapshot = match window_detector::get_foreground_window() {
                    Ok(s) => s,
                    Err(e) => {
                        log::warn!("Window detection failed: {:?}", e);
                        let status = PollingStatus {
                            is_running: true,
                            is_tracking: current_session_id.is_some(),
                            current_daw: current_daw_name.clone(),
                            current_project: current_project_name.clone(),
                            session_duration_secs: 0,
                            current_category: categorizer.current_phase().to_string(),
                        };
                        let tick = PollingTick {
                            status,
                            window_title: format!("ERROR: {:?}", e),
                            process_name: "detection_failed".to_string(),
                            timestamp: now,
                            detected_plugin: None,
                            detected_category: None,
                        };
                        let _ = app_handle.emit("polling_tick", &tick);
                        std::thread::sleep(Duration::from_millis(interval_ms));
                        continue;
                    }
                };

                // Check if it's a DAW
                let daw_match =
                    daw_matcher::match_daw(&snapshot.process_name, &snapshot.title);

                // System-level idle detection: if user hasn't touched mouse/keyboard,
                // treat as inactive even if DAW is in the foreground.
                let system_idle_secs = window_detector::get_system_idle_secs();
                let system_is_idle = system_idle_secs >= idle_threshold_secs;

                // DAW is only "actively used" if it's in the foreground AND user is not idle
                let is_daw = daw_match.is_some() && !system_is_idle;

                // Classify the window and determine phase
                let mut detected_plugin: Option<String> = None;
                let mut detected_plugin_category: Option<String> = None;
                let mut raw_phase = "composing".to_string();

                if is_daw {
                    let daw = daw_match.as_ref().unwrap();
                    let was_continuous = daw_continuous;
                    // How long since the DAW was last in foreground?
                    // A brief gap (save dialog, file picker) should NOT break continuity.
                    let secs_since_last_daw = if last_daw_seen > 0 { now - last_daw_seen } else { i64::MAX };
                    let effectively_continuous = was_continuous || secs_since_last_daw < 15;
                    daw_continuous = true;
                    last_daw_seen = now;

                    // Classify this window (plugin match or DAW view heuristic)
                    // Always use the detected DAW id, not the stored one (handles DAW switches)
                    let daw_id = daw.id;
                    let classification =
                        plugin_classifier::classify_window(&snapshot.title, daw_id, &plugin_db);
                    raw_phase = classification.phase;
                    detected_plugin = classification.plugin_name;
                    detected_plugin_category = classification.plugin_category;

                    // Extract project name from the main DAW window title.
                    // On macOS without Screen Recording permission, titles are empty.
                    // Fall back to "Untitled" only when the title is empty (macOS case).
                    // Do NOT fall back for non-empty titles (e.g. plugin windows, mixers)
                    // as that would overwrite the real project name.
                    let project_name =
                        project_extractor::extract_project_name(daw.id, &snapshot.title)
                            .or_else(|| {
                                if snapshot.title.trim().is_empty() {
                                    Some("Untitled".to_string())
                                } else {
                                    None
                                }
                            });

                    if let Some(ref proj_name) = project_name {
                        let name_changed = match &current_project_name {
                            Some(current) => current != proj_name,
                            None => false,
                        };

                        // Detect if the DAW itself changed (e.g. Cubase -> Studio One)
                        let daw_changed = match &current_daw_id {
                            Some(current) => current != daw.id,
                            None => false,
                        };

                        if current_session_id.is_none() {
                            // No active session: start a new one
                            let conn = write_conn.lock().unwrap();
                            let project_id =
                                projects::upsert_project(&conn, proj_name, daw.id, now)
                                    .unwrap_or(0);
                            let session_id =
                                sessions::create_session(&conn, project_id, now).unwrap_or(0);

                            current_session_id = Some(session_id);
                            current_project_id = Some(project_id);
                            current_daw_id = Some(daw.id.to_string());
                            current_daw_name = Some(daw.name.to_string());
                            current_project_name = Some(proj_name.clone());
                            session_started_at = now;
                            categorizer.reset();

                            log::info!(
                                "New session: {} in {} (session {})",
                                proj_name, daw.name, session_id
                            );
                        } else if daw_changed || (name_changed && !effectively_continuous) {
                            // Different DAW, or project name changed after a gap:
                            // end old session and start a new one
                            let conn = write_conn.lock().unwrap();

                            if let Some(sid) = current_session_id {
                                let _ = sessions::end_session(&conn, sid, now);
                            }

                            let project_id =
                                projects::upsert_project(&conn, proj_name, daw.id, now)
                                    .unwrap_or(0);
                            let session_id =
                                sessions::create_session(&conn, project_id, now).unwrap_or(0);

                            current_session_id = Some(session_id);
                            current_project_id = Some(project_id);
                            current_daw_id = Some(daw.id.to_string());
                            current_daw_name = Some(daw.name.to_string());
                            current_project_name = Some(proj_name.clone());
                            session_started_at = now;
                            categorizer.reset();

                            log::info!(
                                "DAW/project switch: {} in {} (session {})",
                                proj_name, daw.name, session_id
                            );
                        } else if name_changed && effectively_continuous {
                            // DAW was in foreground continuously (or only briefly away
                            // for a save dialog / file picker), name changed = rename / Save As
                            // Keep the same session, just update the project name
                            if let Some(pid) = current_project_id {
                                let conn = write_conn.lock().unwrap();
                                let _ = projects::rename_project(&conn, pid, proj_name, now);
                            }
                            current_project_name = Some(proj_name.clone());
                            log::info!("Project renamed to: {}", proj_name);
                        }
                    }
                } else {
                    // Not a DAW in foreground, OR system is idle (no mouse/keyboard input)
                    daw_continuous = false;

                    let seconds_since_daw = if last_daw_seen > 0 {
                        now - last_daw_seen
                    } else {
                        0
                    };

                    if seconds_since_daw > idle_threshold_secs as i64 {
                        if let Some(sid) = current_session_id.take() {
                            let conn = write_conn.lock().unwrap();
                            let _ = sessions::end_session(&conn, sid, last_daw_seen);
                            current_project_id = None;
                            current_daw_id = None;
                            current_daw_name = None;
                            current_project_name = None;
                            categorizer.reset();
                            log::info!("Session ended due to idle timeout");
                        }
                    }
                }

                // Run categorizer state machine
                let smoothed_phase = categorizer.tick(is_daw, &raw_phase, now);

                // Log event to database if in a session (DAW and non-DAW for focus tracking)
                if let Some(sid) = current_session_id {
                    let conn = write_conn.lock().unwrap();
                    let _ = events::insert_event(
                        &conn,
                        sid,
                        now,
                        &snapshot.title,
                        &snapshot.process_name,
                        &smoothed_phase,
                        None,
                        Some(&snapshot.title),
                    );
                }

                // Suppress unused variable warning
                let _ = current_project_id;

                // Rest reminder logic
                if current_session_id.is_some() && is_daw {
                    if continuous_active_since.is_none() {
                        continuous_active_since = Some(Instant::now());
                    }
                    if let Some(since) = continuous_active_since {
                        let elapsed = Instant::now().duration_since(since);
                        if elapsed >= rest_threshold {
                            let should_remind = match last_reminder_at {
                                None => true,
                                Some(last) => Instant::now().duration_since(last) >= rest_cooldown,
                            };
                            if should_remind {
                                let mins = elapsed.as_secs() / 60;
                                let _ = app_handle.emit("rest_reminder", mins);
                                last_reminder_at = Some(Instant::now());
                                log::info!("Rest reminder sent after {} minutes", mins);
                            }
                        }
                    }
                } else {
                    continuous_active_since = None;
                }

                // Emit status to frontend
                let status = PollingStatus {
                    is_running: true,
                    is_tracking: current_session_id.is_some(),
                    current_daw: current_daw_name.clone(),
                    current_project: current_project_name.clone(),
                    session_duration_secs: if current_session_id.is_some() {
                        now - session_started_at
                    } else {
                        0
                    },
                    current_category: smoothed_phase,
                };

                let tick = PollingTick {
                    status,
                    window_title: snapshot.title,
                    process_name: snapshot.process_name,
                    timestamp: now,
                    detected_plugin,
                    detected_category: detected_plugin_category,
                };

                let _ = app_handle.emit("polling_tick", &tick);

                std::thread::sleep(Duration::from_millis(interval_ms));
            }

            log::info!("Polling loop stopped");
        })
        .expect("Failed to spawn polling thread");
}
