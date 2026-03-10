import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { DashboardPage } from "./components/dashboard/DashboardPage";
import { TracksPage } from "./components/tracks/TracksPage";
import { ReportsPage } from "./components/reports/ReportsPage";
import { WeeklyView } from "./components/weekly/WeeklyView";
import { CoachPage } from "./components/coach/CoachPage";
import { BillingPage } from "./components/billing/BillingPage";
import { SettingsPage } from "./components/settings/SettingsPage";
import { usePollingStatus } from "./hooks/usePollingStatus";
import { useRestReminder } from "./hooks/useRestReminder";
import { TrackDetailView } from "./components/tracks/TrackDetailView";
import { AuthModal } from "./components/auth/AuthModal";
import { UpgradePrompt } from "./components/auth/UpgradePrompt";
import { useAuthStore } from "./stores/authStore";
import { UpdateBanner } from "./components/UpdateBanner";
import {
  LayoutDashboard,
  FolderKanban,
  CalendarDays,
  FileBarChart,
  Brain,
  Receipt,
  Minus,
  Square,
  X,
  User,
  Lock,
} from "lucide-react";

const appWindow = getCurrentWindow();

type View = "dashboard" | "tracks" | "timeline" | "reports" | "coach" | "billing" | "settings";

function App() {
  usePollingStatus();
  useRestReminder();
  const [view, setView] = useState<View>("dashboard");
  const { user, tier, loading, initialize, openAuth, refreshTier } = useAuthStore();
  const isPro = tier === "pro";

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Auto-open auth when not signed in
  useEffect(() => {
    if (!loading && !user) {
      openAuth();
    }
  }, [loading, user, openAuth]);

  // Refresh tier when window regains focus (e.g. returning from Stripe checkout)
  useEffect(() => {
    const unlisten = appWindow.onFocusChanged(({ payload: focused }) => {
      if (focused && user) {
        refreshTier();
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [user, refreshTier]);

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <div className="flex flex-col w-11 shrink-0 bg-[#0e0e0e] border-r border-white/5">
        {/* Drag region at top of sidebar */}
        <div
          data-tauri-drag-region
          onMouseDown={() => appWindow.startDragging()}
          className="h-10 shrink-0"
        />

        {/* Nav icons */}
        <div className="flex flex-col items-center gap-1 px-1.5 py-1">
          <SidebarButton
            active={view === "dashboard"}
            onClick={() => setView("dashboard")}
            icon={<LayoutDashboard size={16} />}
            tooltip="Dashboard"
          />
          <SidebarNavButton
            active={view === "tracks"}
            onClick={() => setView("tracks")}
            icon={<FolderKanban size={16} />}
            tooltip="Tracks"
            locked={!isPro}
          />
          <SidebarNavButton
            active={view === "timeline"}
            onClick={() => setView("timeline")}
            icon={<CalendarDays size={16} />}
            tooltip="Timeline"
            locked={!isPro}
          />
          <SidebarNavButton
            active={view === "reports"}
            onClick={() => setView("reports")}
            icon={<FileBarChart size={16} />}
            tooltip="Reports"
            locked={!isPro}
          />
          <SidebarNavButton
            active={view === "coach"}
            onClick={() => setView("coach")}
            icon={<Brain size={16} />}
            tooltip="Coach"
            locked={!isPro}
          />
          <SidebarNavButton
            active={view === "billing"}
            onClick={() => setView("billing")}
            icon={<Receipt size={16} />}
            tooltip="Billing"
            locked={!isPro}
          />
        </div>

        <div className="flex-1" />

        {/* Settings / Account button */}
        <div className="flex flex-col items-center px-1.5 pb-2">
          {user ? (
            <button
              onClick={() => setView("settings")}
              title={user.email || "Settings"}
              className={`w-8 h-8 flex items-center justify-center rounded-md text-xs font-semibold transition-colors ${
                view === "settings"
                  ? "bg-indigo-500/30 text-indigo-200"
                  : "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
              }`}
            >
              {user.email?.[0]?.toUpperCase() || "?"}
            </button>
          ) : (
            <button
              onClick={openAuth}
              title="Sign in"
              className="w-8 h-8 flex items-center justify-center rounded-md text-white/25 hover:text-white/50 hover:bg-white/5 transition-colors"
            >
              <User size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Title bar */}
        <div className="flex items-center justify-between h-10 bg-[#111111] border-b border-white/5 px-3 shrink-0">
          {/* Draggable area */}
          <div
            data-tauri-drag-region
            onMouseDown={() => appWindow.startDragging()}
            className="flex-1 h-full flex items-center"
          >
            <span className="text-sm font-semibold text-white/90 tracking-wide">
              AEVUM
            </span>
            <span className="text-[11px] text-white/20 ml-2.5 tracking-wider">
              Studio Time Tracker
            </span>
          </div>

          {/* Window controls - NOT in drag region */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => appWindow.minimize()}
              className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={() => appWindow.toggleMaximize()}
              className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
            >
              <Square size={12} />
            </button>
            <button
              onClick={() => invoke("hide_to_tray")}
              className="p-1.5 rounded hover:bg-red-500/80 text-white/50 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Update banner */}
        <UpdateBanner />

        {/* View content — only render when authenticated */}
        {!loading && user ? (
          <>
            {view === "dashboard" && <DashboardPage onNavigate={(v) => setView(v as View)} />}
            {view === "tracks" &&
              (isPro ? <TracksPage /> : <UpgradePrompt feature="tracks" />)}
            {view === "timeline" &&
              (isPro ? <WeeklyView /> : <UpgradePrompt feature="timeline" />)}
            {view === "reports" &&
              (isPro ? <ReportsPage /> : <UpgradePrompt feature="reports" />)}
            {view === "coach" &&
              (isPro ? <CoachPage /> : <UpgradePrompt feature="coach" />)}
            {view === "billing" &&
              (isPro ? <BillingPage /> : <UpgradePrompt feature="billing" />)}
            {view === "settings" && <SettingsPage />}
          </>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-white/30 text-sm">Loading...</span>
          </div>
        ) : null}
      </div>

      {/* Track detail overlay — only when authenticated */}
      {!loading && user && <TrackDetailView />}

      {/* Auth modal */}
      <AuthModal />
    </div>
  );
}

function SidebarButton({
  active,
  onClick,
  icon,
  tooltip,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  tooltip: string;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-white/10 text-white/90"
          : "text-white/30 hover:text-white/60 hover:bg-white/5"
      }`}
    >
      {icon}
    </button>
  );
}

function SidebarNavButton({
  active,
  onClick,
  icon,
  tooltip,
  locked,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  tooltip: string;
  locked: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={locked ? `${tooltip} (Pro)` : tooltip}
      className={`relative w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-white/10 text-white/90"
          : locked
            ? "text-white/20 hover:text-white/40 hover:bg-white/5"
            : "text-white/30 hover:text-white/60 hover:bg-white/5"
      }`}
    >
      {icon}
      {locked && (
        <Lock
          size={7}
          className="absolute bottom-1 right-1 text-white/25"
        />
      )}
    </button>
  );
}

export default App;
