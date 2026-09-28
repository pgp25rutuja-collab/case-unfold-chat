import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function AppHeader({ right }: { right?: React.ReactNode }) {
  const { user, isInstructor } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="mb-10 flex animate-fade flex-wrap items-center justify-between gap-4">
      <Link to="/" className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-lg bg-primary/10">
          <span className="font-display text-lg font-bold leading-none text-primary">C</span>
        </div>
        <div>
          <p className="font-display text-lg font-bold leading-none tracking-tight">CTC Bot</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Critical thinking, one question at a time
          </p>
        </div>
      </Link>
      <div className="flex items-center gap-2">
        {right}
        {user && (
          <>
            <Link
              to="/session"
              className="glass rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] ring-1 ring-border"
              activeProps={{ className: "!bg-primary !text-primary-foreground" }}
            >
              Session
            </Link>
            {isInstructor && (
              <Link
                to="/instructor"
                className="glass rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] ring-1 ring-border"
                activeProps={{ className: "!bg-primary !text-primary-foreground" }}
              >
                Instructor
              </Link>
            )}
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/auth" });
              }}
              className="rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
            >
              Sign out
            </button>
          </>
        )}
      </div>
    </header>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0">
        <div className="glow absolute inset-x-0 top-0 h-[420px]" />
        <div className="absolute -left-24 -top-24 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-[-120px] top-40 size-80 rounded-full bg-primary/10 blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-6xl px-6 py-10">{children}</div>
    </div>
  );
}
