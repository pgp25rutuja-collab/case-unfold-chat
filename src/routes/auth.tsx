import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader, PageShell } from "@/components/AppHeader";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CTC Bot" },
      { name: "description", content: "Sign in to CTC Bot to start a proctored critical thinking session on your case." },
      { property: "og:title", content: "Sign in — CTC Bot" },
      { property: "og:description", content: "Sign in to start a proctored, spoken case discussion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/session" });
  }, [user, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    setBusy(true);
    try {
      if (mode === "up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) setMsg("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setErr("");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) setErr(result.error.message ?? "Google sign-in failed.");
  }

  const input =
    "w-full rounded-lg border border-border bg-surface/60 px-3 py-2.5 text-sm outline-none focus:border-primary";

  return (
    <PageShell>
      <AppHeader />
      <div className="mx-auto max-w-md animate-rise">
        <div className="glass-strong rounded-2xl p-8 ring-1 ring-border">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {mode === "in" ? "Sign in" : "Create account"}
          </p>
          <h1 className="mb-6 font-display text-3xl font-bold tracking-tight">
            {mode === "in" ? "Welcome back" : "Join CTC Bot"}
          </h1>
          <button
            type="button"
            onClick={google}
            className="mb-4 w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:border-primary/50"
          >
            Continue with Google
          </button>
          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="space-y-3">
            {mode === "up" && (
              <input className={input} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
            )}
            <input className={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input
              className={input}
              type="password"
              placeholder="Password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              disabled={busy}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
            </button>
          </form>
          {err && <p className="mt-4 text-xs text-destructive">{err}</p>}
          {msg && <p className="mt-4 text-xs text-primary">{msg}</p>}
          <button
            type="button"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
            className="mt-6 text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </PageShell>
  );
}
