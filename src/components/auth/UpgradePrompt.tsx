import { useAuthStore } from "../../stores/authStore";
import { Lock, Sparkles } from "lucide-react";

const FEATURE_COPY: Record<string, { title: string; description: string }> = {
  timeline: {
    title: "Unlock Your Timeline",
    description:
      "See how your workflow shifts week over week. Track category changes, compare project time, and spot trends in your production habits.",
  },
  reports: {
    title: "Unlock Detailed Reports",
    description:
      "Dive deeper into your production data with comprehensive reports, focus metrics, and plugin usage breakdowns across all your projects.",
  },
  coach: {
    title: "Unlock Your Production Coach",
    description:
      "Get AI-powered insights about your workflow. Spot inefficiencies, track flow states, get personalized tips to produce smarter and avoid burnout.",
  },
  projects: {
    title: "Unlock Project Library",
    description:
      "Browse all your projects in one place. See total time, session history, and activity breakdowns for every track you've worked on.",
  },
  billing: {
    title: "Unlock Project Billing",
    description:
      "Set hourly rates, track project costs automatically, and export professional timesheets for your clients.",
  },
};

export function UpgradePrompt({ feature }: { feature: string }) {
  const { user, openAuth, openCheckout } = useAuthStore();
  const copy = FEATURE_COPY[feature] || {
    title: "Unlock This Feature",
    description: "Upgrade to Pro to access advanced features.",
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="flex flex-col items-center max-w-sm text-center">
        <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center mb-5">
          <Lock size={24} className="text-indigo-400/60" />
        </div>

        <h2 className="text-xl font-semibold text-white/90 mb-2">
          {copy.title}
        </h2>

        <p className="text-sm text-white/40 leading-relaxed mb-6">
          {copy.description}
        </p>

        <p className="text-xs text-white/25 mb-4">Pro feature · $7/month</p>

        {!user ? (
          <button
            onClick={openAuth}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-colors"
          >
            <Sparkles size={14} />
            Sign in to upgrade
          </button>
        ) : (
          <button
            onClick={openCheckout}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-colors"
          >
            <Sparkles size={14} />
            Upgrade to Pro
          </button>
        )}
      </div>
    </div>
  );
}
