use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct DawMatch {
    pub id: &'static str,
    pub name: &'static str,
}

struct DawSignature {
    name: &'static str,
    id: &'static str,
    process_patterns: &'static [&'static str],
    title_patterns: &'static [&'static str],
}

static DAW_SIGNATURES: &[DawSignature] = &[
    DawSignature {
        name: "Cubase",
        id: "cubase",
        process_patterns: &["cubase"],
        title_patterns: &["Cubase Pro", "Cubase Artist", "Cubase Elements", "Cubase LE"],
    },
    DawSignature {
        name: "Ableton Live",
        id: "ableton",
        process_patterns: &["ableton live"],
        title_patterns: &["Ableton Live"],
    },
    DawSignature {
        name: "FL Studio",
        id: "fl_studio",
        process_patterns: &["fl.exe", "fl64.exe", "fl studio"],
        title_patterns: &["FL Studio"],
    },
    DawSignature {
        name: "Reaper",
        id: "reaper",
        process_patterns: &["reaper"],
        title_patterns: &["REAPER"],
    },
    DawSignature {
        name: "Pro Tools",
        id: "pro_tools",
        process_patterns: &["protools", "pro tools"],
        title_patterns: &["Pro Tools"],
    },
    DawSignature {
        name: "Studio One",
        id: "studio_one",
        process_patterns: &["studio one"],
        title_patterns: &["Studio One"],
    },
    DawSignature {
        name: "Bitwig Studio",
        id: "bitwig",
        process_patterns: &["bitwig"],
        title_patterns: &["Bitwig Studio"],
    },
    DawSignature {
        name: "Logic Pro",
        id: "logic",
        process_patterns: &["logic pro"],
        title_patterns: &["Logic Pro"],
    },
];

/// Check if the foreground window belongs to a known DAW.
/// Checks process name first (fast path), then falls back to window title.
pub fn match_daw(process_name: &str, window_title: &str) -> Option<DawMatch> {
    let process_lower = process_name.to_lowercase();
    let title_lower = window_title.to_lowercase();

    for sig in DAW_SIGNATURES {
        // Fast path: match process name
        for pattern in sig.process_patterns {
            if process_lower.contains(pattern) {
                return Some(DawMatch {
                    id: sig.id,
                    name: sig.name,
                });
            }
        }

        // Fallback: match window title
        for pattern in sig.title_patterns {
            if title_lower.contains(&pattern.to_lowercase()) {
                return Some(DawMatch {
                    id: sig.id,
                    name: sig.name,
                });
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cubase_detection() {
        let m = match_daw("cubase.exe", "My Song - Cubase Pro 14");
        assert!(m.is_some());
        assert_eq!(m.unwrap().id, "cubase");
    }

    #[test]
    fn test_fl_studio_detection() {
        let m = match_daw("fl64.exe", "FL Studio 2025 - My Song.flp");
        assert!(m.is_some());
        assert_eq!(m.unwrap().id, "fl_studio");
    }

    #[test]
    fn test_no_daw() {
        let m = match_daw("chrome.exe", "Google Chrome");
        assert!(m.is_none());
    }

    #[test]
    fn test_title_fallback() {
        let m = match_daw("unknown.exe", "Ableton Live 12 - My Track");
        assert!(m.is_some());
        assert_eq!(m.unwrap().id, "ableton");
    }

    // macOS app names (kCGWindowOwnerName returns these)
    #[test]
    fn test_macos_logic_pro() {
        let m = match_daw("logic pro", "My Song - Logic Pro");
        assert!(m.is_some());
        assert_eq!(m.unwrap().id, "logic");
    }

    #[test]
    fn test_macos_reaper() {
        let m = match_daw("reaper", "My Song - REAPER v7.25");
        assert!(m.is_some());
        assert_eq!(m.unwrap().id, "reaper");
    }

    #[test]
    fn test_macos_fl_studio() {
        let m = match_daw("fl studio", "FL Studio 2025 - My Song.flp");
        assert!(m.is_some());
        assert_eq!(m.unwrap().id, "fl_studio");
    }

    #[test]
    fn test_macos_pro_tools() {
        let m = match_daw("pro tools", "My Song - Pro Tools");
        assert!(m.is_some());
        assert_eq!(m.unwrap().id, "pro_tools");
    }

    #[test]
    fn test_macos_bitwig() {
        let m = match_daw("bitwig studio", "My Song - Bitwig Studio 5.2");
        assert!(m.is_some());
        assert_eq!(m.unwrap().id, "bitwig");
    }

    #[test]
    fn test_macos_studio_one() {
        let m = match_daw("studio one", "My Song - Studio One");
        assert!(m.is_some());
        assert_eq!(m.unwrap().id, "studio_one");
    }
}
