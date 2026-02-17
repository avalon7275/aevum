import { Receipt } from "lucide-react";

export function BillingPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="flex flex-col items-center max-w-sm text-center">
        <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center mb-5">
          <Receipt size={24} className="text-indigo-400/60" />
        </div>
        <h2 className="text-xl font-semibold text-white/90 mb-2">
          Project Billing
        </h2>
        <p className="text-sm text-white/40 leading-relaxed">
          Coming soon. Set hourly rates, track project costs, and export client
          timesheets.
        </p>
      </div>
    </div>
  );
}
