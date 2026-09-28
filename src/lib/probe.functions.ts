import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ModelMessage } from "ai";

const schema = z.object({
  caseText: z.string().min(1),
  history: z.array(z.object({ role: z.enum(["probe", "student"]), content: z.string() })),
  turn: z.number().int().min(1),
  total: z.number().int().min(4).max(12),
});

const LENSES = [
  "a hidden assumption the case or the decision-maker is quietly making",
  "the evidence in the case: which specific fact, quote or number supports (or fails to support) the student's claim",
  "a counterargument — the strongest case against what the student just said",
  "what changes if the student's assumption turns out to be wrong",
  "a stakeholder's incentive that the student has not accounted for",
  "a number in the case and how it should be interpreted or what it hides",
];

const SYSTEM = `You are a Socratic case-discussion examiner for MBA students.

Absolute rules:
- Output ONE short question only. No preamble, no praise, no evaluation, no hints, no answers.
- NEVER say whether the student is right, wrong, close, or "good point". No feedback words at all.
- Never summarise the case or explain concepts.
- Every question must be specific to THIS case: cite an actual detail, number, quote, actor or event from it.
- Maximum two sentences; the last sentence must be the question. Under 45 words.`;

function buildMessages(input: z.infer<typeof schema>): ModelMessage[] {
  const { caseText, history, turn, total } = input;
  const messages: ModelMessage[] = [
    {
      role: "user",
      content: `Here is the full case study. Read all of it.\n\n<case>\n${caseText.slice(0, 250000)}\n</case>`,
    },
  ];

  for (const m of history) {
    messages.push({ role: m.role === "probe" ? "assistant" : "user", content: m.content });
  }

  if (turn === 1) {
    messages.push({
      role: "user",
      content:
        "Begin. Ask your first probing question about this case — pick a genuine tension, a number that needs interpreting, a stakeholder incentive, or a hidden assumption. One question only.",
    });
  } else if (turn >= total) {
    messages.push({
      role: "user",
      content:
        "This is the end of the session. Do not ask another question and do not evaluate the student's answers. Write two short sentences: thank them for working through the case and note that the transcript is available to download. Polite and plain.",
    });
  } else {
    messages.push({
      role: "user",
      content: `Ask the next question. Build directly on the student's last reply and focus on ${LENSES[(turn - 2) % LENSES.length]}. One short question only, grounded in a concrete detail of the case.`,
    });
  }

  return messages;
}

export const askProbe = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { generateProbeText } = await import("./ai.server");
    try {
      const text = await generateProbeText(SYSTEM, buildMessages(data));
      return { text, closing: data.turn >= data.total };
    } catch (error) {
      const status = (error as { statusCode?: number; status?: number })?.statusCode ??
        (error as { status?: number })?.status;
      if (status === 429) throw new Error("The AI is busy right now. Wait a moment and send your reply again.");
      if (status === 402)
        throw new Error("This app has run out of AI credits. Add credits in your workspace to continue.");
      throw new Error(
        error instanceof Error && error.message ? error.message : "Something went wrong reaching the AI.",
      );
    }
  });
