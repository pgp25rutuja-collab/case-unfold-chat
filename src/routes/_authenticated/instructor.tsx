import { createFileRoute } from "@tanstack/react-router";
import { AppHeader, PageShell } from "@/components/AppHeader";

export const Route = createFileRoute("/_authenticated/instructor")({
  head: () => ({
    meta: [
      { title: "Instructor dashboard — CTC Bot" },
      { name: "description", content: "Review student sessions, transcripts and warnings." },
      { property: "og:title", content: "Instructor dashboard — CTC Bot" },
      { property: "og:description", content: "Review student sessions, transcripts and warnings." },
    ],
  }),
  component: InstructorPage,
});

function InstructorPage() {
  return (
    <PageShell>
      <AppHeader />
      <div className="glass-strong rounded-2xl p-8 ring-1 ring-border">
        <h1 className="font-display text-3xl font-bold">Instructor dashboard</h1>
        <p className="mt-3 text-sm text-muted-foreground">This page is still being built.</p>
      </div>
    </PageShell>
  );
}
