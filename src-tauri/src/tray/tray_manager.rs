use std::sync::{Arc, Mutex};

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};
use tauri_plugin_autostart::ManagerExt;

use crate::poller::polling_loop::PollingControl;

pub fn setup_tray(
    app: &AppHandle,
    polling_control: Arc<Mutex<PollingControl>>,
) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show Dashboard", true, None::<&str>)?;
    let pause = MenuItem::with_id(app, "pause", "Pause Tracking", true, None::<&str>)?;

    // Autostart menu item: show current state
    let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);
    let autostart_text = if autostart_enabled {
        "Disable Auto-start"
    } else {
        "Enable Auto-start"
    };
    let autostart = MenuItem::with_id(app, "autostart", autostart_text, true, None::<&str>)?;

    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &pause, &autostart, &quit])?;

    // Decode PNG to raw RGBA pixels for Tauri's Image::new_owned
    let png_bytes = include_bytes!("../../icons/32x32.png");
    let decoder = png::Decoder::new(std::io::Cursor::new(png_bytes));
    let mut reader = decoder.read_info()?;
    let mut buf = vec![0u8; reader.output_buffer_size()];
    let info = reader.next_frame(&mut buf)?;
    let rgba = buf[..info.buffer_size()].to_vec();

    let pause_clone = pause.clone();
    let autostart_clone = autostart.clone();
    let control_clone = polling_control;

    let _tray = TrayIconBuilder::new()
        .icon(Image::new_owned(rgba, info.width, info.height))
        .tooltip("Aevum - Not tracking")
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_skip_taskbar(false);
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "pause" => {
                let mut ctrl = control_clone.lock().unwrap();
                ctrl.is_paused = !ctrl.is_paused;
                let paused = ctrl.is_paused;
                drop(ctrl);
                let _ = pause_clone.set_text(if paused {
                    "Resume Tracking"
                } else {
                    "Pause Tracking"
                });
                log::info!(
                    "Tray: tracking {}",
                    if paused { "paused" } else { "resumed" }
                );
            }
            "autostart" => {
                let manager = app.autolaunch();
                let enabled = manager.is_enabled().unwrap_or(false);
                if enabled {
                    let _ = manager.disable();
                    let _ = autostart_clone.set_text("Enable Auto-start");
                    log::info!("Auto-start disabled");
                } else {
                    let _ = manager.enable();
                    let _ = autostart_clone.set_text("Disable Auto-start");
                    log::info!("Auto-start enabled");
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_skip_taskbar(false);
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
