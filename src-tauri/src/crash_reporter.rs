use std::fs;
use std::io::Write;
use std::path::PathBuf;

/// Returns the app data dir without Tauri APIs.
/// Windows: %APPDATA%/com.aevum.tracker
/// macOS: ~/Library/Application Support/com.aevum.tracker
fn app_data_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var("APPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("com.aevum.tracker"))
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME").ok().map(|p| {
            PathBuf::from(p)
                .join("Library")
                .join("Application Support")
                .join("com.aevum.tracker")
        })
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        None
    }
}

/// Install a panic hook that writes crash details to crash.log.
/// Call this BEFORE anything else in main().
pub fn install_panic_hook() {
    let default_hook = std::panic::take_hook();

    std::panic::set_hook(Box::new(move |info| {
        // Call the default hook first (prints to stderr)
        default_hook(info);

        let message = if let Some(s) = info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic".to_string()
        };

        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown location".to_string());

        let crash_data = format!(
            "version={}\nos={}\narch={}\ntimestamp={}\nlocation={}\nmessage={}\n",
            env!("CARGO_PKG_VERSION"),
            std::env::consts::OS,
            std::env::consts::ARCH,
            chrono::Utc::now().to_rfc3339(),
            location,
            message,
        );

        if let Some(dir) = app_data_dir() {
            let _ = fs::create_dir_all(&dir);
            let path = dir.join("crash.log");
            if let Ok(mut f) = fs::File::create(&path) {
                let _ = f.write_all(crash_data.as_bytes());
            }
        }
    }));
}

/// Check for a crash log from a previous run, send it, and delete it.
/// Called during Tauri setup after the app data dir is available.
pub fn check_and_send_crash_report(app_data_dir: &std::path::Path, supabase_url: &str) {
    let crash_path = app_data_dir.join("crash.log");
    if !crash_path.exists() {
        return;
    }

    if supabase_url.is_empty() {
        log::warn!("No Supabase URL configured, deleting crash log");
        let _ = fs::remove_file(&crash_path);
        return;
    }

    let content = match fs::read_to_string(&crash_path) {
        Ok(c) => c,
        Err(_) => {
            let _ = fs::remove_file(&crash_path);
            return;
        }
    };

    // Parse the crash log
    let mut version = "unknown".to_string();
    let mut os = "unknown".to_string();
    let mut arch = "unknown".to_string();
    let mut message = "unknown".to_string();

    for line in content.lines() {
        if let Some(v) = line.strip_prefix("version=") {
            version = v.to_string();
        } else if let Some(v) = line.strip_prefix("os=") {
            os = v.to_string();
        } else if let Some(v) = line.strip_prefix("arch=") {
            arch = v.to_string();
        } else if let Some(v) = line.strip_prefix("message=") {
            message = v.to_string();
        }
    }

    let body = serde_json::json!({
        "app_version": version,
        "os": os,
        "arch": arch,
        "panic_message": message,
        "backtrace": content,
        "app_data_dir": app_data_dir.to_string_lossy(),
    });

    let url = format!("{}/functions/v1/crash-report", supabase_url);

    // Fire-and-forget: if send fails, leave the file for next time
    match ureq::post(&url)
        .set("Content-Type", "application/json")
        .send_string(&body.to_string())
    {
        Ok(resp) if resp.status() == 200 => {
            let _ = fs::remove_file(&crash_path);
            log::info!("Crash report sent successfully");
        }
        Ok(resp) => {
            log::warn!("Crash report endpoint returned {}", resp.status());
        }
        Err(e) => {
            log::warn!(
                "Failed to send crash report (will retry next launch): {}",
                e
            );
        }
    }
}