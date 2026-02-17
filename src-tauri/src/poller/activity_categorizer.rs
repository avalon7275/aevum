/// State machine that smooths phase transitions and handles break/idle detection.
///
/// Rules:
/// - Require 3 consecutive ticks with the same detected phase before transitioning
/// - Non-DAW foreground for > 30s => "break"
/// - Non-DAW foreground for > idle_threshold => "idle" (ends session in polling loop)
/// - Non-DAW foreground for < 30s => keep current phase (momentary app switch)
pub struct ActivityCategorizer {
    current_phase: String,
    pending_phase: Option<String>,
    pending_count: u32,
    non_daw_since: Option<i64>,
    idle_threshold_secs: i64,
}

impl ActivityCategorizer {
    pub fn new(idle_threshold_secs: u64) -> Self {
        ActivityCategorizer {
            current_phase: "composing".to_string(),
            pending_phase: None,
            pending_count: 0,
            non_daw_since: None,
            idle_threshold_secs: idle_threshold_secs as i64,
        }
    }

    /// Called each polling tick.
    /// - `is_daw`: true if foreground window belongs to a DAW process
    /// - `detected_phase`: the phase detected from plugin/view classification (only meaningful if is_daw)
    /// - `now`: current Unix timestamp
    ///
    /// Returns the current smoothed phase.
    pub fn tick(&mut self, is_daw: bool, detected_phase: &str, now: i64) -> String {
        if !is_daw {
            // Track how long user has been away from DAW
            let away_start = *self.non_daw_since.get_or_insert(now);
            let away_secs = now - away_start;

            if away_secs > self.idle_threshold_secs {
                self.current_phase = "idle".to_string();
                self.pending_phase = None;
                self.pending_count = 0;
            } else if away_secs > 30 {
                self.current_phase = "break".to_string();
                self.pending_phase = None;
                self.pending_count = 0;
            }
            // Under 30s: keep current phase (momentary switch)

            return self.current_phase.clone();
        }

        // DAW is in foreground, reset non-DAW timer
        self.non_daw_since = None;

        // If we were in break/idle, immediately transition to the detected phase
        if self.current_phase == "break" || self.current_phase == "idle" {
            self.current_phase = detected_phase.to_string();
            self.pending_phase = None;
            self.pending_count = 0;
            return self.current_phase.clone();
        }

        // Transition smoothing: require 3 consecutive ticks with same phase
        if detected_phase != self.current_phase {
            if self.pending_phase.as_deref() == Some(detected_phase) {
                self.pending_count += 1;
                if self.pending_count >= 3 {
                    self.current_phase = detected_phase.to_string();
                    self.pending_phase = None;
                    self.pending_count = 0;
                }
            } else {
                self.pending_phase = Some(detected_phase.to_string());
                self.pending_count = 1;
            }
        } else {
            // Same as current, reset pending
            self.pending_phase = None;
            self.pending_count = 0;
        }

        self.current_phase.clone()
    }

    pub fn current_phase(&self) -> &str {
        &self.current_phase
    }

    /// Reset when session ends
    pub fn reset(&mut self) {
        self.current_phase = "composing".to_string();
        self.pending_phase = None;
        self.pending_count = 0;
        self.non_daw_since = None;
    }
}
