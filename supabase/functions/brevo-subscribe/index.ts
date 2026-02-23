import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY")!;
const AEVUM_LIST_ID = 7;

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

  if (authError || !user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const res = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "api-key": BREVO_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        listIds: [AEVUM_LIST_ID],
        updateEnabled: true,
      }),
    });

    if (res.ok || res.status === 204) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = await res.json().catch(() => null);
    if (data?.code === "duplicate_parameter") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    console.error("Brevo API error:", res.status, data);
    return new Response(JSON.stringify({ ok: false }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Brevo subscribe error:", err);
    return new Response(JSON.stringify({ ok: false }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
