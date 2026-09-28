import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askProbe } from "@/lib/probe.functions";
import { extractText } from "@/lib/extract-text";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Case Reasoning Probe — Socratic case practice for MBA students" },
      {
        name: "description",
        content:
          "Upload a case study and answer one precise question at a time. The probe tests assumptions, evidence and counterarguments, and never gives you the answer.",
      },
      { property: "og:title", content: "Case Reasoning Probe" },
      {
        property: "og:description",
        content:
          "Upload a case study and answer one precise question at a time — assumptions, evidence, counterarguments. No answers given.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Turn = { role: "probe" | "student"; content: string };

const TOTAL = 7;

function Index() {
  const ask = useServerFn(askProbe);
  const [caseText, setCaseText] = useState("");
  const [caseName, setCaseName] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const probeCount = turns.filter((t) => t.role === "probe").length;
  const started = caseText.length > 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    if (started && !done && !busy) inputRef.current?.focus();
  }, [turns, busy, started, done]);

  const runProbe = useCallback(
    async (text: string, history: Turn[], turn: number) => {
      setBusy(true);
      setError("");
      try {
        const result = await ask({ data: { caseText: text, history, turn, total: TOTAL } });
        setTurns((prev) => [...prev, { role: "probe", content: result.text }]);
        if (result.closing) setDone(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
    },
    [ask],
  );

  const handleFile = useCallback(
    async (file: File) => {
      setError("");
      setBusy(true);
      setTurns([]);
      setDone(false);
      setCaseText("");
      setCaseName(file.name);
      try {
        const text = (await extractText(file)).trim();
        if (text.length < 200) {
          throw new Error("That file didn't contain enough readable text. Try a text-based PDF, .docx or .txt.");
        }
        setCaseText(text);
        await runProbe(text, [], 1);
      } catch (e) {
        setCaseName("");
        setError(e instanceof Error ? e.message : "That file couldn't be read.");
        setBusy(false);
      }
    },
    [runProbe],
  );

  const send = useCallback(async () => {
    const answer = reply.trim();
    if (!answer || busy || done) return;
    const history: Turn[] = [...turns, { role: "student", content: answer }];
    setTurns(history);
    setReply("");
    await runProbe(caseText, history, probeCount + 1);
  }, [reply, busy, done, turns, caseText, probeCount, runProbe]);

  const download = useCallback(() => {
    const lines = [
      "Case Reasoning Probe — transcript",
      `Case: ${caseName}`,
      `Date: ${new Date().toLocaleString()}`,
      "",
      ...turns.map((t) => `${t.role === "probe" ? "PROBE" : "YOU"}: ${t.content}\n`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `case-probe-transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [turns, caseName]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="glow absolute inset-x-0 top-0 h-[420px]" />
        <div className="absolute -left-24 -top-24 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[-120px] top-40 size-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 py-10">
        <header className="mb-10 flex animate-fade items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg bg-primary/10">
              <span className="font-display text-lg font-bold leading-none text-primary">C</span>
            </div>
            <div>
              <p className="font-display text-lg font-bold leading-none tracking-tight">Case Reasoning Probe</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Critical thinking, one question at a time
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] ring-1 ring-border ${
                started ? "glass text-muted-foreground" : "bg-primary text-primary-foreground ring-0"
              }`}
            >
              Upload
            </span>
            <span
              className={`rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] ring-1 ring-border ${
                started ? "bg-primary text-primary-foreground ring-0" : "glass text-muted-foreground"
              }`}
            >
              Probe
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <aside className="animate-rise md:col-span-4 [animation-delay:80ms]">
            <div className="glass sticky top-10 rounded-2xl p-6 ring-1 ring-border">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">(a) Upload</p>
              <h2 className="mb-3 text-balance font-display text-2xl font-bold tracking-tight">Drop your case</h2>
              <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                Upload a PDF, Word, or text file. The probe reads the whole case, then asks one precise question at a
                time — a tension, a number, a stakeholder incentive, or a hidden assumption. It never gives the answer.
              </p>

              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleFile(file);
                }}
                className={`w-full rounded-xl border border-dashed p-6 text-center transition-colors ${
                  dragging ? "border-primary bg-primary/5" : "border-border bg-surface/40 hover:border-primary/50"
                }`}
              >
                <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-primary/10">
                  <span className="font-mono text-lg leading-none text-primary">↑</span>
                </div>
                <p className="text-sm font-medium">{caseName ? caseName : "Drag a file here"}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  PDF · DOCX · TXT
                </p>
              </button>

              <div className="mt-5 space-y-2">
                {["Reads the full case first", "One question per turn", `Closes after ~${TOTAL} exchanges`].map((t) => (
                  <div key={t} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-primary" /> {t}
                  </div>
                ))}
              </div>

              {error && <p className="mt-5 text-xs leading-relaxed text-destructive">{error}</p>}
            </div>
          </aside>

          <main className="animate-rise md:col-span-8 [animation-delay:160ms]">
            <div className="glass-strong rounded-2xl p-6 ring-1 ring-border">
              <div className="mb-5 flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Case</span>
                  <span className="truncate text-sm font-medium">{caseName || "No case loaded"}</span>
                </div>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {Math.min(probeCount, TOTAL)} of {TOTAL}
                </span>
              </div>

              <div className="mb-6 flex items-center gap-1">
                {Array.from({ length: TOTAL }).map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 flex-1 rounded-full ${i < probeCount ? "bg-primary" : "bg-border"}`}
                  />
                ))}
              </div>

              {turns.length === 0 && !busy && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Upload a case study to open the probe.
                </p>
              )}

              <div className="space-y-5">
                {turns.map((t, i) =>
                  t.role === "probe" ? (
                    <div key={i} className="flex animate-rise gap-3">
                      <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary/10">
                        <span className="font-display text-xs font-bold text-primary">C</span>
                      </div>
                      <div className="glass max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 ring-1 ring-border">
                        <p className="text-sm leading-relaxed">{t.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="flex animate-rise justify-end gap-3">
                      <div className="glass max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 ring-1 ring-border">
                        <p className="text-sm leading-relaxed">{t.content}</p>
                      </div>
                    </div>
                  ),
                )}

                {busy && (
                  <div className="flex gap-3">
                    <div className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary/10">
                      <span className="font-display text-xs font-bold text-primary">C</span>
                    </div>
                    <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 ring-1 ring-border">
                      <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                        {started ? "Thinking…" : "Reading the case…"}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              <div className="mt-6 flex items-start gap-3">
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={reply}
                  disabled={!started || busy || done}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder={done ? "This session is complete." : "Type your reply…"}
                  className="glass flex-1 resize-none rounded-xl px-4 py-3 text-sm leading-relaxed ring-1 ring-border outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!started || busy || done || !reply.trim()}
                  className="shrink-0 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-40"
                >
                  Send
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={download}
                  disabled={turns.length === 0}
                  className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  Download transcript
                </button>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  {done ? "Session closed" : started ? "Probe active" : "Awaiting case"}
                </span>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
