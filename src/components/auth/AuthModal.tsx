import { useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { X } from "lucide-react";

export function AuthModal() {
  const { user, showAuth, authStep, authEmail, authError, sendOtp, verifyOtp, closeAuth } =
    useAuthStore();

  if (!showAuth) return null;

  // Can only dismiss if already signed in
  const canDismiss = !!user;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={canDismiss ? closeAuth : undefined}
      />

      {/* Modal */}
      <div className="relative bg-[#141414] border border-white/10 rounded-xl w-[360px] p-6 shadow-2xl">
        {canDismiss && (
          <button
            onClick={closeAuth}
            className="absolute top-3 right-3 p-1 rounded hover:bg-white/10 text-white/30 hover:text-white/60 transition-colors"
          >
            <X size={16} />
          </button>
        )}

        {authStep === "email" ? (
          <EmailStep onSubmit={sendOtp} error={authError} />
        ) : (
          <OtpStep
            email={authEmail}
            onSubmit={(token) => verifyOtp(authEmail, token)}
            onBack={() => useAuthStore.setState({ authStep: "email", authError: null })}
            onResend={() => sendOtp(authEmail)}
            error={authError}
          />
        )}
      </div>
    </div>
  );
}

function EmailStep({
  onSubmit,
  error,
}: {
  onSubmit: (email: string) => void;
  error: string | null;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const { referralCode, setReferralCode } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    await onSubmit(email.trim());
    setSending(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold text-white/90 mb-1">
        Sign in to Aevum
      </h2>
      <p className="text-xs text-white/30 mb-5">
        Free, no password needed
      </p>

      <label className="block text-xs text-white/40 mb-1.5">Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white/80 outline-none focus:border-indigo-400/50 placeholder:text-white/15"
        autoFocus
        required
      />

      {!showReferral ? (
        <button
          type="button"
          onClick={() => setShowReferral(true)}
          className="mt-2 text-[11px] text-white/20 hover:text-white/40 transition-colors"
        >
          Have a referral code?
        </button>
      ) : (
        <div className="mt-2">
          <label className="block text-xs text-white/40 mb-1.5">Referral code</label>
          <input
            type="text"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.trim())}
            placeholder="e.g. a1b2c3d4"
            className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white/80 outline-none focus:border-indigo-400/50 placeholder:text-white/15 font-mono"
          />
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={sending || !email.trim()}
        className="w-full mt-4 py-2 text-sm font-medium bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {sending ? "Sending..." : "Send code"}
      </button>
    </form>
  );
}

function OtpStep({
  email,
  onSubmit,
  onBack,
  onResend,
  error,
}: {
  email: string;
  onSubmit: (token: string) => void;
  onBack: () => void;
  onResend: () => void;
  error: string | null;
}) {
  const [token, setToken] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setVerifying(true);
    await onSubmit(token.trim());
    setVerifying(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold text-white/90 mb-1">
        Check your email
      </h2>
      <p className="text-xs text-white/30 mb-5">
        We sent a code to{" "}
        <span className="text-white/50">{email}</span>
      </p>

      <label className="block text-xs text-white/40 mb-1.5">
        Verification code
      </label>
      <input
        type="text"
        value={token}
        onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white/80 outline-none focus:border-indigo-400/50 placeholder:text-white/15 tracking-[0.3em] text-center font-mono"
        autoFocus
        maxLength={6}
        required
      />

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={verifying || token.length < 6}
        className="w-full mt-4 py-2 text-sm font-medium bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {verifying ? "Verifying..." : "Verify"}
      </button>

      <div className="flex items-center justify-between mt-3">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onResend}
          className="text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          Resend code
        </button>
      </div>
    </form>
  );
}
