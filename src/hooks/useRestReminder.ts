import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

const REST_MESSAGES = [
  "You've been in the zone for over {mins}. A short break might help your ears reset.",
  "Nice focus session! {mins} straight. Step away for a few minutes and come back fresh.",
  "Your ears have been working hard for {mins}. A quick stretch could do wonders.",
  "Creative momentum is great, but {mins} is a long stretch. Give yourself a breather.",
];

export function useRestReminder() {
  const msgIndex = useRef(0);

  useEffect(() => {
    const unlisten = listen<number>("rest_reminder", async (event) => {
      const mins = event.payload;
      const hours = Math.floor(mins / 60);
      const remainMins = mins % 60;
      const timeStr =
        hours > 0 && remainMins > 0
          ? `${hours}h ${remainMins}m`
          : hours > 0
            ? `${hours}h`
            : `${mins}m`;

      const template = REST_MESSAGES[msgIndex.current % REST_MESSAGES.length];
      msgIndex.current++;
      const body = template.replace("{mins}", timeStr);

      let permitted = await isPermissionGranted();
      if (!permitted) {
        const result = await requestPermission();
        permitted = result === "granted";
      }
      if (permitted) {
        sendNotification({ title: "Aevum", body });
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
