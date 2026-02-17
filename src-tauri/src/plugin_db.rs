use regex::Regex;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
struct RawPluginEntry {
    name: String,
    vendor: String,
    category: String,
    phase_hint: String,
    window_patterns: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct PluginMatch {
    pub name: String,
    pub vendor: String,
    pub category: String,
    pub phase_hint: String,
}

struct CompiledPlugin {
    info: PluginMatch,
    patterns: Vec<Regex>,
}

pub struct PluginDatabase {
    plugins: Vec<CompiledPlugin>,
}

impl PluginDatabase {
    pub fn load() -> Self {
        let json = include_str!("../data/plugin_database.json");
        let raw: Vec<RawPluginEntry> =
            serde_json::from_str(json).expect("Failed to parse plugin_database.json");

        let plugins = raw
            .into_iter()
            .filter_map(|entry| {
                let patterns: Vec<Regex> = entry
                    .window_patterns
                    .iter()
                    .filter_map(|p| {
                        Regex::new(&format!("(?i){}", p))
                            .map_err(|e| {
                                log::warn!("Bad regex pattern '{}' for {}: {}", p, entry.name, e);
                                e
                            })
                            .ok()
                    })
                    .collect();

                if patterns.is_empty() {
                    return None;
                }

                Some(CompiledPlugin {
                    info: PluginMatch {
                        name: entry.name,
                        vendor: entry.vendor,
                        category: entry.category,
                        phase_hint: entry.phase_hint,
                    },
                    patterns,
                })
            })
            .collect();

        log::info!("Loaded plugin database");
        PluginDatabase { plugins }
    }

    /// Match a window title against all plugin patterns.
    /// Returns the first matching plugin entry.
    pub fn match_title(&self, title: &str) -> Option<&PluginMatch> {
        for plugin in &self.plugins {
            for pat in &plugin.patterns {
                if pat.is_match(title) {
                    return Some(&plugin.info);
                }
            }
        }
        None
    }
}
