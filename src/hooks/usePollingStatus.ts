import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useSessionStore } from "../stores/sessionStore";
import type { PollingTick } from "../types/session";

export function usePollingStatus() {
  const setPollingTick = useSessionStore((s) => s.setPollingTick);

  useEffect(() => {
    const unlisten = listen<PollingTick>("polling_tick", (event) => {
      setPollingTick(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setPollingTick]);
}
