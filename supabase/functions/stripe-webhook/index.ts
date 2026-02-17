import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe";
import { createClient } from "npm:@supabase/supabase-js";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id;

    if (userId) {
      const { error } = await supabase
        .from("profiles")
        .update({
          tier: "pro",
          stripe_customer_id: session.customer as string,
        })
        .eq("id", userId);

      if (error) {
        console.error("Failed to update tier:", error);
        return new Response("DB error", { status: 500 });
      }
      console.log(`Upgraded user ${userId} to pro`);

      // Credit referrer if this user was referred
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("referred_by")
          .eq("id", userId)
          .single();

        if (profile?.referred_by) {
          const { data: referrer } = await supabase
            .from("profiles")
            .select("stripe_customer_id")
            .eq("id", profile.referred_by)
            .single();

          if (referrer?.stripe_customer_id) {
            // Apply $7 credit to referrer's Stripe account
            await stripe.customers.createBalanceTransaction(
              referrer.stripe_customer_id,
              { amount: -700, currency: "usd" },
            );
            console.log(`Credited referrer ${profile.referred_by} with $7`);
          }

          // Increment referrer's referral count
          const { data: ref } = await supabase
            .from("profiles")
            .select("referral_count")
            .eq("id", profile.referred_by)
            .single();
          await supabase
            .from("profiles")
            .update({ referral_count: (ref?.referral_count || 0) + 1 })
            .eq("id", profile.referred_by);
        }
      } catch (refErr) {
        console.error("Referral credit failed:", refErr);
        // Don't fail the webhook for referral errors
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    const { error } = await supabase
      .from("profiles")
      .update({ tier: "free" })
      .eq("stripe_customer_id", customerId);

    if (error) {
      console.error("Failed to downgrade tier:", error);
    }
    console.log(`Downgraded customer ${customerId} to free`);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
