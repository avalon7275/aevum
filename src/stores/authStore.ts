import { create } from "zustand";
import { open } from "@tauri-apps/plugin-shell";
import { supabase } from "../lib/supabase";
import type { User } from "@supabase/supabase-js";

const PAYMENT_LINK = "https://buy.stripe.com/7sYaEX1fQeaY4wxdAk3ks0h";

type Tier = "free" | "pro";
type AuthStep = "email" | "otp";

interface AuthState {
  user: User | null;
  tier: Tier;
  loading: boolean;
  showAuth: boolean;
  authStep: AuthStep;
  authEmail: string;
  authError: string | null;
  referralCode: string;
  initialize: () => Promise<void>;
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  openAuth: () => void;
  closeAuth: () => void;
  setReferralCode: (code: string) => void;
  openCheckout: () => Promise<void>;
  openPortal: () => Promise<void>;
  refreshTier: () => Promise<void>;
  isPro: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tier: "free",
  loading: true,
  showAuth: false,
  authStep: "email",
  authEmail: "",
  authError: null,
  referralCode: "",

  initialize: async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        // Validate session against server (getSession only reads local cache)
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
          // User was deleted server-side but local token still exists
          await supabase.auth.signOut();
          set({ user: null, tier: "free", loading: false });
        } else {
          const tier = await fetchTier(user.id);
          set({ user, tier, loading: false });
        }
      } else {
        set({ loading: false });
      }

      // Listen for auth state changes (token refresh, sign in/out)
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          const tier = await fetchTier(session.user.id);
          set({ user: session.user, tier });
        } else {
          set({ user: null, tier: "free" });
        }
      });
    } catch (e) {
      console.error("Auth init failed:", e);
      set({ loading: false });
    }
  },

  sendOtp: async (email: string) => {
    set({ authError: null });
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      set({ authError: error.message });
      return;
    }
    set({ authStep: "otp", authEmail: email });
  },

  verifyOtp: async (email: string, token: string) => {
    set({ authError: null });
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (error) {
      set({ authError: error.message });
      return;
    }

    // If a referral code was entered, link the new user to the referrer
    const { referralCode } = get();
    if (referralCode) {
      try {
        const { data: referrer } = await supabase
          .from("profiles")
          .select("id")
          .eq("referral_code", referralCode.toLowerCase())
          .single();

        if (referrer) {
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (currentUser) {
            await supabase
              .from("profiles")
              .update({ referred_by: referrer.id })
              .eq("id", currentUser.id);
          }
        }
      } catch (e) {
        console.error("Failed to apply referral code:", e);
      }
    }

    // Auth state change listener handles setting user/tier
    set({ showAuth: false, authStep: "email", authEmail: "", authError: null, referralCode: "" });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, tier: "free", showAuth: false });
  },

  openAuth: () => {
    set({ showAuth: true, authStep: "email", authEmail: "", authError: null });
  },

  closeAuth: () => {
    set({ showAuth: false, authStep: "email", authEmail: "", authError: null });
  },

  setReferralCode: (code: string) => {
    set({ referralCode: code });
  },

  openCheckout: async () => {
    const { user } = get();
    if (!user) return;

    let url = `${PAYMENT_LINK}?prefilled_email=${encodeURIComponent(user.email || "")}&client_reference_id=${user.id}`;

    // Check if user was referred, auto-apply promo code for first month free
    try {
      const { data } = await supabase
        .from("profiles")
        .select("referred_by")
        .eq("id", user.id)
        .single();

      if (data?.referred_by) {
        url += `&prefilled_promo_code=AEVUMREF`;
      }
    } catch {
      // Continue without promo code
    }

    open(url);
  },

  openPortal: async () => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
      },
    );

    if (res.ok) {
      const { url } = await res.json();
      if (url) open(url);
    }
  },

  refreshTier: async () => {
    const { user } = get();
    if (!user) return;
    const tier = await fetchTier(user.id);
    set({ tier });
  },

  isPro: () => get().tier === "pro",
}));

async function fetchTier(userId: string): Promise<Tier> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", userId)
      .single();
    return (data?.tier as Tier) || "free";
  } catch {
    return "free";
  }
}
