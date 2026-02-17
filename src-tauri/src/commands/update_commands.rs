use serde::{Deserialize, Serialize};

const GITHUB_REPO: &str = "avalon7275/aevum";

#[derive(Debug, Serialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: String,
    pub download_url: String,
}

#[derive(Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
}

fn parse_version(s: &str) -> Option<(u32, u32, u32)> {
    let s = s.strip_prefix('v').unwrap_or(s);
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    Some((
        parts[0].parse().ok()?,
        parts[1].parse().ok()?,
        parts[2].parse().ok()?,
    ))
}

fn is_newer(latest: &str, current: &str) -> bool {
    match (parse_version(latest), parse_version(current)) {
        (Some(l), Some(c)) => l > c,
        _ => false,
    }
}

#[tauri::command]
pub fn check_for_update() -> Result<UpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let url = format!(
        "https://api.github.com/repos/{}/releases/latest",
        GITHUB_REPO
    );

    let response = ureq::get(&url)
        .set("User-Agent", "Aevum-Updater")
        .set("Accept", "application/vnd.github.v3+json")
        .call()
        .map_err(|e| format!("Failed to check for updates: {}", e))?;

    let release: GithubRelease = response
        .into_json()
        .map_err(|e| format!("Failed to parse release info: {}", e))?;

    let latest = release.tag_name.strip_prefix('v').unwrap_or(&release.tag_name);

    Ok(UpdateInfo {
        available: is_newer(latest, &current_version),
        current_version,
        latest_version: latest.to_string(),
        download_url: release.html_url,
    })
}
