import { createFileRoute } from "@tanstack/react-router";
import { AppHeader, PageShell } from "@/components/AppHeader";

export const Route = createFileRoute("/_authenticated/session")({
  head: () => ({
    meta: [
      { title: "Session — CTC Bot" },
      { name: "description", content: "Your proctored CTC Bot case session." },
      { property: "og:title", content: "Session — CTC Bot" },
      { property: "og:description", content: "Your proctored CTC Bot case session." },
    ],
  }),
  component: SessionPage,
});

function SessionPage() {
  return (
    <PageShell>
      <AppHeader />
      <div className="glass-strong rounded-2xl p-8 ring-1 ring-border">
        <h1 className="font-display text-3xl font-bold">Proctored session</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page is still being built.</p>
      </div>
    </PageShell>
  );
}
