import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDashboardStore } from "../../stores/dashboardStore";
import { todayStr } from "../../lib/formatters";

export function DateNavigation() {
  const { selectedDate, goToPrevDay, goToNextDay, goToToday } =
    useDashboardStore();

  const today = todayStr();
  const isToday = selectedDate === today;

  const displayDate = new Date(selectedDate + "T12:00:00").toLocaleDateString(
    [],
    {
      weekday: "short",
      month: "short",
      day: "numeric",
    }
  );

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={goToPrevDay}
        className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
      >
        <ChevronLeft size={16} />
      </button>

      <button
        onClick={goToToday}
        className={`text-sm px-3 py-1 rounded transition-colors ${
          isToday
            ? "text-white/90 font-medium"
            : "text-white/50 hover:text-white/80 hover:bg-white/5"
        }`}
      >
        {isToday ? "Today" : displayDate}
      </button>

      <button
        onClick={goToNextDay}
        disabled={isToday}
        className="p-1 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
