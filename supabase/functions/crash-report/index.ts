import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();

    const { error } = await supabase.from("crash_reports").insert({
      app_version: body.app_version || "unknown",
      os: body.os || "unknown",
      arch: body.arch || "unknown",
      panic_message: body.panic_message || "unknown",
      backtrace: body.backtrace || null,
      app_data_dir: body.app_data_dir || null,
    });

    if (error) {
      console.error("Failed to insert crash report:", error);
      return new Response("DB error", { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Invalid request:", err);
    return new Response("Bad request", { status: 400 });
  }
});