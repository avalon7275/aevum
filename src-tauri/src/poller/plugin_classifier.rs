use crate::plugin_db::PluginDatabase;

/// Result of classifying a window during a DAW session.
#[derive(Debug, Clone)]
pub struct ClassificationResult {
    pub phase: String,
    pub plugin_name: Option<String>,
    pub plugin_category: Option<String>,
}

/// Classify a window title into a production phase.
/// Priority: known plugin > DAW view heuristics > main DAW window > unknown plugin fallback.
pub fn classify_window(
    title: &str,
    daw_id: &str,
    plugin_db: &PluginDatabase,
) -> ClassificationResult {
    // 1. Try known plugin match (curated database with metadata)
    if let Some(plugin) = plugin_db.match_title(title) {
        return ClassificationResult {
            phase: plugin.phase_hint.clone(),
            plugin_name: Some(plugin.name.clone()),
            plugin_category: Some(plugin.category.clone()),
        };
    }

    // 2. Try DAW-specific view heuristics (Key Editor, MixConsole, etc.)
    if let Some(phase) = classify_daw_view(title, daw_id) {
        return ClassificationResult {
            phase,
            plugin_name: None,
            plugin_category: None,
        };
    }

    // 3. Check if this is the main DAW window (title contains the DAW name)
    if is_main_daw_window(title, daw_id) {
        return ClassificationResult {
            phase: "composing".to_string(),
            plugin_name: None,
            plugin_category: None,
        };
    }

    // 4. Unknown plugin: a window in the DAW process that isn't a known view
    // or the main project window. This catches third-party and stock plugins
    // not yet in the database.
    let name = clean_plugin_title(title);
    if name.len() >= 2 {
        ClassificationResult {
            phase: "composing".to_string(),
            plugin_name: Some(name),
            plugin_category: Some("plugin".to_string()),
        }
    } else {
        // Title too short/empty to be a meaningful plugin name
        ClassificationResult {
            phase: "composing".to_string(),
            plugin_name: None,
            plugin_category: None,
        }
    }
}

/// Check if the window title looks like the main DAW project window.
fn is_main_daw_window(title: &str, daw_id: &str) -> bool {
    let lower = title.to_lowercase();
    match daw_id {
        "cubase" => lower.contains("cubase"),
        "ableton" => lower.contains("ableton"),
        "fl_studio" => lower.contains("fl studio"),
        "reaper" => lower.contains("reaper"),
        "pro_tools" => lower.contains("pro tools"),
        "studio_one" => lower.contains("studio one"),
        "bitwig" => lower.contains("bitwig"),
        "logic" => lower.contains("logic pro"),
        _ => false,
    }
}

/// Clean up a plugin window title to extract a usable plugin name.
fn clean_plugin_title(title: &str) -> String {
    let mut s = title.to_string();

    // Strip DAW track-number prefix: "04 - Plugin Name" -> "Plugin Name"
    if let Some(idx) = s.find(" - ") {
        let prefix = &s[..idx];
        if prefix.chars().all(|c| c.is_ascii_digit()) {
            s = s[idx + 3..].to_string();
        }
    }

    s.trim().to_string()
}

/// Dispatch to DAW-specific view classification.
/// Returns Some(phase) if a known DAW view is detected, None otherwise.
fn classify_daw_view(title: &str, daw_id: &str) -> Option<String> {
    match daw_id {
        "cubase" => classify_cubase_view(title),
        "ableton" => classify_ableton_view(title),
        "fl_studio" => classify_fl_view(title),
        "reaper" => classify_reaper_view(title),
        "studio_one" => classify_studio_one_view(title),
        "logic" => classify_logic_view(title),
        _ => None,
    }
}

fn classify_cubase_view(title: &str) -> Option<String> {
    let lower = title.to_lowercase();
    if lower.contains("key editor")
        || lower.contains("score editor")
        || lower.contains("drum editor")
        || lower.contains("in-place editor")
        || lower.contains("list editor")
    {
        Some("composing".to_string())
    } else if lower.contains("mixconsole") || lower.contains("mix console") {
        Some("mixing".to_string())
    } else if lower.contains("mediabay")
        || lower.contains("media bay")
        || lower.contains("loop browser")
        || lower.contains("sound browser")
    {
        Some("sound_selection".to_string())
    } else if lower.contains("sample editor") || lower.contains("audio editor") {
        Some("mixing".to_string())
    } else if lower.contains("transport") {
        Some("composing".to_string())
    } else {
        None
    }
}

fn classify_ableton_view(title: &str) -> Option<String> {
    let lower = title.to_lowercase();
    if lower.contains("session view") {
        Some("composing".to_string())
    } else if lower.contains("arrangement") {
        Some("composing".to_string())
    } else {
        None
    }
}

fn classify_fl_view(title: &str) -> Option<String> {
    let lower = title.to_lowercase();
    if lower.contains("piano roll") {
        Some("composing".to_string())
    } else if lower.contains("mixer") {
        Some("mixing".to_string())
    } else if lower.contains("channel rack") || lower.contains("step sequencer") {
        Some("composing".to_string())
    } else if lower.contains("browser") {
        Some("sound_selection".to_string())
    } else if lower.contains("playlist") {
        Some("composing".to_string())
    } else {
        None
    }
}

fn classify_reaper_view(title: &str) -> Option<String> {
    let lower = title.to_lowercase();
    if lower.contains("midi editor") || lower.contains("piano roll") {
        Some("composing".to_string())
    } else if lower.contains("mixer") || lower.contains("fx chain") {
        Some("mixing".to_string())
    } else if lower.contains("media explorer") {
        Some("sound_selection".to_string())
    } else {
        None
    }
}

fn classify_studio_one_view(title: &str) -> Option<String> {
    let lower = title.to_lowercase();
    if lower.contains("editor") && lower.contains("note") {
        Some("composing".to_string())
    } else if lower.contains("console") || lower.contains("mixer") {
        Some("mixing".to_string())
    } else if lower.contains("browser") {
        Some("sound_selection".to_string())
    } else {
        None
    }
}

fn classify_logic_view(title: &str) -> Option<String> {
    let lower = title.to_lowercase();
    if lower.contains("piano roll") || lower.contains("score editor") || lower.contains("step editor") {
        Some("composing".to_string())
    } else if lower.contains("mixer") {
        Some("mixing".to_string())
    } else if lower.contains("loop browser") || lower.contains("sound library") {
        Some("sound_selection".to_string())
    } else {
        None
    }
}
