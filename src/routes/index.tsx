import { Link, createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader, PageShell } from "@/components/AppHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CTC Bot — Critical Thinking Chat Bot for case studies" },
      {
        name: "description",
        content:
          "Upload a case study and answer five spoken questions in a proctored session. CTC Bot tests assumptions, evidence and counterarguments, and never gives the answer.",
      },
      { property: "og:title", content: "CTC Bot — Critical Thinking Chat Bot" },
      {
        property: "og:description",
        content: "Proctored, spoken case practice: five precise questions on your case. No answers given.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  ["Upload", "Add your case as a PDF, Word or text file."],
  ["Check", "Turn on your camera and microphone."],
  ["Speak", "Listen to five questions and answer out loud."],
  ["Review", "Your instructor sees the recording and transcript."],
];

function Index() {
  const { user } = useAuth();
  return (
    <PageShell>
      <AppHeader
        right={
          !user && (
            <Link to="/auth" className="rounded-full bg-primary px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-primary-foreground">
              Sign in
            </Link>
          )
        }
      />
      <section className="max-w-3xl animate-rise py-10">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Proctored case discussion</p>
        <h1 className="text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          Five questions. Your reasoning, out loud.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          CTC Bot reads your whole case, then asks one precise question at a time about assumptions, evidence,
          counterarguments and what changes if you're wrong. It never gives the answer.
        </p>
        <Link
          to={user ? "/session" : "/auth"}
          className="mt-8 inline-block rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          {user ? "Start a session" : "Sign in to begin"}
        </Link>
      </section>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {steps.map(([t, d], i) => (
          <div key={t} className="glass rounded-2xl p-5 ring-1 ring-border">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">0{i + 1}</p>
            <p className="mt-2 font-display text-xl font-bold">{t}</p>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
