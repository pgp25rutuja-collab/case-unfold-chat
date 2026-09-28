import { createFileRoute } from "@tanstack/react-router";
import { requestSpeech, verifyCaller } from "@/lib/voice.server";

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await verifyCaller(request))) return new Response("Unauthorized", { status: 401 });
        const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
        const text = typeof body?.text === "string" ? body.text.trim().slice(0, 1500) : "";
        if (!text) return new Response("Missing text", { status: 400 });
        const upstream = await requestSpeech(text);
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "text/event-stream",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
