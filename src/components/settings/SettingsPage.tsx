import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { useAuthStore } from "../../stores/authStore";
import {
  LogOut,
  Sparkles,
  CreditCard,
  Clock,
  Coffee,
  Monitor,
  Info,
  Gift,
  Copy,
  Check,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

interface AppSettings {
  polling: {
    interval_ms: number;
    idle_threshold_secs: number;
    break_threshold_secs: number;
    auto_start: boolean;
  };
  ui: {
    start_minimized: boolean;
    close_to_tray: boolean;
    show_notifications: boolean;
    day_start_hour: number;
  };
  rest_reminder: {
    enabled: boolean;
    continuous_minutes: number;
    cooldown_minutes: number;
  };
  goals: {
    enabled: boolean;
    daily_goal_minutes: number;
  };
  first_run_complete: boolean;
}

export function SettingsPage() {
  const { user, tier, signOut, openCheckout, openPortal } = useAuthStore();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [autostart, setAutostart] = useState(false);
  const [saving, setSaving] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    invoke<AppSettings>("get_app_settings").then(setSettings);
    invoke<boolean>("get_autostart_enabled").then(setAutostart);
    getVersion().then(setAppVersion);

    if (user) {
      supabase
        .from("profiles")
        .select("referral_code, referral_count")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setReferralCode(data.referral_code);
            setReferralCount(data.referral_count || 0);
          }
        });
    }
  }, [user]);

  const save = async (updated: AppSettings) => {
    setSettings(updated);
    setSaving(true);
    try {
      await invoke("save_app_settings", { newSettings: updated });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAutostart = async () => {
    const newState = await invoke<boolean>("toggle_autostart");
    setAutostart(newState);
  };

  if (!settings) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#111111]">
        <span className="text-sm font-medium text-white/70">Settings</span>
        {saving && (
          <div className="w-3 h-3 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Account */}
        <Section title="Account">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">{user?.email || "Not signed in"}</p>
              <span
                className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1 ${
                  tier === "pro"
                    ? "bg-indigo-500/20 text-indigo-300"
                    : "bg-white/5 text-white/30"
                }`}
              >
                {tier === "pro" ? "Pro" : "Free"}
              </span>
            </div>
            {user && (
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/40 hover:text-white/60 hover:bg-white/5 rounded-md transition-colors"
              >
                <LogOut size={12} />
                Sign out
              </button>
            )}
          </div>
        </Section>

        {/* Subscription */}
        <Section title="Subscription">
          {tier !== "pro" ? (
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40">
                Upgrade to unlock Timeline, Reports, Coach, and Billing.
              </p>
              <button
                onClick={openCheckout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-md transition-colors shrink-0 ml-4"
              >
                <Sparkles size={12} />
                Upgrade to Pro
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-xs text-white/40">
                Pro plan active. Manage billing, update payment, or cancel.
              </p>
              <button
                onClick={openPortal}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/40 hover:text-white/60 hover:bg-white/5 rounded-md transition-colors shrink-0 ml-4"
              >
                <CreditCard size={12} />
                Manage
              </button>
            </div>
          )}
        </Section>

        {/* Referral */}
        {user && referralCode && (
          <Section title="Referral" icon={<Gift size={14} className="text-white/30" />}>
            <p className="text-xs text-white/40 mb-2">
              Share your code. When a friend goes Pro, you both get a free month.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 font-mono select-all">
                {referralCode}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(referralCode);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-white/40 hover:text-white/60 hover:bg-white/5 rounded-lg border border-white/10 transition-colors"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {referralCount > 0 && (
              <p className="text-xs text-white/30 mt-2">
                {referralCount} referral{referralCount !== 1 ? "s" : ""} converted
              </p>
            )}
          </Section>
        )}

        {/* Rest Reminders */}
        <Section title="Rest Reminders" icon={<Coffee size={14} className="text-white/30" />}>
          <ToggleRow
            label="Enable rest reminders"
            description="Get notified to take a break after long sessions"
            checked={settings.rest_reminder.enabled}
            onChange={(v) =>
              save({ ...settings, rest_reminder: { ...settings.rest_reminder, enabled: v } })
            }
          />
          {settings.rest_reminder.enabled && (
            <>
              <NumberRow
                label="Work duration before reminder"
                value={settings.rest_reminder.continuous_minutes}
                suffix="min"
                min={15}
                max={480}
                step={15}
                onChange={(v) =>
                  save({
                    ...settings,
                    rest_reminder: { ...settings.rest_reminder, continuous_minutes: v },
                  })
                }
              />
              <NumberRow
                label="Cooldown between reminders"
                value={settings.rest_reminder.cooldown_minutes}
                suffix="min"
                min={10}
                max={240}
                step={10}
                onChange={(v) =>
                  save({
                    ...settings,
                    rest_reminder: { ...settings.rest_reminder, cooldown_minutes: v },
                  })
                }
              />
            </>
          )}
        </Section>

        {/* Tracking */}
        <Section title="Tracking" icon={<Clock size={14} className="text-white/30" />}>
          <NumberRow
            label="Idle timeout"
            description="Pause tracking after this many seconds of inactivity"
            value={settings.polling.idle_threshold_secs}
            suffix="sec"
            min={60}
            max={1800}
            step={30}
            onChange={(v) =>
              save({
                ...settings,
                polling: { ...settings.polling, idle_threshold_secs: v },
              })
            }
          />
        </Section>

        {/* App */}
        <Section title="App" icon={<Monitor size={14} className="text-white/30" />}>
          <ToggleRow
            label="Launch on startup"
            description="Start Aevum automatically when you log in"
            checked={autostart}
            onChange={handleToggleAutostart}
          />
          <ToggleRow
            label="Start minimized"
            description="Hide window on launch, run in system tray"
            checked={settings.ui.start_minimized}
            onChange={(v) =>
              save({ ...settings, ui: { ...settings.ui, start_minimized: v } })
            }
          />
          <ToggleRow
            label="Close to tray"
            description="Keep running in background when window is closed"
            checked={settings.ui.close_to_tray}
            onChange={(v) =>
              save({ ...settings, ui: { ...settings.ui, close_to_tray: v } })
            }
          />
        </Section>

        {/* About */}
        <Section title="About" icon={<Info size={14} className="text-white/30" />}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/40">Version</span>
            <span className="text-xs text-white/50 font-mono">{appVersion}</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-white/40">Aevum</span>
            <span className="text-xs text-white/30">Studio Time Tracker</span>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-xs font-medium text-white/50 uppercase tracking-wider">
          {title}
        </h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-white/70">{label}</p>
        {description && (
          <p className="text-[11px] text-white/25 mt-0.5">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${
          checked ? "bg-indigo-500/60" : "bg-white/10"
        }`}
      >
        <div
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function NumberRow({
  label,
  description,
  value,
  suffix,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-white/70">{label}</p>
        {description && (
          <p className="text-[11px] text-white/25 mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-6 h-6 flex items-center justify-center rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 text-sm transition-colors"
        >
          -
        </button>
        <span className="text-xs text-white/60 font-mono w-16 text-center">
          {value} {suffix}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-6 h-6 flex items-center justify-center rounded bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/60 text-sm transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}
