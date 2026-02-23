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
    const isLifetime = session.mode === "payment"; // one-time = lifetime

    if (userId) {
      const update: Record<string, unknown> = {
        tier: "pro",
        stripe_customer_id: session.customer as string,
      };
      if (isLifetime) {
        update.is_lifetime = true;
      }

      const { error } = await supabase
        .from("profiles")
        .update(update)
        .eq("id", userId);

      if (error) {
        console.error("Failed to update tier:", error);
        return new Response("DB error", { status: 500 });
      }
      console.log(`Upgraded user ${userId} to pro${isLifetime ? " (lifetime)" : ""}`);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    // Never downgrade lifetime users
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_lifetime")
      .eq("stripe_customer_id", customerId)
      .single();

    if (profile?.is_lifetime) {
      console.log(`Skipping downgrade for lifetime customer ${customerId}`);
    } else {
      const { error } = await supabase
        .from("profiles")
        .update({ tier: "free" })
        .eq("stripe_customer_id", customerId);

      if (error) {
        console.error("Failed to downgrade tier:", error);
      }
      console.log(`Downgraded customer ${customerId} to free`);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
