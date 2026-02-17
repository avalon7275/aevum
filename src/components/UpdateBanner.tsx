import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import { Download, X } from "lucide-react";

interface UpdateInfo {
  available: boolean;
  current_version: string;
  latest_version: string;
  download_url: string;
}

export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check after a short delay so it doesn't block startup
    const timer = setTimeout(() => {
      invoke<UpdateInfo>("check_for_update")
        .then((info) => {
          if (info.available) setUpdate(info);
        })
        .catch(() => {});
    }, 5000);

    // Re-check every 4 hours
    const interval = setInterval(() => {
      invoke<UpdateInfo>("check_for_update")
        .then((info) => {
          if (info.available) {
            setUpdate(info);
            setDismissed(false);
          }
        })
        .catch(() => {});
    }, 4 * 60 * 60 * 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);

  if (!update || dismissed) return null;

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-indigo-500/15 border-b border-indigo-500/20 shrink-0">
      <div className="flex items-center gap-2">
        <Download size={12} className="text-indigo-400" />
        <span className="text-xs text-indigo-300/80">
          Aevum v{update.latest_version} is available
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => open(update.download_url)}
          className="px-2 py-0.5 text-[11px] font-medium bg-indigo-500/25 hover:bg-indigo-500/40 text-indigo-200 rounded transition-colors"
        >
          Download
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-0.5 text-white/20 hover:text-white/50 transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
