import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, apikey",
};

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SYSTEM_PROMPT = `You are a production coach for music composers and producers. You analyze weekly session data from their DAW (Digital Audio Workstation) tracking app and provide actionable insights.

Your job is to help them:
1. Work more efficiently and maintain focus
2. Avoid burnout (detect overwork patterns)
3. Maintain healthy rest and break habits
4. Notice problematic patterns (abandoning tracks, excessive switching, never finishing)
5. Improve their production workflow balance

Rules for your analysis:
- Be direct and concise. No fluff.
- Tone: supportive coach, not preachy. Like a trusted mentor who genuinely cares.
- Overwork detection: Flag if they work >10 hours on multiple days, or have zero rest days in the week.
- Distraction detection: Flag if many sessions are <15 minutes, or they switch between 5+ projects in one day.
- Abandonment detection: Flag projects with only 1-2 very short sessions that were never returned to.
- Workflow balance: Note if categories are heavily imbalanced (e.g., 90% mixing, 0% composing).
- Always mention something positive before concerns.
- The "tip" should be one specific, actionable thing they can try next week.

Time categories explained:
- "composing": Writing/editing notes, melodies, MIDI
- "arranging": Structuring the song, main DAW view
- "mixing": Working in the mix console
- "sound_selection": Browsing sounds/samples/presets
- "sound_design": Programming synths
- "break": Away from DAW briefly (<5 min)
- "idle": Away from DAW for extended time (>5 min, session paused)

Timestamps are Unix timestamps. Convert to readable times for your analysis.

Respond with valid JSON only (no markdown, no code fences). Use this exact structure:
{
  "summary": "2-3 sentence weekly overview",
  "highlights": ["3-5 key observations about their week"],
  "concerns": ["0-3 warnings about burnout, distraction, or problematic patterns. Empty array if none."],
  "tip": "One specific actionable tip for next week",
  "hours_grade": "healthy | light | heavy | overwork"
}

hours_grade guidelines:
- "light": <15 hours/week total
- "healthy": 15-40 hours/week
- "heavy": 40-60 hours/week
- "overwork": >60 hours/week OR >10h/day on 3+ days`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing auth header" }, 401);
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // Check Pro tier
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  if (profile?.tier !== "pro") {
    return jsonResponse({ error: "Pro subscription required" }, 403);
  }

  // Parse request body and call Anthropic API
  try {
    const { coach_data } = await req.json();
    if (!coach_data) {
      return jsonResponse({ error: "Missing coach_data" }, 400);
    }
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Analyze this week's production data and provide your coaching insights:\n\n${JSON.stringify(coach_data, null, 2)}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", errorText);
      return jsonResponse({ error: "AI analysis failed" }, 502);
    }

    const result = await response.json();
    const content = result.content?.[0]?.text;

    if (!content) {
      return jsonResponse({ error: "Empty AI response" }, 502);
    }

    // Parse the JSON response from Claude (strip markdown fences if present)
    let jsonStr = content.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const analysis = JSON.parse(jsonStr);

    return jsonResponse({ analysis });
  } catch (err) {
    console.error("Coach analysis failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: `Analysis failed: ${message}` }, 500);
  }
});
