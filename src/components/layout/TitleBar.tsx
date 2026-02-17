import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

const appWindow = getCurrentWindow();

export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      onMouseDown={() => appWindow.startDragging()}
      className="flex items-center justify-between h-10 bg-[#111111] border-b border-white/5 px-3 shrink-0"
    >
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <span className="text-sm font-semibold text-white/90 tracking-wide">
          AEVUM
        </span>
      </div>

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
          onClick={() => appWindow.hide()}
          className="p-1.5 rounded hover:bg-red-500/80 text-white/50 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
