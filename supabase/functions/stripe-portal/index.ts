import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe";
import { createClient } from "npm:@supabase/supabase-js";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Missing auth header", { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return new Response(
      JSON.stringify({ error: "No active subscription found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { "Content-Type": "application/json" },
  });
});
