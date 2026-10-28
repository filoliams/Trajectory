// supabase/functions/analyze-note/index.ts
// Reads one note (typed text or a handwritten page image) with Claude Haiku 5.5,
// returns a structured summary, and logs token usage per user.

import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")! });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL = "claude-haiku-5-5";

const SYSTEM_PROMPT = `You analyse a university student's study notes.
Return ONLY JSON with this shape:
{
  "course": string | null,
  "topics": string[],
  "summary": string,
  "coverage": "light" | "moderate" | "thorough",
  "gaps": string[]
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1. Identify the signed-in user from their Supabase JWT
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Not signed in" }, 401);

    // 2. Read the note from the request
    const { text, imageBase64, mediaType } = await req.json();
    if (!text && !imageBase64) return json({ error: "Send text or imageBase64" }, 400);

    const content: Anthropic.ContentBlockParam[] = [];
    if (imageBase64) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: mediaType ?? "image/png", data: imageBase64 },
      });
    }
    content.push({ type: "text", text: text ?? "Analyse this handwritten note page." });

    // 3. Call Claude
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    });

    const output = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // 4. Log usage so you can see real cost per user (table from the migration file)
    await supabase.from("ai_usage").insert({
      user_id: user.id,
      function_name: "analyze-note",
      model: MODEL,
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
    });

    return json({ analysis: safeParse(output) });
  } catch (err) {
    console.error(err);
    return json({ error: "Analysis failed" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeParse(s: string) {
  try {
    return JSON.parse(s.replace(/^```json\s*|```$/g, "").trim());
  } catch {
    return { raw: s };
  }
}