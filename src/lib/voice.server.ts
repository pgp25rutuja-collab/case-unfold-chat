import { createClient } from "@supabase/supabase-js";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const TTS_MODEL = "google/gemini-3.1-flash-tts-preview";
const STT_MODEL = "google/gemini-3.5-transcribe";
const MAX_AUDIO_BYTES = 14 * 1024 * 1024;

/** Verifies the caller's bearer token; returns the user id or null. */
export async function verifyCaller(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.split(".").length !== 3) return null;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return data.claims.sub;
}

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this app yet.");
  return key;
}

export async function requestSpeech(text: string) {
  return fetch(`${GATEWAY}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: TTS_MODEL,
      contents: [{ role: "user", parts: [{ text: `Read this aloud in a calm, clear, professional tone: ${text}` }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
      },
      stream_format: "sse",
    }),
  });
}

export async function requestTranscription(file: File) {
  if (!file.size || file.size > MAX_AUDIO_BYTES) {
    throw new Error("That answer is too long to transcribe. Please keep answers under about 10 minutes.");
  }
  const form = new FormData();
  form.append("model", STT_MODEL);
  form.append("file", new File([file], "answer.webm", { type: "audio/webm" }));
  form.append("response_format", "json");
  form.append("stream", "true");
  return fetch(`${GATEWAY}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}` },
    body: form,
  });
}
