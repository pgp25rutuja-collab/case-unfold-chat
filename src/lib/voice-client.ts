import { createParser } from "eventsource-parser";
import { supabase } from "@/integrations/supabase/client";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function friendly(status: number, text: string) {
  if (status === 429) return "The voice service is busy. Please try again in a moment.";
  if (status === 402) return "This app has run out of AI credits.";
  return text || `Voice request failed (${status}).`;
}

function decodePCM(pending: Uint8Array, incoming: Uint8Array) {
  const bytes = new Uint8Array(pending.length + incoming.length);
  bytes.set(pending);
  bytes.set(incoming, pending.length);
  const usable = bytes.length - (bytes.length % 2);
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(usable / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
  return { samples, pending: bytes.slice(usable) };
}

/** Streams spoken audio for `text` and resolves when playback ends. */
export async function speak(text: string, sessionAudio?: { context: AudioContext; destination: MediaStreamAudioDestinationNode }): Promise<void> {
  const context = sessionAudio?.context ?? new AudioContext({ sampleRate: 24000 });
  const sources = new Set<AudioBufferSourceNode>();
  let playhead = 0;
  let pending = new Uint8Array(0);
  let completed = false;
  let playback: Promise<void> = Promise.resolve();
  try {
    if (context.state === "suspended") await context.resume();
    const response = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ text }),
    });
    if (!response.ok || !response.body) throw new Error(friendly(response.status, await response.text()));
    let failure: Error | null = null;
    const parser = createParser({
      onEvent(event) {
        const payload = JSON.parse(event.data) as { type: string; audio?: string; error?: unknown };
        if (payload.type === "error" || payload.error) {
          failure = new Error("Speech failed.");
          return;
        }
        if (payload.type === "speech.audio.done") {
          completed = true;
          return;
        }
        if (payload.type !== "speech.audio.delta" || !payload.audio) return;
        const decoded = decodePCM(pending, Uint8Array.from(atob(payload.audio), (c) => c.charCodeAt(0)));
        pending = new Uint8Array(decoded.pending);
        if (!decoded.samples.length) return;
        const buffer = context.createBuffer(1, decoded.samples.length, 24000);
        buffer.copyToChannel(decoded.samples, 0);
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);
        if (sessionAudio) source.connect(sessionAudio.destination);
        sources.add(source);
        playback = new Promise<void>((resolve) => {
          source.onended = () => {
            sources.delete(source);
            resolve();
          };
        });
        playhead = Math.max(playhead, context.currentTime + 0.05);
        source.start(playhead);
        playhead += buffer.duration;
      },
    });
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      parser.feed(next.value);
    }
    if (failure) throw failure;
    if (!completed) throw new Error("The spoken question was cut off.");
    await playback;
  } finally {
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    if (!sessionAudio) await context.close();
  }
}

/** Sends a complete answer recording and returns its transcript. */
export async function transcribe(audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", new File([audio], "answer.webm", { type: "audio/webm" }));
  const response = await fetch("/api/stt", { method: "POST", headers: await authHeader(), body: form });
  if (!response.ok || !response.body) throw new Error(friendly(response.status, await response.text()));
  let text = "";
  let final: string | null = null;
  let failure: Error | null = null;
  const parser = createParser({
    onEvent(event) {
      if (event.data === "[DONE]") return;
      const payload = JSON.parse(event.data) as { type?: string; delta?: string; text?: string; error?: unknown };
      if (payload.error || payload.type === "error") failure = new Error("Transcription failed.");
      else if (payload.type === "transcript.text.delta" && payload.delta) text += payload.delta;
      else if (payload.type === "transcript.text.done") final = payload.text ?? text;
    },
  });
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    parser.feed(next.value);
  }
  if (failure) throw failure;
  if (final === null) throw new Error("Transcription was incomplete. Please try recording again.");
  return (final as string).trim();
}
