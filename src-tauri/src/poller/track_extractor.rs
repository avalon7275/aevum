/// Extract the track name from a DAW window title.
/// Each DAW has a different title format, so we dispatch based on daw_id.
pub fn extract_track_name(daw_id: &str, window_title: &str) -> Option<String> {
    let name = match daw_id {
        "cubase" => extract_cubase(window_title),
        "ableton" => extract_ableton(window_title),
        "fl_studio" => extract_fl_studio(window_title),
        "reaper" => extract_reaper(window_title),
        "pro_tools" => extract_pro_tools(window_title),
        "studio_one" => extract_studio_one(window_title),
        "bitwig" => extract_bitwig(window_title),
        "logic" => extract_logic(window_title),
        _ => extract_generic(window_title),
    };

    // Clean up: trim whitespace and filter out empty/too-short names
    name.map(|n| n.trim().to_string())
        .filter(|n| n.len() >= 2)
}

/// Cubase 14+: "Cubase Pro Project - My Song" -> "My Song"
/// Cubase older: "My Song - Cubase Pro 13" -> "My Song"
/// Plugin windows like "04 - Kontakt 8" or "Transport Panel" -> None
fn extract_cubase(title: &str) -> Option<String> {
    let lower = title.to_lowercase();

    // Cubase 14+ format: "Cubase Pro Project - ProjectName"
    if lower.starts_with("cubase") {
        if let Some(idx) = title.find(" - ") {
            let name = &title[idx + 3..];
            if !name.is_empty() {
                return Some(name.to_string());
            }
        }
        return None;
    }

    // Older format: "My Song - Cubase Pro 13"
    if let Some(idx) = lower.rfind(" - cubase") {
        let name = &title[..idx];
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }

    None
}

/// Ableton: "My Track - Ableton Live 12" -> "My Track"
fn extract_ableton(title: &str) -> Option<String> {
    let lower = title.to_lowercase();
    if let Some(idx) = lower.rfind(" - ableton") {
        let name = &title[..idx];
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }
    // Some versions: "My Track [path]"
    if let Some(idx) = title.find(" [") {
        let name = &title[..idx];
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }
    None
}

/// FL Studio: "FL Studio 2025 - My Song.flp" -> "My Song"
fn extract_fl_studio(title: &str) -> Option<String> {
    let lower = title.to_lowercase();
    // Pattern: "FL Studio ... - TrackName.flp"
    if let Some(idx) = lower.find("fl studio") {
        let after_fl = &title[idx..];
        if let Some(dash_idx) = after_fl.find(" - ") {
            let mut name = after_fl[dash_idx + 3..].to_string();
            // Strip .flp extension
            if name.to_lowercase().ends_with(".flp") {
                name = name[..name.len() - 4].to_string();
            }
            if !name.is_empty() {
                return Some(name);
            }
        }
    }
    None
}

/// Reaper: "My Song - REAPER v7.25" -> "My Song"
fn extract_reaper(title: &str) -> Option<String> {
    let lower = title.to_lowercase();
    if let Some(idx) = lower.rfind(" - reaper") {
        let name = &title[..idx];
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }
    None
}

/// Pro Tools: "My Song - Pro Tools" -> "My Song"
fn extract_pro_tools(title: &str) -> Option<String> {
    let lower = title.to_lowercase();
    if let Some(idx) = lower.rfind(" - pro tools") {
        let name = &title[..idx];
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }
    None
}

/// Studio One: "My Song - Studio One" -> "My Song"
/// Also handles: "My Song - Studio One Professional 7.2.2", "My Song - PreSonus Studio One", etc.
fn extract_studio_one(title: &str) -> Option<String> {
    let lower = title.to_lowercase();

    // Try exact pattern first: " - Studio One"
    if let Some(idx) = lower.rfind(" - studio one") {
        let name = &title[..idx];
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }

    // Studio One 7+ may use "PreSonus Studio One" in the title
    if let Some(idx) = lower.rfind(" - presonus studio one") {
        let name = &title[..idx];
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }

    // Handle "Song - Studio One Professional X.Y.Z" variants
    if let Some(idx) = lower.rfind(" - studio one professional") {
        let name = &title[..idx];
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }

    // Handle "Song - Studio One Artist X.Y.Z" variants
    if let Some(idx) = lower.rfind(" - studio one artist") {
        let name = &title[..idx];
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }

    None
}

/// Bitwig: "My Song - Bitwig Studio 5.2" -> "My Song"
fn extract_bitwig(title: &str) -> Option<String> {
    let lower = title.to_lowercase();
    if let Some(idx) = lower.rfind(" - bitwig") {
        let name = &title[..idx];
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }
    None
}

/// Logic Pro: "My Song - Logic Pro" -> "My Song"
fn extract_logic(title: &str) -> Option<String> {
    let lower = title.to_lowercase();
    if let Some(idx) = lower.rfind(" - logic pro") {
        let name = &title[..idx];
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }
    None
}

/// Generic fallback: take everything before the last " - "
fn extract_generic(title: &str) -> Option<String> {
    if let Some(idx) = title.rfind(" - ") {
        let name = &title[..idx];
        if !name.is_empty() {
            return Some(name.to_string());
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cubase() {
        assert_eq!(
            extract_track_name("cubase", "My Song - Cubase Pro 14"),
            Some("My Song".to_string())
        );
    }

    #[test]
    fn test_fl_studio() {
        assert_eq!(
            extract_track_name("fl_studio", "FL Studio 2025 - My Song.flp"),
            Some("My Song".to_string())
        );
    }

    #[test]
    fn test_reaper() {
        assert_eq!(
            extract_track_name("reaper", "Epic Cue - REAPER v7.25"),
            Some("Epic Cue".to_string())
        );
    }

    #[test]
    fn test_ableton() {
        assert_eq!(
            extract_track_name("ableton", "My Track - Ableton Live 12"),
            Some("My Track".to_string())
        );
    }

    #[test]
    fn test_no_track() {
        // DAW at start screen, no track open
        assert_eq!(extract_track_name("cubase", "Cubase Pro 14"), None);
    }

    #[test]
    fn test_studio_one_classic() {
        assert_eq!(
            extract_track_name("studio_one", "My Song - Studio One"),
            Some("My Song".to_string())
        );
    }

    #[test]
    fn test_studio_one_professional() {
        assert_eq!(
            extract_track_name("studio_one", "My Song - Studio One Professional 7.2.2"),
            Some("My Song".to_string())
        );
    }

    #[test]
    fn test_studio_one_artist() {
        assert_eq!(
            extract_track_name("studio_one", "My Song - Studio One Artist 7.2.2"),
            Some("My Song".to_string())
        );
    }

    #[test]
    fn test_studio_one_presonus() {
        assert_eq!(
            extract_track_name("studio_one", "My Song - PreSonus Studio One 7"),
            Some("My Song".to_string())
        );
    }
}
