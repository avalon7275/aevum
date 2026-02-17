/// Parse a track/channel identifier from a DAW plugin window title.
///
/// Cubase plugin windows: "04 - Kontakt 8" → track "04"
/// FL Studio: "Mixer - Insert 3 - Pro-Q 3" → track "Insert 3"
/// Generic: "TrackName - PluginName" → track "TrackName"
///
/// Returns (track_hint, remainder) if a track prefix was found.
pub fn parse_track_hint(title: &str, daw_id: &str) -> Option<String> {
    match daw_id {
        "cubase" => parse_cubase_track(title),
        "fl_studio" => parse_fl_track(title),
        _ => parse_generic_track(title),
    }
}

/// Cubase: "04 - Kontakt 8" → "Track 04"
/// Cubase: "Audio 01 - Kontakt 8" → "Audio 01"
/// Cubase: "Cubase Pro Project - ..." → None (main window)
fn parse_cubase_track(title: &str) -> Option<String> {
    let lower = title.to_lowercase();

    // Skip main Cubase windows
    if lower.starts_with("cubase") || lower.contains("mixconsole") || lower.contains("transport") {
        return None;
    }

    // Pattern: "NN - PluginName" where NN is a number (track number)
    if let Some(dash_idx) = title.find(" - ") {
        let prefix = title[..dash_idx].trim();
        if !prefix.is_empty() {
            // Check if it's a pure number (track number) or a name
            if prefix.chars().all(|c| c.is_ascii_digit()) {
                return Some(format!("Track {}", prefix));
            }
            // Could be "Audio 01" or a track name
            return Some(prefix.to_string());
        }
    }

    None
}

/// FL Studio: "Mixer - Insert 3 - Pro-Q 3" → "Insert 3"
fn parse_fl_track(title: &str) -> Option<String> {
    let lower = title.to_lowercase();

    if lower.starts_with("fl studio") {
        return None;
    }

    // "Mixer - Insert N - Plugin"
    if lower.contains("insert") {
        if let Some(idx) = lower.find("insert") {
            let after = &title[idx..];
            if let Some(end) = after.find(" - ") {
                return Some(after[..end].to_string());
            }
            return Some(after.trim().to_string());
        }
    }

    parse_generic_track(title)
}

/// Generic: take everything before the first " - " if it looks like a track identifier
fn parse_generic_track(title: &str) -> Option<String> {
    if let Some(dash_idx) = title.find(" - ") {
        let prefix = title[..dash_idx].trim();
        // Skip if prefix is too long (probably not a track name)
        if !prefix.is_empty() && prefix.len() <= 40 {
            return Some(prefix.to_string());
        }
    }
    None
}
